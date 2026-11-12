/**
 * The desk's review of one published case. It looks for what happened since the case was last
 * checked, and answers any error reports readers sent about it:
 *   1. search the case's watch queries for pages since it was last checked, and add the links
 *      the week's sweep or a reader pointed at;
 *   2. fetch each page and split it into sentences;
 *   3. an agent decides what to add, remove or correct (desk/prompts/review.md);
 *   4. every added statement passes the same checks as a new case (desk/checks.ts); failures go
 *      back to the agent once, and what still fails is dropped;
 *   5. the new sources the additions cite are archived, and their quotes found on the archive;
 *   6. code applies the review (desk/review-apply.ts), renders the case and runs the case checks.
 *
 * A case with nothing new found is only touched when its review is due, or it is over its length
 * limit: then the check itself is recorded, as a new lastChecked date, and the case is trimmed.
 *
 *   node desk/review.ts --case cba-2025 [--due] [--links <url>,<url>] [--reports <file>] --budget 0.40 --publish
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { checkCaseText } from '../scripts/check-cases.ts';
import { pageFacts } from '../src/lib/page-facts.ts';
import { articleSentences } from '../src/lib/sentences.ts';
import { archive, fetchPage } from './archive.ts';
import { createBudget } from './budget.ts';
import { readCase } from './case-file.ts';
import { bodyLength, renderCase, statementsOf, withoutPlaces, type SourceMaterial } from './case-render.ts';
import { maxBodyStatements } from '../scripts/check-cases.ts';
import { archiveFindings, checkStatement, checkStatements, neededScores, notSupported, readWaybackRaw, sourceRuleProblem, type Failure } from './checks.ts';
import { askClaude, isDeepseekModel } from './claude.ts';
import { createDeepseekDoor, deepseekKey } from './deepseek.ts';
import { createJevDoor } from './jev.ts';
import { applyReview, dropCiting, emptyReview, parseReview, trimForLength, type Review } from './review-apply.ts';
import { newSourceId, reviewMaterial, selectCandidates, type Candidate, type ErrorReport } from './review-material.ts';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const { values } = parseArgs({
  options: {
    case: { type: 'string' },
    due: { type: 'boolean', default: false },
    links: { type: 'string', default: '' },
    reports: { type: 'string' },
    model: { type: 'string', default: 'deepseek-flash' },
    budget: { type: 'string', default: '0.40' },
    'budget-each': { type: 'string', default: '0.15' },
    'max-pages': { type: 'string', default: '8' },
    today: { type: 'string' },
    run: { type: 'string' },
    publish: { type: 'boolean', default: false },
    summary: { type: 'string' },
  },
});
if (values.case === undefined) {
  console.error('usage: node desk/review.ts --case <slug>');
  process.exit(2);
}
const slug = values.case;
const today = values.today ?? new Date().toISOString().slice(0, 10);
const runDir = values.run ?? path.join('.desk-runs', `${today}-review`);
const outDir = path.join(runDir, 'reviews');
const casePath = path.join('src', 'content', 'cases', `${slug}.md`);

const log: string[] = [];
const note = (line: string): void => {
  log.push(line);
  console.log(line);
};

/** What the weekly run reads back. `reports` holds only the reports this review answered. */
interface Summary {
  slug: string;
  reviewed: boolean;
  written: boolean;
  pages: number;
  added: number;
  removed: number;
  corrections: string[];
  reports: Review['reports'];
  problems: string[];
  costUsd: number;
}

// One budget for every metered call this review makes: searches, Jev and the agent.
const budget = createBudget(Number(values.budget));
const door = createJevDoor({ budget, model: 'jev-latest', sleep });

async function finish(summary: Omit<Summary, 'slug' | 'costUsd'>): Promise<never> {
  const full: Summary = { slug, ...summary, costUsd: budget.spent() };
  note(`${slug}: ${summary.written ? 'written' : 'not written'}; ${String(summary.added)} added, ${String(summary.removed)} removed, ${String(summary.corrections.length)} corrections${summary.problems.length === 0 ? '' : `; problems: ${summary.problems.join('; ')}`}`);
  note(`cost: $${full.costUsd.toFixed(4)}`);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, `${slug}.log.txt`), `${log.join('\n')}\n`);
  if (values.summary !== undefined) await writeFile(values.summary, `${JSON.stringify(full, null, 2)}\n`);
  process.exit(summary.problems.length > 0 ? 1 : 0);
}

const original = await readFile(casePath, 'utf8');
const read = readCase(original);
if (!read.ok) await finish({ reviewed: false, written: false, pages: 0, added: 0, removed: 0, corrections: [], reports: [], problems: read.problems });
const current = read.ok ? read.value : (undefined as never);
const reports: ErrorReport[] = values.reports === undefined ? [] : (JSON.parse(await readFile(values.reports, 'utf8')) as ErrorReport[]);

/**
 * Brings the case within its limit: the statements a reader needs least, as Jev rates them, go
 * first, and none that would leave another hanging (trimForLength). Jev rates the case once.
 */
let scores: Map<string, number> | null = null;
async function withTrim(review: Review): Promise<{ review: Review; problems: string[] }> {
  const others = review.remove.filter((removal) => removal.reason !== 'length');
  const added = bodyLength(review.add);
  const removedPlaces = new Set(others.map((removal) => removal.place));
  if (bodyLength(current.draft) - others.filter((removal) => /^(role|change|next)\[/.test(removal.place)).length + added <= maxBodyStatements) return { review: { ...review, remove: others }, problems: [] };
  scores ??= await neededScores(current.draft, door);
  const trimmed = trimForLength(current.draft, removedPlaces, added, scores, maxBodyStatements);
  if (!trimmed.ok) return { review: { ...review, remove: others }, problems: [trimmed.problem] };
  return { review: { ...review, remove: [...others, ...[...trimmed.places].map((place) => ({ place, reason: 'length' as const }))] }, problems: [] };
}

/** Writes the reviewed case, after the same checks the build runs. */
async function write(review: Review, newSources: readonly SourceMaterial[], pages: number): Promise<never> {
  const applied = applyReview(current, review, newSources, today);
  const counts = { pages, added: statementsOf(review.add).length, removed: review.remove.length };
  if (!applied.ok) return finish({ reviewed: true, written: false, ...counts, corrections: [], reports: [], problems: applied.problems });
  const rendered = renderCase(applied.draft, applied.sources, today, applied.record);
  if (!rendered.ok) return finish({ reviewed: true, written: false, ...counts, corrections: [], reports: [], problems: rendered.problems });
  const findings = checkCaseText(`${slug}.md`, rendered.text).map((finding) => `case check ${finding.rule}: ${finding.message}`);
  if (findings.length > 0) return finish({ reviewed: true, written: false, ...counts, corrections: [], reports: [], problems: findings });
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, `${slug}.md`), rendered.text);
  if (values.publish) await writeFile(casePath, rendered.text);
  const answered = new Set(reports.map((report) => report.id));
  return finish({ reviewed: true, written: values.publish, ...counts, corrections: applied.corrections, reports: review.reports.filter((report) => answered.has(report.id)), problems: [] });
}

// 1. What to read: the watch queries since the last check, a week of overlap for slow indexes.
const since = new Date(Date.parse(current.lastChecked) - 7 * 86_400_000).toISOString().slice(0, 10);
const pointed: Candidate[] = [...new Set([...values.links.split(',').filter((url) => url !== ''), ...reports.flatMap((report) => report.links)])].map((url) => ({ url, title: '', publisher: '', published: '', pointed: true }));
const searched: Candidate[] = [];
const key = await deepseekKey();
if (key === null) note('search: no DEEPSEEK_API_KEY; only pointed links are read');
else {
  const search = createDeepseekDoor({ budget, key });
  for (const query of current.draft.watch.queries) {
    const found = await search.search(`${query} after:${since}`, { count: 5, content: false });
    if (!found.ok) note(`search "${query}": ${found.reason}: ${found.message}`);
    else for (const lead of found.leads) searched.push({ url: lead.url, title: lead.title, publisher: lead.outlet, published: lead.published, pointed: false });
  }
}
const candidates = selectCandidates([...pointed, ...searched], current.sources.map((source) => source.url), since, Number(values['max-pages']));
note(`${slug}: last checked ${current.lastChecked}; ${String(searched.length)} search results, ${String(pointed.length)} pointed links, ${String(candidates.length)} pages to read`);

// 2. Pages and sentences. A page with no date cannot be a source, since every source is dated.
const taken = new Set(current.sources.map((source) => source.id));
const pages: SourceMaterial[] = [];
for (const candidate of candidates) {
  const page = await fetchPage(candidate.url);
  if (!page.ok) {
    note(`page ${candidate.url}: not readable (${page.message})`);
    continue;
  }
  const facts = pageFacts(page.html);
  const published = candidate.published || facts.published || '';
  const sentences = articleSentences(page.html).slice(0, 150);
  if (published === '' || sentences.length < 3) {
    note(`page ${candidate.url}: left out (${published === '' ? 'no date' : `${String(sentences.length)} sentences`})`);
    continue;
  }
  const publisher = candidate.publisher || facts.publisher || new URL(candidate.url).hostname.replace(/^www\./, '');
  const id = newSourceId(publisher, published, taken);
  taken.add(id);
  // The kind is the agent's call and is set from its answer; until then a page is reporting.
  pages.push({ id, kind: 'reporting', url: candidate.url, publisher, title: candidate.title || facts.title || publisher, published, archive: '', sentences });
  note(`page ${id}: ${String(sentences.length)} sentences via ${page.via}, ${published}, ${candidate.url}`);
}

// A case over its length limit is written too, trimmed, since the build refuses it as it is.
if (pages.length === 0 && reports.length === 0) {
  const overLimit = bodyLength(current.draft) > maxBodyStatements;
  if (!values.due && !overLimit) await finish({ reviewed: false, written: false, pages: 0, added: 0, removed: 0, corrections: [], reports: [], problems: [] });
  note(`${slug}: ${values.due ? 'due' : 'over its length limit'}, and nothing new found; recording the check`);
  await write((await withTrim(emptyReview)).review, [], 0);
}

// 3. The agent.
const agentKey = isDeepseekModel(values.model) ? key : null;
const prompt = await readFile(path.join(import.meta.dirname, 'prompts', 'review.md'), 'utf8');
const firstText = `${prompt}\n\`\`\`json\n${JSON.stringify(reviewMaterial(current, pages, reports, today), null, 2)}\n\`\`\`\n`;

async function askAgent(text: string): Promise<{ review: Review | null; problems: string[] }> {
  const result = await askClaude(text, { budget, capUsd: Number(values['budget-each']), model: values.model, deepseekKey: agentKey, disallowedTools: ['WebSearch', 'WebFetch', 'Bash', 'Write', 'Edit'] });
  if (!result.ok) return { review: null, problems: [`agent: ${result.reason}: ${result.message}`] };
  const fence = [...result.text.matchAll(/```json\s*([\s\S]*?)```/g)].at(-1)?.[1];
  if (fence === undefined) return { review: null, problems: ['agent: no JSON answer'] };
  let value: unknown;
  try {
    value = JSON.parse(fence) as unknown;
  } catch {
    return { review: null, problems: ['agent: the JSON answer does not parse'] };
  }
  const parsed = parseReview(value);
  return parsed.ok ? { review: parsed.review, problems: [] } : { review: null, problems: parsed.problems.map((problem) => `agent answer: ${problem}`) };
}

/** The new sources with the kind the agent gave; additions citing a new source it gave no kind are dropped. */
function withKinds(review: Review): { review: Review; sources: SourceMaterial[] } {
  const unkinded = new Set(pages.filter((page) => review.kinds[page.id] === undefined).map((page) => page.id));
  const sources = pages.map((page) => ({ ...page, kind: review.kinds[page.id] ?? page.kind }));
  return { review: { ...review, add: dropCiting(review.add, unkinded) }, sources };
}

/**
 * A removal that writes a correction must be confirmed by more than the agent. A reading point holds
 * no quote, so it cannot be removed as unsupported. A sentence is removed as unsupported only when
 * Jev, too, finds its quote does not support it, and as about another matter only on a reader's
 * report. Removals that are not confirmed are left out.
 */
async function confirmRemovals(review: Review): Promise<{ review: Review; problems: string[] }> {
  const statements = new Map(statementsOf(current.draft).map((item) => [item.where, item]));
  const kept: Review['remove'] = [];
  const problems: string[] = [];
  for (const removal of review.remove) {
    const item = statements.get(removal.place);
    // The desk trims for length itself (withTrim), so the agent's own length removals are left out.
    if (removal.reason === 'length') continue;
    // An unknown place is refused by applyReview; making way for news writes no correction.
    if (item === undefined || removal.reason === 'superseded') {
      kept.push(removal);
    } else if (removal.reason === 'wrong-case') {
      if (reports.length > 0) kept.push(removal);
      else problems.push(`${removal.place}: a sentence is removed as about another matter only on a reader's report, so it stays`);
    } else if (removal.place.startsWith('missed[')) {
      problems.push(`${removal.place}: a reading point cites its source as a whole, so it cannot be removed as unsupported`);
    } else {
      const failure = await checkStatement(item.where, item.text, item.cite, current.sources, door);
      if (failure?.reason.startsWith(notSupported) === true) kept.push(removal);
      else problems.push(`${removal.place}: the check finds its quote supports it, so it stays`);
    }
  }
  return { review: { ...review, remove: kept }, problems };
}

async function checked(review: Review): Promise<{ review: Review; sources: SourceMaterial[]; failures: Failure[]; problems: string[] }> {
  const kinded = withKinds(review);
  const removalsChecked = await confirmRemovals(kinded.review);
  const trimmed = await withTrim(removalsChecked.review);
  const confirmed = { review: trimmed.review, problems: [...removalsChecked.problems, ...trimmed.problems] };
  const failures = await checkStatements(confirmed.review.add, [...current.sources, ...kinded.sources], door);
  const applied = applyReview(current, confirmed.review, kinded.sources, today);
  return { review: confirmed.review, sources: kinded.sources, failures, problems: [...confirmed.problems, ...(applied.ok ? [] : applied.problems)] };
}

const first = await askAgent(firstText);
if (first.review === null) await finish({ reviewed: true, written: false, pages: pages.length, added: 0, removed: 0, corrections: [], reports: [], problems: first.problems });
let round = await checked(first.review ?? emptyReview);
note(`first answer: ${String(statementsOf(round.review.add).length)} added, ${String(round.review.remove.length)} removed, ${String(round.failures.length)} failed${round.problems.length === 0 ? '' : `; ${round.problems.join('; ')}`}`);
for (const failure of round.failures) note(`  ${failure.where}: ${failure.reason} | ${failure.text}`);

// 4. One revision for failed statements or a review the case rules refuse.
if (round.failures.length > 0 || round.problems.length > 0) {
  const failed = round.failures.map((failure) => `- add.${failure.where} (${failure.cite}): ${failure.reason}. Statement: "${failure.text}"`).join('\n');
  const revision = await askAgent(
    `${firstText}\n## Your first answer\n\n\`\`\`json\n${JSON.stringify(round.review, null, 2)}\n\`\`\`\n\n${
      round.failures.length === 0 ? '' : `## Statements that failed the checks\n\n${failed}\n\nFix each so its cited sentence supports all of it, cite a better sentence, or leave it out.\n\n`
    }${round.problems.length === 0 ? '' : `## The case rules refused the answer\n\n${round.problems.map((problem) => `- ${problem}`).join('\n')}\n\n`}Revise the answer. Return the whole answer in the same JSON format.\n`,
  );
  if (revision.review !== null) {
    round = await checked(revision.review);
    note(`revised answer: ${String(statementsOf(round.review.add).length)} added, ${String(round.review.remove.length)} removed, ${String(round.failures.length)} failed${round.problems.length === 0 ? '' : `; ${round.problems.join('; ')}`}`);
    for (const failure of round.failures) note(`  dropped add.${failure.where}: ${failure.reason} | ${failure.text}`);
  } else note(`revision: ${revision.problems.join('; ')}`);
}
let review: Review = { ...round.review, add: withoutPlaces(round.review.add, new Set(round.failures.map((failure) => failure.where))) };

// 5. Archive the new sources the additions cite, and find each quote on the archived copy.
const addedCites = statementsOf(review.add).map((item) => item.cite);
const citedNew = round.sources.filter((source) => addedCites.some((cite) => cite.startsWith(`${source.id}#`)));
const archived: SourceMaterial[] = [];
const unusable = new Set<string>();
for (const source of citedNew) {
  const saved = await archive(source.url, sleep);
  if (!saved.ok) {
    note(`archive ${source.id}: ${saved.message}; its statements are dropped`);
    unusable.add(source.id);
    continue;
  }
  archived.push({ ...source, archive: saved.archive });
}
for (const finding of await archiveFindings(addedCites, archived, readWaybackRaw)) {
  if (finding.unreadable || finding.missing.length > 0) {
    note(`quote check ${finding.source}: ${finding.unreadable ? 'archived copy not readable' : `${String(finding.missing.length)} quotes not on the archived copy`}; its statements are dropped`);
    unusable.add(finding.source);
  } else note(`quote check ${finding.source}: ${String(finding.found)}/${String(finding.found)} quotes found on the archived copy`);
}
review = { ...review, add: dropCiting(review.add, unusable) };
// Publishing check 5 for what is new: the new sources the additions cite hold one primary source or
// two independent reports, as a new case's must. Otherwise the new material waits for another week.
const usableNew = archived.filter((source) => !unusable.has(source.id));
const newCites = statementsOf(review.add).map((item) => item.cite).filter((cite) => usableNew.some((source) => cite.startsWith(`${source.id}#`)));
const newSourceProblem = newCites.length === 0 ? null : sourceRuleProblem(newCites, usableNew);
if (newSourceProblem !== null) {
  note(`new material not published: ${newSourceProblem}`);
  for (const source of usableNew) unusable.add(source.id);
  review = { ...review, add: dropCiting(review.add, unusable) };
}
// A statement removed as superseded makes way for news; when no news from a new source is left, it stays.
const newsLeft = statementsOf(review.add).some((item) => archived.some((source) => !unusable.has(source.id) && item.cite.startsWith(`${source.id}#`)));
if (!newsLeft && review.remove.some((removal) => removal.reason === 'superseded')) {
  note('no news from a new source is left, so the statements removed as superseded stay');
  review = { ...review, remove: review.remove.filter((removal) => removal.reason !== 'superseded') };
}

// 6. Trim again for what is left, then apply, render, check, write.
const final = await withTrim(review);
for (const problem of final.problems) note(problem);
const lengthCuts = final.review.remove.filter((removal) => removal.reason === 'length').map((removal) => removal.place);
if (lengthCuts.length > 0) note(`removed for length, least needed first: ${lengthCuts.map((place) => `${place} (${(scores?.get(place) ?? 1).toFixed(2)})`).join(', ')}`);
await write(final.review, archived.filter((source) => !unusable.has(source.id)), pages.length);

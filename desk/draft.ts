/**
 * The desk's drafting stage. From an assessment recommended for drafting:
 *   1. fetch each source (from the publisher, or the Wayback copy) and split it into sentences;
 *   2. archive each source;
 *   3. a Claude agent writes the case, citing sentences by number (desk/prompts/draft.md);
 *   4. Jev checks every cited statement against its sentence, and code checks for loaded words
 *      and the body's length (desk/checks.ts, shared with the review stage);
 *   5. failures go back to the agent once; what still fails is removed;
 *   6. code renders the case file with each cited sentence copied in as the quote.
 *
 *   node desk/draft.ts --assessment .desk-runs/<run>/assessments/<org>.json --budget 1.50 --publish
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { checkCaseText, maxBodyStatements } from '../scripts/check-cases.ts';
import { pageFacts } from '../src/lib/page-facts.ts';
import { articleSentences } from '../src/lib/sentences.ts';
import { archive, fetchPage } from './archive.ts';
import { createBudget } from './budget.ts';
import { askClaude, isDeepseekModel } from './claude.ts';
import { deepseekKey } from './deepseek.ts';
import { allCites, bodyLength, firstRecord, renderCase, slugOf, statementsOf, withoutPlaces, type Draft, type SourceMaterial } from './case-render.ts';
import { archiveFindings, checkStatements, neededScores, readWaybackRaw, sourceRuleProblem, type Failure } from './checks.ts';
import { trimForLength } from './review-apply.ts';
import { createJevDoor } from './jev.ts';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const { values } = parseArgs({
  options: {
    assessment: { type: 'string' },
    model: { type: 'string', default: 'deepseek-flash' },
    'budget-each': { type: 'string', default: '0.60' },
    budget: { type: 'string', default: '1.50' },
    today: { type: 'string' },
    publish: { type: 'boolean', default: false },
    summary: { type: 'string' },
    /** A reader's name, when the case came from their suggestion and they asked to be credited. */
    'suggested-by': { type: 'string' },
  },
});
if (values.assessment === undefined) {
  console.error('usage: node desk/draft.ts --assessment <file>');
  process.exit(2);
}
const today = values.today ?? new Date().toISOString().slice(0, 10);

interface AssessedSource {
  id: string;
  kind: 'primary' | 'reporting';
  url: string;
  publisher: string;
  title: string;
  published: string | null;
}

interface Assessment {
  organisation: string;
  recommendation: string;
  sources: AssessedSource[];
  [key: string]: unknown;
}

const outcome = JSON.parse(await readFile(values.assessment, 'utf8')) as { assessment?: Assessment };
const assessment = outcome.assessment;
if (assessment === undefined) {
  console.error('the file holds no assessment');
  process.exit(2);
}
const outDir = path.join(path.dirname(path.dirname(values.assessment)), 'drafts');
const log: string[] = [];
const note = (line: string): void => {
  log.push(line);
  console.log(line);
};

// 1 and 2: pages, sentences and archives.
const sources: SourceMaterial[] = [];
for (const source of assessment.sources) {
  const page = await fetchPage(source.url);
  if (!page.ok) {
    note(`source ${source.id}: not readable (${page.message}); left out`);
    continue;
  }
  const sentences = articleSentences(page.html).slice(0, 150);
  // A source the assessor left undated takes the date the page gives itself; every source is dated.
  const published = source.published ?? pageFacts(page.html).published ?? '';
  const archived = await archive(source.url, sleep);
  note(`source ${source.id}: ${String(sentences.length)} sentences via ${page.via}; archive ${archived.ok ? archived.archive : `missing (${archived.message})`}`);
  sources.push({
    id: source.id,
    kind: source.kind,
    url: source.url,
    publisher: source.publisher,
    title: source.title,
    published,
    archive: archived.ok ? archived.archive : '',
    sentences,
  });
}
if (sources.length === 0) {
  note('no readable sources; nothing to draft');
  process.exit(1);
}

// 3: the drafting agent.
const prompt = await readFile(path.join(import.meta.dirname, 'prompts', 'draft.md'), 'utf8');
// The assessment's own sources carry quotes the assessor typed; the writer sees only the fetched sentences.
const material = {
  assessment: Object.fromEntries(Object.entries(assessment).filter(([key]) => key !== 'sources')),
  sources: sources.map((source) => ({
    id: source.id,
    kind: source.kind,
    publisher: source.publisher,
    title: source.title,
    published: source.published,
    sentences: source.sentences.map((sentence, index) => `${String(index + 1)}. ${sentence}`),
  })),
};
const budget = createBudget(Number(values.budget));
let claudeCost = 0;

async function askAgent(text: string): Promise<Draft | null> {
  const result = await askClaude(text, {
    budget,
    capUsd: Number(values['budget-each']),
    model: values.model,
    deepseekKey: agentKey,
    disallowedTools: ['WebSearch', 'WebFetch', 'Bash', 'Write', 'Edit'],
  });
  claudeCost += result.costUsd;
  if (!result.ok) {
    note(`writer: ${result.reason}: ${result.message}`);
    return null;
  }
  const fence = [...result.text.matchAll(/```json\s*([\s\S]*?)```/g)].at(-1)?.[1];
  if (fence === undefined) return null;
  try {
    return JSON.parse(fence) as Draft;
  } catch {
    return null;
  }
}

// 4: checks on every cited statement.
const door = createJevDoor({ budget, model: 'jev-latest', sleep });
// A DeepSeek model needs its key, read once here at the edge.
const agentKey = isDeepseekModel(values.model) ? await deepseekKey() : null;

const checkDraft = (candidate: Draft): Promise<Failure[]> => checkStatements(candidate, sources, door);
const tooLong = (candidate: Draft): string | null =>
  bodyLength(candidate) > maxBodyStatements ? `the body holds ${String(bodyLength(candidate))} statements; at most ${String(maxBodyStatements)}` : null;

const firstText = `${prompt}\n\n${JSON.stringify(material, null, 2)}\n`;
let draft = await askAgent(firstText);
if (draft === null) {
  note('the agent returned no draft');
  process.exit(1);
}
let failures = await checkDraft(draft);
const firstLength = tooLong(draft);
note(`first draft: ${String(statementsOf(draft).length)} statements, ${String(failures.length)} failed${firstLength === null ? '' : `; ${firstLength}`}`);
for (const failure of failures) note(`  ${failure.where}: ${failure.reason} | ${failure.text}`);

if (failures.length > 0 || firstLength !== null) {
  const failed = failures.map((failure) => `- ${failure.where} (${failure.cite}): ${failure.reason}. Statement: "${failure.text}"`).join('\n');
  const revision = await askAgent(
    `${firstText}\n## Your first draft\n\n\`\`\`json\n${JSON.stringify(draft, null, 2)}\n\`\`\`\n\n${
      failures.length === 0 ? '' : `## Statements that failed the checks\n\n${failed}\n\nFix each failed statement so its cited sentence supports all of it, cite a better sentence, or remove it.\n\n`
    }${firstLength === null ? '' : `## Length\n\nThe body is too long: ${firstLength}. Keep the statements a reader needs and remove the rest.\n\n`}Revise the draft. Return the whole draft in the same JSON format.\n`,
  );
  if (revision !== null) {
    draft = revision;
    failures = await checkDraft(draft);
    note(`revised draft: ${String(statementsOf(draft).length)} statements, ${String(failures.length)} failed`);
    for (const failure of failures) note(`  removed ${failure.where}: ${failure.reason} | ${failure.text}`);
  }
}

let final = withoutPlaces(draft, new Set(failures.map((failure) => failure.where)));
// Still too long after the revision: the statements a reader needs least go, as Jev rates them.
if (tooLong(final) !== null) {
  const scores = await neededScores(final, door);
  const trimmed = trimForLength(final, new Set(), 0, scores, maxBodyStatements);
  if (trimmed.ok) {
    note(`removed for length, least needed first: ${[...trimmed.places].map((place) => `${place} (${(scores.get(place) ?? 1).toFixed(2)})`).join(', ')}`);
    final = withoutPlaces(final, trimmed.places);
  }
}
const problems: string[] = [];
if (final.updates.length === 0) problems.push('no supported update remains');
const finalLength = tooLong(final);
if (finalLength !== null) problems.push(finalLength);
// Publishing check 5: one primary source, or two independent reports, among the sources the case cites.
const sourceProblem = sourceRuleProblem(allCites(final), sources);
if (sourceProblem !== null) problems.push(sourceProblem);
const missingArchives = sources.filter((source) => allCites(final).some((cite) => cite.startsWith(`${source.id}#`)) && source.archive === '');
if (missingArchives.length > 0) problems.push(`no archived copy for: ${missingArchives.map((source) => source.id).join(', ')}`);

// Publishing check 2: every quote must be on the archived copy, word for word.
for (const finding of await archiveFindings(allCites(final), sources, readWaybackRaw)) {
  if (finding.unreadable) {
    problems.push(`archived copy of ${finding.source} could not be read`);
    continue;
  }
  note(`quote check ${finding.source}: ${String(finding.found)}/${String(finding.found + finding.missing.length)} quotes found on the archived copy`);
  for (const quote of finding.missing) problems.push(`not on the archived copy of ${finding.source}: "${quote}"`);
}

const rendered = renderCase(final, sources, today, { ...firstRecord, suggestedBy: values['suggested-by'] ?? null });
await mkdir(outDir, { recursive: true });
const slug = `${slugOf(final.short)}-${final.announced.slice(0, 4)}`;
if (rendered.ok) {
  await writeFile(path.join(outDir, `${slug}.md`), rendered.text);
  // The same checks the build and CI run, so a draft cannot publish a case that would break the site
  // (an undated source once did: IBM, 2026-10-21).
  for (const finding of checkCaseText(`${slug}.md`, rendered.text)) problems.push(`case check ${finding.rule}: ${finding.message}`);
} else problems.push(...rendered.problems);
note(`problems: ${problems.length === 0 ? 'none' : problems.join('; ')}`);
const published = values.publish && rendered.ok && problems.length === 0;
if (published) {
  const target = path.join('src', 'content', 'cases', `${slug}.md`);
  await copyFile(path.join(outDir, `${slug}.md`), target);
  note(`published to ${target}`);
}
if (values.summary !== undefined) {
  const summary = { organisation: final.short, slug, published, problems, costUsd: claudeCost + door.spentUsd() };
  await writeFile(values.summary, `${JSON.stringify(summary, null, 2)}\n`);
}
note(`cost: Claude $${claudeCost.toFixed(2)}, Jev $${door.spentUsd().toFixed(4)}`);
await writeFile(path.join(outDir, `${slug}.log.txt`), `${log.join('\n')}\n`);
note(`written: ${path.join(outDir, `${slug}.md`)}`);

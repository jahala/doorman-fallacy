/**
 * The desk's drafting stage. From an assessment recommended for drafting:
 *   1. fetch each source (from the publisher, or the Wayback copy) and split it into sentences;
 *   2. archive each source;
 *   3. a Claude agent writes the case, citing sentences by number (desk/prompts/draft.md);
 *   4. Jev checks every cited statement against its sentence, and code checks for loaded words;
 *   5. failures go back to the agent once; what still fails is removed;
 *   6. code renders the case file with each cited sentence copied in as the quote.
 *
 *   node desk/draft.ts --assessment .desk-runs/<run>/assessments/<org>.json --budget 1.50 --publish
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { quoteFound } from '../src/lib/quotes.ts';
import { articleSentences } from '../src/lib/sentences.ts';
import { archive, fetchPage } from './archive.ts';
import { createBudget } from './budget.ts';
import { askClaude } from './claude.ts';
import { allCites, citedSentence, loadedWords, renderCase, type Draft, type SourceMaterial, type Statement } from './case-render.ts';
import { createJevDoor, type JevAnswer } from './jev.ts';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const { values } = parseArgs({
  options: {
    assessment: { type: 'string' },
    model: { type: 'string', default: 'sonnet' },
    'budget-each': { type: 'string', default: '0.60' },
    budget: { type: 'string', default: '1.50' },
    today: { type: 'string' },
    publish: { type: 'boolean', default: false },
    summary: { type: 'string' },
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
  const archived = await archive(source.url, sleep);
  note(`source ${source.id}: ${String(sentences.length)} sentences via ${page.via}; archive ${archived.ok ? archived.archive : `missing (${archived.message})`}`);
  sources.push({
    id: source.id,
    kind: source.kind,
    url: source.url,
    publisher: source.publisher,
    title: source.title,
    published: source.published ?? '',
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

interface Failure {
  where: string;
  text: string;
  cite: string;
  reason: string;
}

async function checkStatement(where: string, text: string, cite: string): Promise<Failure | null> {
  const found = citedSentence(cite, sources);
  if (!found.ok) return { where, text, cite, reason: found.message };
  const words = loadedWords(text);
  if (words.length > 0) return { where, text, cite, reason: `loaded words: ${words.join(', ')}` };
  const source = sources.find((candidate) => candidate.id === found.source);
  const result = await door.ask(
    {
      statement: text,
      quote: found.sentence,
      source: {
        publisher: source?.publisher ?? '',
        published: source?.published ?? '',
        kind: source?.kind === 'primary' ? 'the organisation’s own statement or an official record' : 'a news report',
        title: source?.title ?? '',
      },
    },
    {
      supported: {
        type: 'noul',
        instructions:
          'Does `quote`, read together with `source` (who published it, when, and what kind of source it is), support everything that `statement` says? Attributing the quote to its publisher, or dating it by its publication date, is supported. Answer no if `statement` adds any other fact, number, date, cause, intention or judgement that neither `quote` nor `source` contains. Plain rewording is supported.',
        criteria: { true: 'Every part of the statement is in the quote.', false: 'The statement says something the quote does not.' },
      },
      motive: {
        type: 'noul',
        instructions:
          'Does `statement` claim or suggest why the organisation acted, its motives or intentions, in the writer’s own voice? Reporting a reason the organisation itself gave, attributed to it ("the bank said ..."), does not count.',
        criteria: { true: 'The writer asserts or implies a motive.', false: 'No motive, or only one the organisation is reported as giving.' },
      },
    },
  );
  if (!result.ok) return { where, text, cite, reason: `check could not run: ${result.message}` };
  const supported = result.answers.supported as Extract<JevAnswer, { type: 'noul' }> | undefined;
  const motive = result.answers.motive as Extract<JevAnswer, { type: 'noul' }> | undefined;
  if (supported === undefined || supported.noul < 0.6) return { where, text, cite, reason: `not supported by its sentence (p=${(supported?.noul ?? 0).toFixed(2)})` };
  if (motive !== undefined && motive.noul >= 0.5) return { where, text, cite, reason: `suggests a motive (p=${motive.noul.toFixed(2)})` };
  return null;
}

function statementsOf(draft: Draft): { where: string; text: string; cite: string }[] {
  const body = (name: string, section: readonly (readonly Statement[])[]): { where: string; text: string; cite: string }[] =>
    section.flatMap((paragraph, p) => paragraph.map((statement, s) => ({ where: `${name}[${String(p)}][${String(s)}]`, ...statement })));
  return [
    ...draft.claims.map((claim, index) => ({ where: `claims[${String(index)}]`, text: claim.said, cite: claim.cite })),
    ...draft.missed.map((point, index) => ({ where: `missed[${String(index)}]`, text: point.evidence, cite: point.cite })),
    ...draft.updates.map((update, index) => ({ where: `updates[${String(index)}]`, text: update.summary, cite: update.cite })),
    ...body('role', draft.body.role),
    ...body('change', draft.body.change),
    ...body('next', draft.body.next),
  ];
}

async function checkDraft(draft: Draft): Promise<Failure[]> {
  const checks = await Promise.all(statementsOf(draft).map((item) => checkStatement(item.where, item.text, item.cite)));
  return checks.filter((failure): failure is Failure => failure !== null);
}

/** 5: removes statements that still fail. A section left empty keeps nothing rather than something unsupported. */
function withoutFailures(draft: Draft, failures: readonly Failure[]): Draft {
  const failed = new Set(failures.map((failure) => failure.where));
  const keepBody = (name: string, section: readonly (readonly Statement[])[]): Statement[][] =>
    section
      .map((paragraph, p) => paragraph.filter((_, s) => !failed.has(`${name}[${String(p)}][${String(s)}]`)))
      .filter((paragraph) => paragraph.length > 0);
  return {
    ...draft,
    claims: draft.claims.filter((_, index) => !failed.has(`claims[${String(index)}]`)),
    missed: draft.missed.filter((_, index) => !failed.has(`missed[${String(index)}]`)),
    updates: draft.updates.filter((_, index) => !failed.has(`updates[${String(index)}]`)),
    body: { role: keepBody('role', draft.body.role), change: keepBody('change', draft.body.change), next: keepBody('next', draft.body.next), open: draft.body.open },
  };
}

const firstText = `${prompt}\n\n${JSON.stringify(material, null, 2)}\n`;
let draft = await askAgent(firstText);
if (draft === null) {
  note('the agent returned no draft');
  process.exit(1);
}
let failures = await checkDraft(draft);
note(`first draft: ${String(statementsOf(draft).length)} statements, ${String(failures.length)} failed`);
for (const failure of failures) note(`  ${failure.where}: ${failure.reason} | ${failure.text}`);

if (failures.length > 0) {
  const revision = await askAgent(
    `${firstText}\n## Your first draft\n\n\`\`\`json\n${JSON.stringify(draft, null, 2)}\n\`\`\`\n\n## Statements that failed the checks\n\n${failures
      .map((failure) => `- ${failure.where} (${failure.cite}): ${failure.reason}. Statement: "${failure.text}"`)
      .join('\n')}\n\nRevise the draft. Fix each failed statement so its cited sentence supports all of it, cite a better sentence, or remove it. Return the whole draft in the same JSON format.\n`,
  );
  if (revision !== null) {
    draft = revision;
    failures = await checkDraft(draft);
    note(`revised draft: ${String(statementsOf(draft).length)} statements, ${String(failures.length)} failed`);
    for (const failure of failures) note(`  removed ${failure.where}: ${failure.reason} | ${failure.text}`);
  }
}

const final = withoutFailures(draft, failures);
const problems: string[] = [];
if (final.updates.length === 0) problems.push('no supported update remains');
if (final.missed.length === 0) problems.push('no supported doorman reading remains');
// Publishing check 5: one primary source, or two independent reports, among the sources the case cites.
const citedSources = sources.filter((source) => allCites(final).some((cite) => cite.startsWith(`${source.id}#`)));
const primaries = citedSources.filter((source) => source.kind === 'primary').length;
const reports = new Set(citedSources.filter((source) => source.kind === 'reporting').map((source) => source.publisher)).size;
if (primaries === 0 && reports < 2) problems.push(`sources: ${String(primaries)} primary and ${String(reports)} independent reports; one primary or two reports are needed`);
const missingArchives = sources.filter((source) => allCites(final).some((cite) => cite.startsWith(`${source.id}#`)) && source.archive === '');
if (missingArchives.length > 0) problems.push(`no archived copy for: ${missingArchives.map((source) => source.id).join(', ')}`);

// Publishing check 2: every quote must be on the archived copy, word for word.
for (const source of sources.filter((candidate) => candidate.archive !== '')) {
  const quotes = [...new Set(allCites(final).filter((cite) => cite.startsWith(`${source.id}#`)))].flatMap((cite) => {
    const found = citedSentence(cite, sources);
    return found.ok ? [found.sentence] : [];
  });
  if (quotes.length === 0) continue;
  const raw = await fetch(source.archive.replace(/\/web\/(\d+)\//, '/web/$1id_/'), { signal: AbortSignal.timeout(60_000) })
    .then(async (response) => (response.ok ? response.text() : null))
    .catch(() => null);
  if (raw === null) {
    problems.push(`archived copy of ${source.id} could not be read`);
    continue;
  }
  const missing = quotes.filter((quote) => !quoteFound(quote, raw));
  note(`quote check ${source.id}: ${String(quotes.length - missing.length)}/${String(quotes.length)} quotes found on the archived copy`);
  for (const quote of missing) problems.push(`not on the archived copy of ${source.id}: "${quote}"`);
}

const rendered = renderCase(final, sources, today);
await mkdir(outDir, { recursive: true });
const slug = `${final.short.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${final.announced.slice(0, 4)}`;
if (rendered.ok) await writeFile(path.join(outDir, `${slug}.md`), rendered.text);
else problems.push(...rendered.problems);
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

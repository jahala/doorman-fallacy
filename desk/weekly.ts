/**
 * The desk's weekly run. Each stage runs as its own process with a fixed share of the week's
 * budget, so the total can never pass it:
 *   1. sweep the last eight days of news;
 *   2. set aside organisations already in the ledger, or assessed in the last 30 days;
 *   3. assess the strongest new leads;
 *   4. draft and publish each case the assessor recommends;
 *   5. list news about cases in the ledger and cases due for review;
 *   6. write the report, notify, and with --commit, commit and push the new cases.
 *
 *   node desk/weekly.ts --budget 3 [--commit]
 *
 * With --commit the run must start on a clean master; it pulls first, and the pre-push hook
 * runs the checks before anything is pushed. Run it from its own worktree, not one you edit in.
 */
import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { parse } from 'yaml';
import { caseSchema, type Case, type IsoDate } from '../src/data/case-schema.ts';
import { sameOrganisation } from '../src/lib/leads.ts';
import { derivedNextReview, dueForReview } from '../src/lib/review.ts';
import { clusters, type Triaged } from './clusters.ts';
import { runTracked } from './processes.ts';
import { weeklyReport, type WeeklyResult } from './weekly-report.ts';

const run = promisify(execFile);

const { values } = parseArgs({
  options: {
    today: { type: 'string' },
    budget: { type: 'string', default: '3.00' },
    'assess-cap': { type: 'string', default: '0.40' },
    'draft-cap': { type: 'string', default: '0.60' },
    'max-drafts': { type: 'string', default: '2' },
    top: { type: 'string', default: '5' },
    commit: { type: 'boolean', default: false },
  },
});

const today = (values.today ?? new Date().toISOString().slice(0, 10)) as IsoDate;
const budget = Number(values.budget);
const sweepBudget = 0.1;
const draftCap = Number(values['draft-cap']);
const maxDrafts = Number(values['max-drafts']);
const assessCap = Number(values['assess-cap']);
const draftBudget = maxDrafts * draftCap;
const assessTop = Math.max(0, Math.min(Number(values.top), Math.floor((budget - sweepBudget - draftBudget) / assessCap)));
const failures: string[] = [];
const statePath = path.join('.desk-runs', 'weekly-state.json');
const assessedPath = path.join('.desk-runs', 'assessed.json');

interface Assessed {
  name: string;
  date: string;
  recommendation: string;
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

async function knownCases(): Promise<{ slug: string; data: Case }[]> {
  const folder = path.join('src', 'content', 'cases');
  const files = (await readdir(folder)).filter((name) => name.endsWith('.md'));
  const cases: { slug: string; data: Case }[] = [];
  for (const file of files) {
    const text = await readFile(path.join(folder, file), 'utf8');
    const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1];
    const parsed = front === undefined ? null : caseSchema.safeParse(parse(front));
    if (parsed?.success === true) cases.push({ slug: file.replace(/\.md$/, ''), data: parsed.data });
    else failures.push(`case file ${file} does not parse`);
  }
  return cases;
}

async function stage(name: string, args: string[]): Promise<string | null> {
  const ran = await runTracked('node', args, { timeoutMs: 60 * 60_000 });
  if (!ran.ok) {
    failures.push(`${name}: ${ran.message} ${ran.stderr.slice(-300)}`.trim());
    return null;
  }
  return ran.stdout;
}

async function git(args: string[]): Promise<string> {
  const { stdout } = await run('git', args);
  return stdout.trim();
}

// Before anything: a commit run starts from a clean, current master.
if (values.commit) {
  const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const dirty = await git(['status', '--porcelain']);
  if (branch !== 'master' || dirty !== '') {
    console.error(`weekly: --commit needs a clean master; this checkout is on ${branch}${dirty === '' ? '' : ' with changes'}`);
    process.exit(1);
  }
  await git(['pull', '--ff-only']);
}

const state = await readJson<{ lastRun?: string }>(statePath, {});
const late = state.lastRun !== undefined && daysBetween(state.lastRun, today) > 7;
const cases = await knownCases();

// 1. Sweep.
const sweepOut = await stage('sweep', ['desk/sweep.ts', '--size', 'full', '--days', '8', '--sources', 'gnews,gdelt,hn', '--budget', String(sweepBudget), '--today', today]);
const sweepMeta = sweepOut === null ? null : (JSON.parse(sweepOut.slice(sweepOut.indexOf('{'))) as { out: string; unique: number; costUsd: number });
const runDir = sweepMeta?.out ?? path.join('.desk-runs', `${today}-weekly-failed`);
await mkdir(runDir, { recursive: true });

// 2. What is already known.
const assessed = (await readJson<Assessed[]>(assessedPath, [])).filter((entry) => daysBetween(entry.date, today) <= 180);
const recent = assessed.filter((entry) => daysBetween(entry.date, today) <= 30).map((entry) => entry.name);
const caseNames = cases.flatMap((item) => [item.data.company, item.data.short]);
const triaged = sweepMeta === null ? [] : (JSON.parse(await readFile(path.join(runDir, 'leads.json'), 'utf8')) as Triaged[]);
const newsForCases = cases
  .map((item) => ({
    slug: item.slug,
    headlines: clusters(triaged)
      .filter((group) => !group.key.startsWith('unnamed:') && [item.data.company, item.data.short].some((name) => sameOrganisation(name, group.name)))
      .flatMap((group) => group.items.slice(0, 3).map((lead) => `${lead.title} (${lead.outlet}, ${lead.published})`)),
  }))
  .filter((item) => item.headlines.length > 0);

// 3. Assess.
interface AssessSummary {
  organisation: string;
  file: string;
  ok: boolean;
  recommendation: string | null;
  reason: string;
  costUsd: number;
}
let summaries: AssessSummary[] = [];
if (sweepMeta !== null && assessTop > 0) {
  const summaryFile = path.join(runDir, 'assess-summary.json');
  const out = await stage('assess', [
    'desk/assess.ts', '--run', runDir, '--top', String(assessTop), '--budget-each', assessCap.toFixed(2),
    '--budget', (assessTop * assessCap).toFixed(2), '--exclude', [...caseNames, ...recent].join('|'), '--summary', summaryFile,
  ]);
  if (out !== null) summaries = await readJson<AssessSummary[]>(summaryFile, []);
}
for (const summary of summaries.filter((item) => !item.ok)) failures.push(`assess ${summary.organisation}: ${summary.reason.slice(0, 200)}`);

// 4. Draft and publish.
interface DraftSummary {
  organisation: string;
  slug: string;
  published: boolean;
  problems: string[];
  costUsd: number;
}
const drafts: DraftSummary[] = [];
for (const summary of summaries.filter((item) => item.recommendation === 'draft').slice(0, maxDrafts)) {
  const summaryFile = path.join(runDir, `draft-summary-${path.basename(summary.file)}`);
  await stage(`draft ${summary.organisation}`, [
    'desk/draft.ts', '--assessment', summary.file, '--budget', draftCap.toFixed(2), '--budget-each', (draftCap / 2).toFixed(2), '--today', today, '--publish', '--summary', summaryFile,
  ]);
  drafts.push(await readJson<DraftSummary>(summaryFile, { organisation: summary.organisation, slug: '', published: false, problems: ['the draft stage stopped early; see its log'], costUsd: 0 }));
}

// 5. Reviews due.
const reviewsDue = dueForReview(cases.map((item) => ({ ...item.data, slug: item.slug })), today).map((item) => ({ slug: item.slug, due: derivedNextReview(item) ?? today }));

// 6. Commit, then report and remember.
const publishedDrafts = drafts.filter((draft) => draft.published);
if (values.commit && publishedDrafts.length > 0) {
  try {
    await git(['add', ...publishedDrafts.map((draft) => path.join('src', 'content', 'cases', `${draft.slug}.md`))]);
    await git(['commit', '-m', `Desk: publish ${publishedDrafts.map((draft) => draft.organisation).join(', ')}\n\nPublished by the weekly run of ${today}; every case passed the publishing checks in docs/engineering.md.`]);
    await git(['push']);
  } catch (error) {
    failures.push(`commit or push: ${error instanceof Error ? error.message.slice(0, 300) : String(error)}`);
  }
}

const result: WeeklyResult = {
  today,
  late,
  leads: sweepMeta?.unique ?? 0,
  published: publishedDrafts.map((draft) => ({ slug: draft.slug, organisation: draft.organisation })),
  notPublished: drafts.filter((draft) => !draft.published).map((draft) => ({ organisation: draft.organisation, problems: draft.problems })),
  watch: summaries.filter((item) => item.recommendation === 'watch').map((item) => ({ organisation: item.organisation, reason: item.reason })),
  rejected: summaries.filter((item) => item.recommendation === 'reject').map((item) => ({ organisation: item.organisation, reason: item.reason })),
  newsForCases,
  reviewsDue,
  failures,
  costUsd: {
    sweep: sweepMeta?.costUsd ?? 0,
    assess: summaries.reduce((sum, item) => sum + item.costUsd, 0),
    draft: drafts.reduce((sum, draft) => sum + draft.costUsd, 0),
  },
  budgetUsd: budget,
};
const report = weeklyReport(result);
await writeFile(path.join(runDir, 'weekly-report.txt'), report);
await writeFile(assessedPath, `${JSON.stringify([...assessed, ...summaries.filter((item) => item.ok).map((item) => ({ name: item.organisation, date: today, recommendation: item.recommendation ?? '' }))], null, 2)}\n`);
await writeFile(statePath, `${JSON.stringify({ lastRun: today }, null, 2)}\n`);

console.log(report);
const headline = report.split('\n')[0] ?? 'Doorman desk finished';
await run('osascript', ['-e', `display notification ${JSON.stringify(failures.length > 0 ? `${String(failures.length)} failure(s). ${headline}` : headline)} with title "Doorman desk"`]).catch(() => undefined);
process.exit(failures.length > 0 ? 1 : 0);

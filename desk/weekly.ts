/**
 * The desk's weekly run. Each stage runs as its own process with a share of the week's budget,
 * so the total can never pass it:
 *   1. read readers' open suggestions and error reports from D1;
 *   2. sweep the last eight days of news, with the suggested links as leads of their own;
 *   3. set aside organisations already in the ledger, or assessed in the last 30 days;
 *   4. assess the strongest new leads, and every organisation a reader suggested;
 *   5. draft and publish each case the assessor recommends, suggested ones first;
 *   6. review every case in the ledger: news since its last check, the week's news and readers'
 *      links about it, and readers' error reports (desk/review.ts);
 *   7. with --commit, commit and push what changed, mark each suggestion the desk looked at as
 *      resolved, and release the site, so the week's changes go live; write the report and notify.
 *
 *   node desk/weekly.ts --budget 3 [--commit]
 *
 * With --commit the run starts from a clean checkout and moves it to origin/master, and pushes to
 * master; the pre-push hook runs the checks first. Run it from its own worktree, not one you edit in.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { parse } from 'yaml';
import { caseSchema, type Case, type IsoDate } from '../src/data/case-schema.ts';
import { sameOrganisation } from '../src/lib/leads.ts';
import { dueForReview } from '../src/lib/review.ts';
import { fetchPage } from './archive.ts';
import { assessedPath, recentlyAssessed, type Assessed } from './assessed.ts';
import { clusters, type Triaged } from './clusters.ts';
import { runTracked } from './processes.ts';
import { resolveAssessed, resolveReviewed, routeSuggestions } from './suggestion-routing.ts';
import { openSuggestionsSql, readSuggestionRows, resolveSql, type Resolution, type Suggestion } from './suggestion-sql.ts';
import { suggestionLeads, wranglerD1 } from './suggestions.ts';
import { weeklyReport, type ReviewLine, type WeeklyResult } from './weekly-report.ts';

const run = promisify(execFile);

const { values } = parseArgs({
  options: {
    today: { type: 'string' },
    budget: { type: 'string', default: '3.00' },
    'assess-cap': { type: 'string', default: '0.40' },
    'draft-cap': { type: 'string', default: '0.60' },
    'review-cap': { type: 'string', default: '0.30' },
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
const reviewCap = Number(values['review-cap']);
const failures: string[] = [];
const statePath = path.join('.desk-runs', 'weekly-state.json');

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

// Before anything: a commit run starts clean, on what master holds now. A commit an earlier run
// could not push is pushed first, so moving to origin/master never drops it.
if (values.commit) {
  const dirty = await git(['status', '--porcelain']);
  if (dirty !== '') {
    console.error('weekly: --commit needs a clean checkout; this one has changes');
    process.exit(1);
  }
  await git(['fetch', 'origin']);
  if ((await git(['rev-list', 'origin/master..HEAD'])) !== '') await git(['push', 'origin', 'HEAD:master']);
  await git(['checkout', '--detach', 'origin/master']);
}

const state = await readJson<{ lastRun?: string }>(statePath, {});
const late = state.lastRun !== undefined && daysBetween(state.lastRun, today) > 7;
const cases = await knownCases();
const caseNames = cases.map((item) => ({ slug: item.slug, company: item.data.company, short: item.data.short }));

// 1. Readers' suggestions. Only a credited reader's name leaves D1, never an email address.
const d1 = await wranglerD1();
let suggestions: Suggestion[] = [];
const opened = await d1(openSuggestionsSql);
if (opened.ok) {
  const read = readSuggestionRows(opened.rows);
  suggestions = read.suggestions;
  failures.push(...read.problems.map((problem) => `suggestions: ${problem}`));
} else failures.push(`suggestions: ${opened.message}`);
const extraLeads = await suggestionLeads(suggestions, fetchPage);
const extraPath = path.join('.desk-runs', `${today}-suggested-leads.json`);
await mkdir('.desk-runs', { recursive: true });
await writeFile(extraPath, `${JSON.stringify(extraLeads, null, 2)}\n`);

// 2. Sweep.
const sweepOut = await stage('sweep', ['desk/sweep.ts', '--size', 'full', '--days', '8', '--sources', 'gnews,gdelt,hn,deepseek', '--budget', String(sweepBudget), '--today', today, '--extra', extraPath]);
const sweepMeta = sweepOut === null ? null : (JSON.parse(sweepOut.slice(sweepOut.indexOf('{'))) as { out: string; unique: number; costUsd: number });
const runDir = sweepMeta?.out ?? path.join('.desk-runs', `${today}-weekly-failed`);
await mkdir(runDir, { recursive: true });
const triaged = sweepMeta === null ? [] : (JSON.parse(await readFile(path.join(runDir, 'leads.json'), 'utf8')) as Triaged[]);
const routed = routeSuggestions(suggestions, triaged, caseNames);

// 3. What is already known. The week's news about a case goes to its review.
const recent = recentlyAssessed(await readJson<Assessed[]>(assessedPath, []), today);
const groups = clusters(triaged);
const newsLinks = (item: { data: Case }): string[] =>
  groups
    .filter((group) => !group.key.startsWith('unnamed:') && [item.data.company, item.data.short].some((name) => sameOrganisation(name, group.name)))
    .flatMap((group) => group.items.filter((lead) => !lead.url.startsWith('https://news.google.com/')).slice(0, 3).map((lead) => lead.url));

// 4. Assess.
interface AssessSummary {
  organisation: string;
  cluster: string;
  file: string;
  ok: boolean;
  recommendation: string | null;
  reason: string;
  costUsd: number;
}
const forced = [...routed.toAssess.keys()];
const assessTop = Math.max(0, Math.min(Number(values.top), Math.floor((budget - sweepBudget - maxDrafts * draftCap - forced.length * assessCap) / assessCap)));
let summaries: AssessSummary[] = [];
if (sweepMeta !== null && assessTop + forced.length > 0) {
  const summaryFile = path.join(runDir, 'assess-summary.json');
  const out = await stage('assess', [
    'desk/assess.ts', '--run', runDir, '--top', String(assessTop), '--budget-each', assessCap.toFixed(2),
    '--budget', ((assessTop + forced.length) * assessCap).toFixed(2), '--exclude', [...caseNames.flatMap((item) => [item.company, item.short]), ...recent].join('|'),
    '--include', forced.join('|'), '--summary', summaryFile, '--today', today,
  ]);
  if (out !== null) summaries = await readJson<AssessSummary[]>(summaryFile, []);
}
for (const summary of summaries.filter((item) => !item.ok)) failures.push(`assess ${summary.organisation}: ${summary.reason.slice(0, 200)}`);

// 5. Draft and publish, suggested organisations first, crediting a reader who asked to be named.
interface DraftSummary {
  organisation: string;
  slug: string;
  published: boolean;
  problems: string[];
  costUsd: number;
}
const creditFor = (cluster: string): string | null =>
  (routed.toAssess.get(cluster) ?? []).map((id) => suggestions.find((item) => item.id === id)?.creditName ?? null).find((name) => name !== null) ?? null;
const toDraft = summaries.filter((item) => item.recommendation === 'draft').sort((a, b) => Number(routed.toAssess.has(b.cluster)) - Number(routed.toAssess.has(a.cluster)));
const drafts: DraftSummary[] = [];
const drafted = new Map<string, { published: boolean }>();
for (const summary of toDraft.slice(0, maxDrafts)) {
  const summaryFile = path.join(runDir, `draft-summary-${path.basename(summary.file)}`);
  const credit = creditFor(summary.cluster);
  await stage(`draft ${summary.organisation}`, [
    'desk/draft.ts', '--assessment', summary.file, '--budget', draftCap.toFixed(2), '--budget-each', (draftCap / 2).toFixed(2), '--today', today, '--publish', '--summary', summaryFile,
    ...(credit === null ? [] : ['--suggested-by', credit]),
  ]);
  const result = await readJson<DraftSummary>(summaryFile, { organisation: summary.organisation, slug: '', published: false, problems: ['the draft stage stopped early; see its log'], costUsd: 0 });
  drafts.push(result);
  drafted.set(summary.cluster, { published: result.published });
}

// 6. Review every case, with what is left of the budget: cases with readers' reports first, then
// those with links to read, then those due by the schedule, then the rest, whose searches may
// still find news. A reader's report goes to the review in a temporary folder this run removes.
interface ReviewSummary extends ReviewLine {
  reviewed: boolean;
  reports: { id: number; outcome: 'corrected' | 'no-change' }[];
  costUsd: number;
}
const due = new Set(dueForReview(cases.map((item) => ({ ...item.data, slug: item.slug })), today).map((item) => item.slug));
const links = new Map(cases.map((item) => [item.slug, [...new Set([...newsLinks(item), ...(routed.linksForCase.get(item.slug) ?? [])])]]));
const rank = (slug: string): number => (routed.reportsForCase.has(slug) ? 0 : (links.get(slug) ?? []).length > 0 ? 1 : due.has(slug) ? 2 : 3);
const order = [...cases].sort((a, b) => rank(a.slug) - rank(b.slug));
const spentBefore = (sweepMeta?.costUsd ?? 0) + summaries.reduce((sum, item) => sum + item.costUsd, 0) + drafts.reduce((sum, item) => sum + item.costUsd, 0);
const reviews = new Map<string, ReviewSummary>();
const private_ = await mkdtemp(path.join(os.tmpdir(), 'doorman-reports-'));
try {
  for (const item of order) {
    const spent = spentBefore + [...reviews.values()].reduce((sum, review) => sum + review.costUsd, 0);
    if (budget - spent < reviewCap) {
      failures.push(`reviews: the budget ran out before ${item.slug}`);
      break;
    }
    const summaryFile = path.join(runDir, `review-summary-${item.slug}.json`);
    const reportsFile = path.join(private_, `${item.slug}.json`);
    const reports = routed.reportsForCase.get(item.slug) ?? [];
    if (reports.length > 0) await writeFile(reportsFile, JSON.stringify(reports));
    await stage(`review ${item.slug}`, [
      'desk/review.ts', '--case', item.slug, '--budget', reviewCap.toFixed(2), '--today', today, '--run', runDir, '--publish', '--summary', summaryFile,
      '--links', (links.get(item.slug) ?? []).join(','), ...(due.has(item.slug) ? ['--due'] : []), ...(reports.length > 0 ? ['--reports', reportsFile] : []),
    ]);
    reviews.set(item.slug, await readJson<ReviewSummary>(summaryFile, { slug: item.slug, reviewed: false, written: false, added: 0, removed: 0, corrections: [], problems: ['the review stopped early; see its log'], reports: [], costUsd: 0 }));
  }
} finally {
  await rm(private_, { recursive: true, force: true });
}

// 7. Commit and push, then resolve the suggestions the desk looked at. Nothing is resolved unless
// what it led to is on master.
const publishedDrafts = drafts.filter((draft) => draft.published);
const reviewed = [...reviews.values()].filter((review) => review.written);
const changed = (await git(['status', '--porcelain', '--', path.join('src', 'content', 'cases')])).split('\n').filter((line) => line !== '').map((line) => line.slice(3));
let landed = !values.commit ? false : changed.length === 0;
if (values.commit && changed.length > 0) {
  try {
    await git(['add', '--', ...changed]);
    const lines = [
      ...publishedDrafts.map((draft) => `- Published ${draft.organisation}.`),
      ...reviewed.map((review) => `- Reviewed ${review.slug}: ${String(review.added)} added, ${String(review.removed)} removed${review.corrections.length > 0 ? `, ${String(review.corrections.length)} corrected` : ''}.`),
    ];
    await git(['commit', '-m', `Desk: weekly run of ${today}\n\n${lines.join('\n')}\n\nEvery new statement passed the publishing checks in docs/engineering.md.`]);
    await git(['push', 'origin', 'HEAD:master']);
    landed = true;
  } catch (error) {
    failures.push(`commit or push: ${error instanceof Error ? error.message.slice(0, 300) : String(error)}`);
  }
}
const resolutions: Resolution[] = [...routed.resolved, ...resolveAssessed(routed.toAssess, summaries, drafted), ...resolveReviewed(routed.toCase, routed.reportsForCase, reviews)];
if (landed) {
  const built = resolveSql(resolutions, new Date().toISOString());
  if (!built.ok) failures.push(`suggestions: ${built.problem}`);
  else if (built.sql !== null) {
    const resolved = await d1(built.sql);
    if (!resolved.ok) failures.push(`suggestions: could not mark resolved: ${resolved.message}`);
  }
}
const resolvedCount = landed ? resolutions.length : 0;

// Release what landed, from this checkout, which now matches master. The release runs every check
// again and stops at the first failure, so a bad week never reaches the site.
let release: WeeklyResult['release'] = !values.commit ? 'not-a-commit-run' : 'nothing-to-release';
if (values.commit && landed && changed.length > 0) {
  const ran = await runTracked('npm', ['run', 'release'], { timeoutMs: 30 * 60_000 });
  release = ran.ok ? 'released' : 'failed';
  if (!ran.ok) failures.push(`release: ${ran.message} ${ran.stderr.slice(-300)}`.trim());
}

const result: WeeklyResult = {
  today,
  late,
  leads: sweepMeta?.unique ?? 0,
  published: publishedDrafts.map((draft) => ({ slug: draft.slug, organisation: draft.organisation })),
  notPublished: drafts.filter((draft) => !draft.published).map((draft) => ({ organisation: draft.organisation, problems: draft.problems })),
  watch: summaries.filter((item) => item.recommendation === 'watch').map((item) => ({ organisation: item.organisation, reason: item.reason })),
  rejected: summaries.filter((item) => item.recommendation === 'reject').map((item) => ({ organisation: item.organisation, reason: item.reason })),
  reviews: [...reviews.values()].filter((review) => review.reviewed || review.problems.length > 0),
  suggestions: { resolved: resolvedCount, open: suggestions.length - resolvedCount },
  release,
  failures,
  costUsd: {
    sweep: sweepMeta?.costUsd ?? 0,
    assess: summaries.reduce((sum, item) => sum + item.costUsd, 0),
    draft: drafts.reduce((sum, draft) => sum + draft.costUsd, 0),
    review: [...reviews.values()].reduce((sum, review) => sum + review.costUsd, 0),
  },
  budgetUsd: budget,
};
const report = weeklyReport(result);
await writeFile(path.join(runDir, 'weekly-report.txt'), report);
await writeFile(statePath, `${JSON.stringify({ lastRun: today }, null, 2)}\n`);

console.log(report);
const headline = report.split('\n')[0] ?? 'Doorman desk finished';
await run('osascript', ['-e', `display notification ${JSON.stringify(failures.length > 0 ? `${String(failures.length)} failure(s). ${headline}` : headline)} with title "Doorman desk"`]).catch(() => undefined);
process.exit(failures.length > 0 ? 1 : 0);

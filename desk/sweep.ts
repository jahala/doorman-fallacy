/**
 * The desk's sweep: fetch news leads, merge duplicates, triage each with Jev, group by
 * organisation, and write a report. Unconfirmed leads are claims about named companies,
 * so runs are written to .desk-runs/ (ignored by git) and never committed.
 *
 *   node desk/sweep.ts --size small --days 7 --budget 0.25
 *   node desk/sweep.ts --size full --days 30 --sources gnews,gdelt,hn --budget 1
 *   node desk/sweep.ts --days 1100 --query 'Klarna AI customer service' --query '...' --budget 0.30
 */
import { execFile } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { dedupeLeads, type Lead, type RawLead } from '../src/lib/leads.ts';
import { createBudget } from './budget.ts';
import { createJevDoor } from './jev.ts';
import { fullQueries, smallQueries } from './queries.ts';
import { gdelt, googleNews, hackerNews, type Fetched } from './sources.ts';
import { clusters, type Cluster, type Triaged } from './clusters.ts';
import { kinds, leadState, readTriage, triageQuestions } from './triage.ts';

const runRoot = '.desk-runs';
const keepRunsDays = 30;
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const { values } = parseArgs({
  options: {
    size: { type: 'string', default: 'small' },
    days: { type: 'string', default: '7' },
    sources: { type: 'string', default: 'gnews' },
    budget: { type: 'string', default: '0.25' },
    limit: { type: 'string', default: '2000' },
    today: { type: 'string' },
    model: { type: 'string', default: 'jev-latest' },
    // Searches of your own, in place of the standard set: a backfill of named organisations, over a long window.
    query: { type: 'string', multiple: true },
  },
});

const today = values.today ?? new Date().toISOString().slice(0, 10);
const days = Number(values.days);
const budget = Number(values.budget);
const limit = Number(values.limit);
const sources = values.sources.split(',');
const queries =
  values.query === undefined
    ? values.size === 'full'
      ? fullQueries
      : smallQueries
    : values.query.map((query) => ({ query, edition: 'en' as const }));
const label = values.query === undefined ? values.size : 'backfill';
const runBudget = createBudget(budget);
const outDir = path.join(runRoot, `${today}-${label}-${String(days)}d-${Date.now().toString(36)}`);

/** Runs older than the retention window are moved to the Trash, so .desk-runs/ cannot grow without end. */
async function pruneOldRuns(): Promise<string[]> {
  const cutoff = Date.parse(today) - keepRunsDays * 86_400_000;
  const entries = await readdir(runRoot).catch(() => []);
  const old = entries.filter((name) => {
    const date = Date.parse(name.slice(0, 10));
    return !Number.isNaN(date) && date < cutoff;
  });
  if (old.length > 0) await promisify(execFile)('trash', old.map((name) => path.join(runRoot, name)));
  return old;
}

async function fetchAll(): Promise<{ leads: RawLead[]; failures: Extract<Fetched, { ok: false }>[] }> {
  const leads: RawLead[] = [];
  const failures: Extract<Fetched, { ok: false }>[] = [];
  const nowSeconds = Math.floor(Date.now() / 1000);
  for (const { query, edition } of queries) {
    const batch: Promise<Fetched>[] = [];
    if (sources.includes('gnews')) batch.push(googleNews(query, days, edition));
    if (sources.includes('hn') && edition === 'en') batch.push(hackerNews(query, days, nowSeconds));
    for (const result of await Promise.all(batch)) {
      if (result.ok) leads.push(...result.leads);
      else failures.push(result);
    }
    if (sources.includes('gdelt')) {
      // GDELT asks for at most one request every five seconds.
      const result = await gdelt(query, days, edition, sleep);
      if (result.ok) leads.push(...result.leads);
      else failures.push(result);
      await sleep(5500);
    }
  }
  return { leads, failures };
}

async function triageAll(leads: readonly Lead[]): Promise<{ triaged: Triaged[]; door: ReturnType<typeof createJevDoor>; model: string }> {
  const door = createJevDoor({ budget: runBudget, model: values.model, sleep });
  const triaged: Triaged[] = new Array<Triaged>(leads.length);
  let next = 0;
  let model = values.model;
  const worker = async (): Promise<void> => {
    for (let index = next++; index < leads.length; index = next++) {
      const lead = leads[index];
      if (lead === undefined) continue;
      const result = await door.ask(leadState(lead), triageQuestions(lead));
      if (result.ok) {
        model = result.model;
        triaged[index] = { ...lead, triage: readTriage(result.answers) };
      } else {
        triaged[index] = { ...lead, triage: null, error: `${result.reason}: ${result.message}` };
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return { triaged, door, model };
}

function cell(text: string): string {
  return text.replace(/\|/g, '/').replace(/\s+/g, ' ');
}

function report(all: readonly Triaged[], groups: readonly Cluster[], meta: Record<string, unknown>): string {
  const line = (group: Cluster): string => {
    const top = group.items[0];
    const kindsSeen = [...new Set(group.items.map((item) => item.triage?.kind))].join(', ');
    const biggest = Math.max(...group.items.map((item) => item.triage?.headcount ?? 0));
    const size = biggest > 0 ? biggest.toLocaleString('en-GB') : 'not stated';
    const t = top?.triage;
    return `| ${cell(group.name)} | ${group.best.toFixed(2)} | ${(t?.isCase ?? 0).toFixed(2)} | ${kindsSeen} | ${t?.mechanism ?? ''} | ${t?.roleType ?? ''} | ${size} | ${t?.whoLinksAi ?? ''} | ${String(group.items.length)} | [${cell(top?.title ?? '')}](${top?.url ?? ''}) |`;
  };
  const header =
    '| Organisation | Doorman priority | p(case) | Kinds | Mechanism | Roles | Largest headcount | Who links AI | Articles | Top headline |\n|---|---|---|---|---|---|---|---|---|---|';
  const named = groups.filter((group) => !group.key.startsWith('unnamed:'));
  const likely = named.filter((group) => group.best >= 0.4);
  const maybe = named.filter((group) => group.best >= 0.1 && group.best < 0.4);
  const byKind = Object.keys(kinds)
    .map((kind) => `| ${kind} | ${String(all.filter((item) => item.triage?.kind === kind).length)} |`)
    .join('\n');
  return [
    `# Sweep ${String(meta.today)} (${String(meta.size)}, last ${String(meta.days)} days)`,
    '',
    'Unconfirmed leads. Nothing here has been checked against its sources.',
    '',
    '```json',
    JSON.stringify(meta, null, 2),
    '```',
    '',
    `## Strong doorman candidates (${String(likely.length)} organisations)`,
    '',
    header,
    ...likely.map(line),
    '',
    `## Weaker candidates (${String(maybe.length)} organisations)`,
    '',
    header,
    ...maybe.map(line),
    '',
    '## Leads by kind',
    '',
    '| Kind | Leads |\n|---|---|',
    byKind,
    '',
  ].join('\n');
}

const started = Date.now();
const pruned = await pruneOldRuns();
const fetched = await fetchAll();
const fetchedAt = Date.now();
const unique = dedupeLeads(fetched.leads).slice(0, limit);
const { triaged, door, model } = await triageAll(unique);
const finished = Date.now();
const groups = clusters(triaged);

const meta = {
  today,
  size: label,
  days,
  sources,
  queries: queries.length,
  model,
  fetched: fetched.leads.length,
  unique: unique.length,
  triaged: triaged.filter((item) => item.triage !== null).length,
  failedTriage: triaged.filter((item) => item.triage === null).length,
  fetchFailures: fetched.failures,
  costUsd: Number(door.spentUsd().toFixed(5)),
  budgetUsd: budget,
  calls: runBudget.calls(),
  seconds: { fetch: Math.round((fetchedAt - started) / 1000), triage: Math.round((finished - fetchedAt) / 1000) },
  prunedRuns: pruned,
};

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'leads.json'), `${JSON.stringify(triaged, null, 2)}\n`);
await writeFile(path.join(outDir, 'report.md'), report(triaged, groups, meta));
await writeFile(path.join(outDir, 'run.json'), `${JSON.stringify(meta, null, 2)}\n`);
console.log(JSON.stringify({ out: outDir, ...meta, fetchFailures: meta.fetchFailures.length }, null, 2));

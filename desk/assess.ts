/**
 * The desk's assessment: for the strongest organisations in a sweep, a Claude agent
 * researches the lead and judges how well it fits the doorman fallacy (desk/prompts/assess.md).
 * Each quote the agent returns is then checked against the live page, word for word.
 *
 *   node desk/assess.ts --run .desk-runs/<run> --top 3 --budget-each 0.40 --budget 1.50
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { quoteFound } from '../src/lib/quotes.ts';
import { createBudget } from './budget.ts';
import { askClaude } from './claude.ts';
import { sameOrganisation } from '../src/lib/leads.ts';
import { assessable, clusters, readableFirst, type Cluster, type Triaged } from './clusters.ts';

const { values } = parseArgs({
  options: {
    run: { type: 'string' },
    top: { type: 'string', default: '3' },
    'budget-each': { type: 'string', default: '0.40' },
    budget: { type: 'string', default: '1.50' },
    model: { type: 'string', default: 'sonnet' },
    concurrency: { type: 'string', default: '3' },
    only: { type: 'string' },
    exclude: { type: 'string' },
    summary: { type: 'string' },
  },
});

async function latestRun(): Promise<string> {
  const runs = (await readdir('.desk-runs')).sort();
  const last = runs.at(-1);
  if (last === undefined) throw new Error('no runs in .desk-runs');
  return path.join('.desk-runs', last);
}

interface Source {
  id: string;
  kind: string;
  url: string;
  publisher: string;
  title: string;
  published: string | null;
  /** Model output, so it may be missing or null. */
  quote: string | null;
}

interface Assessment {
  organisation: string;
  event: string;
  door: string | null;
  mechanism: string;
  status: string;
  hidden_work: { function: string; basis: string }[];
  /** Model output, so it may be missing. */
  sources?: Source[];
  doorman_fit: number;
  fit_reason: string;
  recommendation: string;
}

interface Outcome {
  cluster: string;
  ok: boolean;
  costUsd: number;
  seconds: number;
  assessment?: Assessment;
  quoteChecks?: { id: string; url: string; fetched: boolean; found: boolean }[];
  error?: string;
}

function leadText(cluster: Cluster): string {
  const items = readableFirst(cluster.items).slice(0, 8).map((item: Triaged) => ({
    headline: item.title,
    outlet: item.outlet,
    published: item.published,
    url: item.url,
  }));
  const organisation = cluster.key.startsWith('unnamed:') ? 'not named in the headline; find it from the story' : cluster.name;
  return JSON.stringify({ organisation, news_items: items }, null, 2);
}

function lastJsonFence(text: string): unknown {
  const fences = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  const body = fences.at(-1)?.[1];
  if (body === undefined) return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

async function pageText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15' },
      signal: AbortSignal.timeout(20_000),
    });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

const budget = createBudget(Number(values.budget));

async function assess(cluster: Cluster, prompt: string): Promise<Outcome> {
  const started = Date.now();
  const result = await askClaude(`${prompt}\n\n${leadText(cluster)}\n`, {
    budget,
    capUsd: Number(values['budget-each']),
    model: values.model,
    allowedTools: ['WebSearch', 'WebFetch'],
  });
  const seconds = Math.round((Date.now() - started) / 1000);
  if (!result.ok) return { cluster: cluster.name, ok: false, costUsd: result.costUsd, seconds, error: `${result.reason}: ${result.message}` };
  const costUsd = result.costUsd;
  const assessment = lastJsonFence(result.text) as Assessment | null;
  if (assessment === null) return { cluster: cluster.name, ok: false, costUsd, seconds, error: result.text.slice(-400) };
  // The answer is model output: a malformed one fails this organisation only, keeping what it cost.
  try {
    const quoteChecks = await Promise.all(
      (assessment.sources ?? []).map(async (source) => {
        const html = await pageText(source.url);
        const quote = typeof source.quote === 'string' ? source.quote : '';
        return { id: source.id, url: source.url, fetched: html !== null, found: html !== null && quoteFound(quote, html) };
      }),
    );
    return { cluster: cluster.name, ok: true, costUsd, seconds, assessment, quoteChecks };
  } catch (error) {
    return { cluster: cluster.name, ok: false, costUsd, seconds, error: `malformed assessment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

const runDir = values.run ?? (await latestRun());
const triaged = JSON.parse(await readFile(path.join(runDir, 'leads.json'), 'utf8')) as Triaged[];
const prompt = await readFile(path.join(import.meta.dirname, 'prompts', 'assess.md'), 'utf8');
const only = values.only?.split(',').map((name) => name.trim().toLowerCase());
// Organisations already in the ledger, or assessed recently, are left to the review step.
const excluded = (values.exclude ?? '').split('|').map((name) => name.trim()).filter((name) => name !== '');
const chosen = clusters(triaged)
  .filter(assessable)
  .filter((cluster) => only === undefined || only.includes(cluster.key))
  .filter((cluster) => !excluded.some((name) => sameOrganisation(name, cluster.name)))
  .slice(0, Number(values.top));

const outcomes: Outcome[] = new Array<Outcome>(chosen.length);
let next = 0;
const worker = async (): Promise<void> => {
  for (let index = next++; index < chosen.length; index = next++) {
    const cluster = chosen[index];
    if (cluster !== undefined) outcomes[index] = await assess(cluster, prompt);
  }
};
await Promise.all(Array.from({ length: Number(values.concurrency) }, worker));

const outDir = path.join(runDir, 'assessments');
await mkdir(outDir, { recursive: true });
const fileOf = (outcome: Outcome): string =>
  path.join(outDir, `${outcome.cluster.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.json`);
for (const outcome of outcomes) {
  await writeFile(fileOf(outcome), `${JSON.stringify(outcome, null, 2)}\n`);
}

const rows = outcomes.map((outcome) => {
  const a = outcome.assessment;
  const checks = outcome.quoteChecks ?? [];
  const verified = `${String(checks.filter((check) => check.found).length)}/${String(checks.length)} (${String(checks.filter((check) => !check.fetched).length)} unreadable)`;
  if (a === undefined) return `| ${outcome.cluster} | failed | | | | | | $${outcome.costUsd.toFixed(2)} | ${String(outcome.seconds)}s |`;
  const hidden = a.hidden_work.map((point) => `${point.function} (${point.basis})`).join(', ');
  return `| ${a.organisation} | ${String(a.doorman_fit)} | ${a.recommendation} | ${a.status} | ${a.mechanism} | ${(a.door ?? '').replace(/\|/g, '/')} | ${hidden} | ${verified} | $${outcome.costUsd.toFixed(2)} | ${String(outcome.seconds)}s |`;
});
const totalCost = outcomes.reduce((sum, outcome) => sum + outcome.costUsd, 0);
const reportText = [
  `# Assessments for ${runDir}`,
  '',
  'Unconfirmed. Quote checks fetch each source and look for the quote word for word.',
  '',
  '| Organisation | Fit | Recommendation | Status | Mechanism | Door | Hidden work | Quotes found | Cost | Time |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rows,
  '',
  `Total cost: $${totalCost.toFixed(2)}`,
  '',
  ...outcomes.flatMap((outcome) => (outcome.assessment === undefined ? [] : [`**${outcome.assessment.organisation}**: ${outcome.assessment.fit_reason}`, ''])),
].join('\n');
await writeFile(path.join(runDir, 'assess-report.md'), reportText);
console.log(reportText);
if (values.summary !== undefined) {
  const summary = outcomes.map((outcome) => ({
    organisation: outcome.assessment?.organisation ?? outcome.cluster,
    cluster: outcome.cluster,
    file: fileOf(outcome),
    ok: outcome.ok,
    fit: outcome.assessment?.doorman_fit ?? null,
    recommendation: outcome.assessment?.recommendation ?? null,
    reason: outcome.assessment?.fit_reason ?? outcome.error ?? '',
    costUsd: outcome.costUsd,
  }));
  await writeFile(values.summary, `${JSON.stringify(summary, null, 2)}\n`);
}

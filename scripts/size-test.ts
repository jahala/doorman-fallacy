import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { makeBuildFolder, startCasesBuild } from './cases-build.ts';
import type { GroupRun } from './site-harness.ts';
import { syntheticCase } from './size-cases.ts';

/**
 * The size test (docs/engineering.md): builds the site from 500 generated cases and checks that
 * the ledger page stays within its weight budget. Everything it makes lives in one temporary
 * folder that this run owns and removes on every ending: success, failure, Ctrl-C or SIGTERM.
 *
 * `--cases N` builds N cases instead, with no budget check. The cleanup test uses it to keep its runs short.
 */

const root = path.resolve(import.meta.dirname, '..');

/** How many cases the test builds, and the number the budget is set for. */
const budgetCases = 500;

/**
 * The most the ledger page may weigh at 500 cases, in bytes: 1.5 times the size first measured
 * (439,916 bytes on 2026-10-19). Raise it only by a decision, with the reason in decisions.md.
 */
const ledgerBudgetBytes = 659_874;

function parseCount(argv: readonly string[]): number {
  const at = argv.indexOf('--cases');
  if (at === -1) return budgetCases;
  const count = Number(argv[at + 1]);
  if (!Number.isInteger(count) || count < 1) throw new Error('--cases takes a whole number of at least 1');
  return count;
}

async function main(count: number): Promise<number> {
  const work = await makeBuildFolder(root, 'size');
  let run: GroupRun | undefined;
  let stopped: NodeJS.Signals | undefined;
  // Read through a function: a signal can arrive at any await, which type narrowing cannot see.
  const stoppedBy = (): NodeJS.Signals | undefined => stopped;

  const onSignal = (signal: NodeJS.Signals): void => {
    stopped = signal;
    run?.stop(signal);
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(signal, onSignal);

  try {
    console.log(`size-test: working in ${work}`);
    const casesDir = path.join(work, 'cases');
    const outDir = path.join(work, 'dist');
    await mkdir(casesDir);
    for (let n = 1; n <= count; n += 1) {
      const { fileName, text } = syntheticCase(n);
      await writeFile(path.join(casesDir, fileName), text);
    }
    if (stoppedBy() !== undefined) return 130;

    const started = performance.now();
    run = startCasesBuild({ root, casesDir, outDir, cacheDir: path.join(work, 'cache') });
    console.log(`size-test: building ${String(count)} cases`);
    const exitCode = await run.exited;
    const seconds = (performance.now() - started) / 1000;
    if (stoppedBy() !== undefined) return 130;
    if (exitCode !== 0) {
      console.error(run.output());
      console.error(`size-test: the build failed with exit code ${String(exitCode)}`);
      return 1;
    }

    const ledger = await readFile(path.join(outDir, 'ledger', 'index.html'));
    const rows = (ledger.toString('utf8').match(/<tbody[\s>][\s\S]*<\/tbody>/)?.[0].match(/<tr[\s>]/g) ?? []).length;
    const bytes = (await stat(path.join(outDir, 'ledger', 'index.html'))).size;
    const gzipped = gzipSync(ledger).length;

    console.log(`size-test: ${String(count)} cases built in ${seconds.toFixed(1)} s`);
    console.log(`size-test: /ledger/index.html is ${String(bytes)} bytes (${String(gzipped)} gzipped), ${String(rows)} rows`);

    if (rows !== count) {
      console.error(`size-test: the ledger page has ${String(rows)} rows, not ${String(count)}`);
      return 1;
    }
    if (count !== budgetCases) return 0;
    if (bytes > ledgerBudgetBytes) {
      console.error(`size-test: over budget. The ledger page may weigh ${String(ledgerBudgetBytes)} bytes at ${String(budgetCases)} cases.`);
      return 1;
    }
    console.log(`size-test: within the budget of ${String(ledgerBudgetBytes)} bytes`);
    return 0;
  } finally {
    // This run made `work`, so removing it recursively is the one deletion a run may do itself.
    await rm(work, { recursive: true, force: true });
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.off(signal, onSignal);
  }
}

process.exit(await main(parseCount(process.argv.slice(2))));

/**
 * Measures how well Jev applies the doorman reading's rule (`readingQuestion` in
 * desk/statement-check.ts) against hand labels. Reads points.json in the research folder, writes
 * results.json beside it, and prints which labelled points pass at each threshold.
 *
 *   node scripts/jev-reading-check.ts --budget 0.02
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { hiddenFunctions, type HiddenFunctionId } from '../src/data/hidden-functions.ts';
import { createBudget } from '../desk/budget.ts';
import { createJevDoor, type JevAnswer } from '../desk/jev.ts';
import { readingQuestion } from '../desk/statement-check.ts';

interface Point {
  readonly id: string;
  readonly function: HiddenFunctionId;
  readonly evidence: string;
  readonly label: 'yes' | 'borderline' | 'no';
}

const { values } = parseArgs({
  options: {
    folder: { type: 'string', default: 'docs/research/2026-11-11-jev-reading' },
    budget: { type: 'string', default: '0.02' },
    model: { type: 'string', default: 'jev-latest' },
  },
});

const folder = path.resolve(values.folder);
const points = JSON.parse(await readFile(path.join(folder, 'points.json'), 'utf8')) as Point[];
const budget = createBudget(Number(values.budget));
const door = createJevDoor({ budget, model: values.model, sleep: (ms) => new Promise((done) => setTimeout(done, ms)) });

const results = await Promise.all(
  points.map(async (point) => {
    const kind = hiddenFunctions[point.function];
    const answer = await door.ask({ kind: kind.label, meaning: kind.meaning, evidence: point.evidence }, readingQuestion);
    const missing = answer.ok ? (answer.answers.missing as Extract<JevAnswer, { type: 'noul' }> | undefined) : undefined;
    return { id: point.id, label: point.label, p: missing?.noul ?? null, evidence: point.evidence };
  }),
);
await writeFile(path.join(folder, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);

for (const result of [...results].sort((a, b) => (b.p ?? 0) - (a.p ?? 0))) {
  console.log(`${(result.p ?? -1).toFixed(2)}  ${result.label.padEnd(10)}  ${result.id}`);
}
for (const threshold of [0.3, 0.4, 0.5, 0.6, 0.7]) {
  const kept = (label: string): number => results.filter((result) => result.label === label && (result.p ?? 0) >= threshold).length;
  console.log(`at ${threshold.toFixed(1)}: keeps ${String(kept('yes'))}/6 yes, ${String(kept('borderline'))}/4 borderline, ${String(kept('no'))}/23 no`);
}
console.log(`spent $${budget.spent().toFixed(5)}`);

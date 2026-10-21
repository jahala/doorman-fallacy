/**
 * Measures how well the statement check (desk/statement-check.ts) tells a faithful statement from a
 * false one when the cited sentence is in Norwegian or Danish, against English as the control.
 * Reads pairs.json in the research folder, asks Jev the drafting step's own question for each pair,
 * writes results.json beside it and prints, per language, where true and false pairs fall.
 *
 *   node scripts/jev-language-check.ts --budget 0.05
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createBudget } from '../desk/budget.ts';
import { createJevDoor, type JevAnswer } from '../desk/jev.ts';
import { statementQuestions, supportedThreshold } from '../desk/statement-check.ts';

interface Pair {
  readonly id: string;
  readonly language: string;
  readonly want: boolean;
  readonly statement: string;
  readonly quote: string;
  readonly source: Record<string, string>;
}

const { values } = parseArgs({
  options: {
    folder: { type: 'string', default: 'docs/research/2026-10-21-jev-languages' },
    budget: { type: 'string', default: '0.05' },
    model: { type: 'string', default: 'jev-latest' },
  },
});

const folder = path.resolve(values.folder);
const pairs = JSON.parse(await readFile(path.join(folder, 'pairs.json'), 'utf8')) as Pair[];
const budget = createBudget(Number(values.budget));
const door = createJevDoor({ budget, model: values.model, sleep: (ms) => new Promise((done) => setTimeout(done, ms)) });

const results: { id: string; language: string; want: boolean; p: number | null; error?: string }[] = [];
let next = 0;
const worker = async (): Promise<void> => {
  for (let index = next++; index < pairs.length; index = next++) {
    const pair = pairs[index];
    if (pair === undefined) continue;
    const answer = await door.ask({ statement: pair.statement, quote: pair.quote, source: pair.source }, statementQuestions);
    const supported = answer.ok ? (answer.answers.supported as Extract<JevAnswer, { type: 'noul' }> | undefined) : undefined;
    results[index] = { id: pair.id, language: pair.language, want: pair.want, p: supported?.noul ?? null, ...(answer.ok ? {} : { error: answer.message }) };
  }
};
await Promise.all(Array.from({ length: 6 }, worker));
await writeFile(path.join(folder, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);

const fmt = (values: readonly number[]): string => values.map((value) => value.toFixed(2)).join(' ');
for (const language of [...new Set(results.map((result) => result.language))]) {
  const of = (want: boolean): number[] =>
    results.filter((result) => result.language === language && result.want === want && result.p !== null).map((result) => result.p ?? 0).sort((a, b) => a - b);
  const trues = of(true);
  const falses = of(false);
  const passedTrue = trues.filter((p) => p >= supportedThreshold).length;
  const passedFalse = falses.filter((p) => p >= supportedThreshold).length;
  console.log(`${language}: true ${fmt(trues)}\n    false ${fmt(falses)}`);
  console.log(`    at ${String(supportedThreshold)}: ${String(passedTrue)}/${String(trues.length)} true pass, ${String(passedFalse)}/${String(falses.length)} false pass; gap: lowest true ${(trues[0] ?? 0).toFixed(2)}, highest false ${(falses.at(-1) ?? 0).toFixed(2)}`);
}
const errors = results.filter((result) => result.p === null);
if (errors.length > 0) console.log(`errors: ${String(errors.length)}`);
console.log(`spent $${budget.spent().toFixed(5)}`);

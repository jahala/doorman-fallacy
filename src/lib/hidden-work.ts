import { hiddenFunctionIds, type HiddenFunctionId } from '../data/hidden-functions.ts';
import { newestFirst, type CaseEntry } from './ledger.ts';

/** One case that records a kind of hidden work as missing, as the hidden function's page lists it. */
export interface MissingCase {
  readonly slug: string;
  readonly short: string;
  readonly href: string;
  readonly change: string;
  /** The evidence sentence of each point of the case's doorman reading that names this function. */
  readonly evidence: readonly string[];
}

/** Every case whose doorman reading names the function, newest announcement first, each case once. */
export function casesMissing(entries: readonly CaseEntry[], id: HiddenFunctionId): MissingCase[] {
  return newestFirst(entries).flatMap((entry) => {
    const evidence = entry.data.missed.filter((point) => point.function === id).map((point) => point.evidence);
    return evidence.length === 0
      ? []
      : [{ slug: entry.id, short: entry.data.short, href: `/ledger/${entry.id}`, change: entry.data.change, evidence }];
  });
}

export interface MissingCount {
  readonly id: HiddenFunctionId;
  readonly count: number;
}

/** For each hidden function, in vocabulary order, how many cases record it as missing. Zero counts are kept. */
export function missingCounts(entries: readonly CaseEntry[]): MissingCount[] {
  return hiddenFunctionIds.map((id) => ({ id, count: casesMissing(entries, id).length }));
}

export interface Neighbours {
  readonly previous: HiddenFunctionId | null;
  readonly next: HiddenFunctionId | null;
}

/** The functions either side of this one in the vocabulary order. The six do not loop. */
export function neighbours(id: HiddenFunctionId): Neighbours {
  const at = hiddenFunctionIds.indexOf(id);
  return { previous: hiddenFunctionIds[at - 1] ?? null, next: hiddenFunctionIds[at + 1] ?? null };
}

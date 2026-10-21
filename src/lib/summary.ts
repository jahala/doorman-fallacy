import type { HiddenFunctionId } from '../data/hidden-functions.ts';
import { hiddenFunctions } from '../data/hidden-functions.ts';
import { statusIds, statuses } from '../data/statuses.ts';
import { missingCounts } from './hidden-work.ts';
import { countLabel, type CaseEntry } from './ledger.ts';
import { currentStatus } from './status.ts';

export interface MissingLink {
  readonly id: HiddenFunctionId;
  readonly label: string;
  readonly count: number;
  readonly href: string;
}

export interface LedgerSummary {
  /** "5 cases: 2 holding, 1 strained." Only statuses that have cases are listed. */
  readonly sentence: string;
  /** The hidden work recorded as missing, above zero only, in vocabulary order. */
  readonly missing: MissingLink[];
}

/** What the whole ledger shows at a glance, worked out from the cases. */
export function ledgerSummary(entries: readonly CaseEntry[]): LedgerSummary {
  const counted = statusIds
    .map((id) => ({ id, count: entries.filter((entry) => currentStatus(entry.data) === id).length }))
    .filter(({ count }) => count > 0)
    .map(({ id, count }) => `${String(count)} ${statuses[id].label.toLowerCase()}`);
  return {
    sentence: counted.length === 0 ? `${countLabel(entries.length)}.` : `${countLabel(entries.length)}: ${counted.join(', ')}.`,
    missing: missingCounts(entries)
      .filter(({ count }) => count > 0)
      .map(({ id, count }) => ({ id, label: hiddenFunctions[id].label, count, href: `/idea#${id}` })),
  };
}

/** One row of the ledger table. A pure function in lib/ledger.ts derives it from a case. */
export interface LedgerRow {
  readonly company: string;
  /** Country and area, shown beneath the company. */
  readonly meta: string;
  readonly change: string;
  /** The current status as its label. It is written as a word, never shown as a coloured pill. */
  readonly status: string;
  /** The latest update's summary. */
  readonly outcome: string;
  readonly href: string;
}

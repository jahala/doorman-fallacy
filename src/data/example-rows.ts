/**
 * Two example ledger rows from mockup 3, shown until the first cases are published.
 * Every place that renders them labels them as examples. This file is deleted in the
 * change that publishes the first real cases.
 */
export interface LedgerRow {
  readonly company: string;
  readonly meta: string;
  readonly change: string;
  readonly outcome: string;
  readonly href: string;
}

export const exampleRows: readonly LedgerRow[] = [
  {
    company: 'Commonwealth Bank',
    meta: 'Australia · Customer service',
    change: '45 roles cut for a voice bot.',
    outcome: 'Decision reversed.',
    href: '/ledger',
  },
  {
    company: 'Klarna',
    meta: 'Sweden · Customer service',
    change: 'AI-first customer support.',
    outcome: 'Human support hired back.',
    href: '/ledger',
  },
];

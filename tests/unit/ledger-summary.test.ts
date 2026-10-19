import { describe, expect, it } from 'vitest';
import { ledgerSummary } from '../../src/lib/summary.ts';
import { caseEntry } from './fixture-case.ts';

describe('ledgerSummary', () => {
  it('says one case in the singular, with its status as a lower-case label', () => {
    const { sentence } = ledgerSummary([caseEntry('a-2026', { status: 'too-early' })]);
    expect(sentence).toBe('1 case: 1 too early to tell.');
  });

  it('counts the cases, then each status that has any, in the order of the status vocabulary', () => {
    const entries = [
      caseEntry('a-2026', { status: 'reversed' }),
      caseEntry('b-2026', { status: 'holding' }),
      caseEntry('c-2026', { status: 'strained' }),
      caseEntry('d-2026', { status: 'holding' }),
      caseEntry('e-2026', { status: 'partly-reversed' }),
    ];
    expect(ledgerSummary(entries).sentence).toBe('5 cases: 2 holding, 1 strained, 1 partly reversed, 1 reversed.');
  });

  it('leaves out the statuses nobody has', () => {
    const entries = [caseEntry('a-2026', { status: 'holding' }), caseEntry('b-2026', { status: 'holding' })];
    expect(ledgerSummary(entries).sentence).toBe('2 cases: 2 holding.');
  });

  it('reads the status from the latest update, as the ledger does', () => {
    const entry = caseEntry('a-2026', { status: 'reversed' });
    expect(ledgerSummary([entry]).sentence).toContain('1 reversed');
  });

  it('says there are no cases when there are none', () => {
    expect(ledgerSummary([])).toEqual({ sentence: 'No cases.', missing: [] });
  });

  it('lists the hidden work recorded as missing, only above zero, each linking to its page', () => {
    const entries = [
      caseEntry('a-2026', { missed: ['signal', 'judgment'] }),
      caseEntry('b-2026', { missed: ['judgment'] }),
    ];
    expect(ledgerSummary(entries).missing).toEqual([
      { id: 'signal', label: 'Signal', count: 1, href: '/idea/signal' },
      { id: 'judgment', label: 'Judgment', count: 2, href: '/idea/judgment' },
    ]);
  });
});

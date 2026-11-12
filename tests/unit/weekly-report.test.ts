import { describe, expect, it } from 'vitest';
import { weeklyReport, type WeeklyResult } from '../../desk/weekly-report.ts';

const result: WeeklyResult = {
  today: '2026-10-26',
  late: false,
  leads: 540,
  published: [{ slug: 'example-2026', organisation: 'Example Bank' }],
  notPublished: [{ organisation: 'Other Co', problems: ['no supported update remains'] }],
  watch: [{ organisation: 'Watch Ltd', reason: 'Sources are not enough yet.' }],
  rejected: [{ organisation: 'Big Retail', reason: 'AI is only mentioned.' }],
  reviews: [
    { slug: 'dnb-2026', written: true, added: 2, removed: 1, corrections: [], problems: [] },
    { slug: 'cba-2025', written: true, added: 0, removed: 0, corrections: ['Corrected the number of roles from 45 to 40.'], problems: [] },
    { slug: 'ing-2026', written: false, added: 0, removed: 0, corrections: [], problems: ['agent: no JSON answer'] },
  ],
  suggestions: { resolved: 3, open: 1 },
  release: 'released',
  failures: [],
  costUsd: { sweep: 0.04, assess: 1.02, draft: 0.31, review: 0.12 },
  budgetUsd: 3,
};

describe('weeklyReport', () => {
  const text = weeklyReport(result);

  it('leads with a one-line summary', () => {
    expect(text.split('\n')[0]).toBe('Doorman desk, 26 October 2026: 1 published, 1 not published, 1 to watch, 1 rejected, 2 cases updated.');
  });

  it('lists what happened in each group, with reasons', () => {
    expect(text).toContain('- Example Bank: https://thedoormanfallacy.com/ledger/example-2026');
    expect(text).toContain('- Other Co: no supported update remains');
    expect(text).toContain('- Big Retail: AI is only mentioned.');
    expect(text).toContain('- dnb-2026: 2 statements added, 1 removed');
    expect(text).toContain('- cba-2025: checked; corrected: Corrected the number of roles from 45 to 40.');
    expect(text).toContain('- ing-2026: not updated: agent: no JSON answer');
    expect(text).toContain('Readers\' suggestions: 3 resolved, 1 still open.');
  });

  it('totals the cost against the budget', () => {
    expect(text).toContain('Cost: $1.49 of a $3.00 budget (sweep $0.04, assessments $1.02, drafts $0.31, reviews $0.12).');
  });

  it('says when nothing went wrong, and names failures when something did', () => {
    expect(text).toContain('No failures.');
    expect(weeklyReport({ ...result, failures: ['sweep: HTTP 500'] })).toContain('Failures:\n- sweep: HTTP 500');
  });

  it('says whether the changes of the week reached the site', () => {
    expect(text).toContain('Released to thedoormanfallacy.com.');
    expect(weeklyReport({ ...result, release: 'failed' })).toContain('Not released: the release failed, so the site does not show this week');
    expect(weeklyReport({ ...result, release: 'nothing-to-release' })).toContain('Nothing new to release.');
  });

  it('says when the run was late', () => {
    expect(weeklyReport({ ...result, late: true }).split('\n')[0]).toContain('(late run)');
  });
});

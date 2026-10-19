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
  newsForCases: [{ slug: 'dnb-2026', headlines: ['Union criticises DNB cut'] }],
  reviewsDue: [{ slug: 'dnb-2026', due: '2026-10-20' }],
  failures: [],
  costUsd: { sweep: 0.04, assess: 1.02, draft: 0.31 },
  budgetUsd: 3,
};

describe('weeklyReport', () => {
  const text = weeklyReport(result);

  it('leads with a one-line summary', () => {
    expect(text.split('\n')[0]).toBe('Doorman desk, 26 October 2026: 1 published, 1 not published, 1 to watch, 1 rejected, 1 review due.');
  });

  it('lists what happened in each group, with reasons', () => {
    expect(text).toContain('- Example Bank: https://thedoormanfallacy.com/ledger/example-2026');
    expect(text).toContain('- Other Co: no supported update remains');
    expect(text).toContain('- Big Retail: AI is only mentioned.');
    expect(text).toContain('- dnb-2026: Union criticises DNB cut');
  });

  it('totals the cost against the budget', () => {
    expect(text).toContain('Cost: $1.37 of a $3.00 budget (sweep $0.04, assessments $1.02, drafts $0.31).');
  });

  it('says when nothing went wrong, and names failures when something did', () => {
    expect(text).toContain('No failures.');
    expect(weeklyReport({ ...result, failures: ['sweep: HTTP 500'] })).toContain('Failures:\n- sweep: HTTP 500');
  });

  it('says when the run was late', () => {
    expect(weeklyReport({ ...result, late: true }).split('\n')[0]).toContain('(late run)');
  });
});

import { describe, expect, it } from 'vitest';
import { caseSchema, type Case, type IsoDate } from '../../src/data/case-schema.ts';
import {
  caseChangelog,
  caseFacts,
  caseKicker,
  claimEntries,
  countLabel,
  countryName,
  doormanReading,
  feedItems,
  formatDate,
  ledgerRow,
  newestFirst,
  sourceEntries,
  timelineEntries,
} from '../../src/lib/ledger.ts';
import { readCaseFixture } from './fixture-case.ts';

const valid: Case = caseSchema.parse(readCaseFixture('valid'));

/** A copy of the valid case with some fields replaced. */
function variant(changes: Partial<Case>): Case {
  return { ...valid, ...changes };
}

describe('formatDate', () => {
  it('writes a day, the month in full and the year, the British way', () => {
    expect(formatDate('2026-10-06')).toBe('6 October 2026');
    expect(formatDate('2025-01-31')).toBe('31 January 2025');
    expect(formatDate('2024-02-29')).toBe('29 February 2024');
  });
});

describe('countryName', () => {
  it('turns an ISO 3166 code into its English name', () => {
    expect(countryName('NO')).toBe('Norway');
    expect(countryName('AU')).toBe('Australia');
    expect(countryName('GB')).toBe('United Kingdom');
  });
});

describe('countLabel', () => {
  it('counts cases in the singular and the plural', () => {
    expect(countLabel(0)).toBe('No cases');
    expect(countLabel(1)).toBe('1 case');
    expect(countLabel(10)).toBe('10 cases');
  });
});

describe('newestFirst', () => {
  const entry = (id: string, announced: IsoDate): { id: string; data: Case } => ({
    id,
    data: variant({ announced }),
  });

  it('puts the latest announcement first and does not change the input', () => {
    const input = [entry('a-2025', '2025-03-01'), entry('c-2026', '2026-10-06'), entry('b-2025', '2025-12-31')];
    expect(newestFirst(input).map((item) => item.id)).toEqual(['c-2026', 'b-2025', 'a-2025']);
    expect(input.map((item) => item.id)).toEqual(['a-2025', 'c-2026', 'b-2025']);
  });

  it('orders cases announced on the same day by their id, so the page never reshuffles', () => {
    const input = [entry('zeta-2026', '2026-10-06'), entry('alpha-2026', '2026-10-06')];
    expect(newestFirst(input).map((item) => item.id)).toEqual(['alpha-2026', 'zeta-2026']);
  });
});

describe('ledgerRow', () => {
  const row = ledgerRow({ id: 'example-bank-2025', data: valid });

  it('shows the short name, with country and area beneath', () => {
    expect(row.company).toBe('Example Bank');
    expect(row.meta).toBe('Australia · Customer service');
  });

  it('shows the change, and the latest update as the reported outcome', () => {
    expect(row.change).toBe('45 roles cut for a voice bot.');
    expect(row.outcome).toBe('Reports of longer waits and staff working overtime.');
  });

  it('writes the current status as its label, from the latest update', () => {
    expect(row.status).toBe('Strained');
  });

  it('links to the case page by its id', () => {
    expect(row.href).toBe('/ledger/example-bank-2025');
  });
});

describe('caseKicker', () => {
  it('joins the country name, the area and the announcement date', () => {
    expect(caseKicker(valid)).toBe('Australia · Customer service · 29 July 2025');
  });
});

describe('caseFacts', () => {
  const facts = (data: Case): Record<string, string> => Object.fromEntries(caseFacts(data).map((fact) => [fact.term, fact.value]));

  it('lists status, roles, the door, last checked and next review, in that order', () => {
    expect(caseFacts(valid).map((fact) => fact.term)).toEqual(['Status', 'Roles', 'The door', 'Last checked', 'Next review']);
  });

  it('reads the status from the latest update and the review date from lib/review', () => {
    const shown = facts(valid);
    expect(shown['Status']).toBe('Strained');
    // Strained: three months from the later of the latest update (21 Aug) and lastChecked (30 Sep).
    expect(shown['Next review']).toBe('30 December 2025');
    expect(shown['Last checked']).toBe('30 September 2025');
    expect(shown['The door']).toBe('Answering inbound calls');
  });

  it('shows the headcount with a thousands separator, or says it was not stated', () => {
    expect(facts(valid)['Roles']).toBe('45');
    expect(facts(variant({ headcount: 1200 }))['Roles']).toBe('1,200');
    expect(facts(variant({ headcount: null }))['Roles']).toBe('Not stated');
  });

  it('says Closed when the case has no next review', () => {
    const closed = variant({
      updates: [{ ...valid.updates[0], status: 'reversed', date: '2025-01-10' }],
      lastChecked: '2026-02-01',
    });
    expect(facts(closed)['Next review']).toBe('Closed');
  });

  it('shows a review date written in the case over the derived one', () => {
    expect(facts(variant({ nextReview: '2026-03-01' }))['Next review']).toBe('1 March 2026');
  });
});

describe('sourceEntries', () => {
  const sources = sourceEntries(valid);

  it('numbers sources from 1 in the order the case lists them', () => {
    expect(sources.map((source) => [source.number, source.id])).toEqual([
      [1, 'bank-notice'],
      [2, 'gazette-waits'],
      [3, 'union-statement'],
      [4, 'gazette-background'],
    ]);
  });

  it('names the kind in words and writes the publication date out', () => {
    expect(sources[0]).toMatchObject({
      publisher: 'Example Bank',
      title: 'Notice to staff about the voice bot',
      published: '29 July 2025',
      kind: 'Primary source',
      url: 'https://example.com/notices/voice-bot',
      archive: 'https://web.archive.org/web/20250730000000/https://example.com/notices/voice-bot',
    });
    expect(sources[1]?.kind).toBe('Report');
  });
});

describe('doormanReading', () => {
  const reading = doormanReading(valid);

  it('gives each missed point the hidden function label and meaning, then the evidence', () => {
    expect(reading[0]).toMatchObject({
      label: 'Slack',
      meaning: 'Spare capacity that only shows in a crisis',
      evidence: 'Call volumes rose and team leaders were answering calls.',
    });
    expect(reading[1]?.label).toBe('Judgment');
  });

  it('points each one at the numbered sources it rests on', () => {
    expect(reading[0]?.sources).toEqual([{ id: 'union-statement', number: 3, publisher: 'Example Finance Union' }]);
    expect(reading[1]?.sources.map((source) => source.number)).toEqual([2, 3]);
  });
});

describe('claimEntries', () => {
  it('gives who said it, when, the verbatim quote and the numbered source', () => {
    expect(claimEntries(valid)).toEqual([
      {
        who: 'Example Bank',
        date: '29 July 2025',
        quote: 'the voice bot will reduce call volumes',
        source: { id: 'bank-notice', number: 1, publisher: 'Example Bank' },
      },
    ]);
  });
});

describe('timelineEntries', () => {
  const timeline = timelineEntries(valid);

  it('lists every update, oldest first, with the status label', () => {
    expect(timeline.map((item) => [item.date, item.status])).toEqual([
      ['29 July 2025', 'Too early to tell'],
      ['21 August 2025', 'Strained'],
    ]);
  });

  it('carries the summary, the quote and the numbered sources', () => {
    expect(timeline[1]).toMatchObject({
      summary: 'Reports of longer waits and staff working overtime.',
      quote: 'customers waited longer and team leaders took calls',
      sources: [{ id: 'gazette-waits', number: 2, publisher: 'Example Gazette' }],
    });
  });
});

describe('caseChangelog', () => {
  it('lists corrections with written-out dates and gives the last checked date', () => {
    const log = caseChangelog(valid);
    expect(log.corrections).toEqual([{ date: '2 September 2025', what: 'Headcount corrected from 90 to 45 direct-banking roles.' }]);
    expect(log.lastChecked).toBe('30 September 2025');
  });

  it('says no new reports when the latest update is older than the last check and nothing else changed', () => {
    const quiet = variant({ corrections: [], lastChecked: '2025-09-30' });
    expect(caseChangelog(quiet).noNewReportsSince).toBe('21 August 2025');
  });

  it('says nothing about reports when the last check is the day of the latest update', () => {
    const fresh = variant({ corrections: [], lastChecked: '2025-08-21' });
    expect(caseChangelog(fresh).noNewReportsSince).toBeNull();
  });

  it('says nothing about reports when a correction came after the latest update, since something did change', () => {
    // The valid case's correction (2 September) is after its latest update (21 August).
    expect(caseChangelog(valid).noNewReportsSince).toBeNull();
  });

  it('still says no new reports when every correction is older than the latest update', () => {
    const old = variant({ corrections: [{ date: '2025-08-01', what: 'A date fixed.' }], lastChecked: '2025-09-30' });
    expect(caseChangelog(old).noNewReportsSince).toBe('21 August 2025');
  });
});

describe('feedItems', () => {
  const [item] = feedItems([{ id: 'example-bank-2025', data: valid }]);

  it('titles each item with the short name and the change', () => {
    expect(item?.title).toBe('Example Bank: 45 roles cut for a voice bot.');
  });

  it('links to the case page and describes it by the latest update', () => {
    expect(item?.link).toBe('/ledger/example-bank-2025/');
    expect(item?.description).toBe('Reports of longer waits and staff working overtime.');
  });

  it('dates the item at the latest update, at midnight UTC', () => {
    expect(item?.pubDate.toISOString()).toBe('2025-08-21T00:00:00.000Z');
  });

  it('lists the newest announcement first', () => {
    const items = feedItems([
      { id: 'old-2024', data: variant({ announced: '2024-01-01' }) },
      { id: 'new-2026', data: variant({ announced: '2026-01-01' }) },
    ]);
    expect(items.map((entry) => entry.link)).toEqual(['/ledger/new-2026/', '/ledger/old-2024/']);
  });
});

import { describe, expect, it } from 'vitest';
import { csvField, datasetColumns, datasetJson, datasetRows, toCsv } from '../../src/lib/dataset.ts';
import { caseEntry } from './fixture-case.ts';

const site = 'https://thedoormanfallacy.com';

const entries = [
  caseEntry('alpha-2025', { short: 'Alpha', announced: '2025-03-01', missed: ['signal', 'judgment'], status: 'strained', updated: '2025-04-01', lastChecked: '2025-04-20' }),
  caseEntry('beta-2026', { short: 'Beta', announced: '2026-06-10', headcount: null, status: 'reversed', updated: '2026-07-01', lastChecked: '2027-08-01' }),
];

describe('datasetRows', () => {
  const rows = datasetRows(entries, site);

  it('has one row per case, newest announcement first', () => {
    expect(rows.map((row) => row.slug)).toEqual(['beta-2026', 'alpha-2025']);
  });

  it('gives the page address in full, ending in a slash like the built page', () => {
    expect(rows[1]?.url).toBe('https://thedoormanfallacy.com/ledger/alpha-2025/');
  });

  it('carries the case facts under the fixed column names', () => {
    expect(rows[1]).toEqual({
      slug: 'alpha-2025',
      url: 'https://thedoormanfallacy.com/ledger/alpha-2025/',
      company: 'Example Bank',
      short: 'Alpha',
      country: 'AU',
      area: 'Customer service',
      change: '45 roles cut for a voice bot.',
      announced: '2025-03-01',
      headcount: 45,
      door: 'Answering inbound calls',
      status: 'strained',
      latest_update_date: '2025-04-01',
      latest_update_summary: 'Roles cut as a voice bot takes inbound calls.',
      missed: ['signal', 'judgment'],
      last_checked: '2025-04-20',
      next_review: '2025-07-20',
      sources: 4,
    });
  });

  it('derives the status and the next review, and leaves the review empty when the case is closed', () => {
    expect(rows[0]).toMatchObject({ status: 'reversed', headcount: null, next_review: null });
  });

  it('has a key for every column, and no other', () => {
    for (const row of rows) expect(Object.keys(row)).toEqual([...datasetColumns]);
  });
});

describe('csvField', () => {
  it('leaves a plain value as it is', () => {
    expect(csvField('Customer service')).toBe('Customer service');
  });

  it('quotes a value with a comma', () => {
    expect(csvField('a, b')).toBe('"a, b"');
  });

  it('quotes a value with a quote and doubles the quote', () => {
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes a value with a line break and keeps the break', () => {
    expect(csvField('one\ntwo')).toBe('"one\ntwo"');
    expect(csvField('one\r\ntwo')).toBe('"one\r\ntwo"');
  });

  it('quotes a value that has a comma, a quote and a line break together', () => {
    expect(csvField('a, "b"\nc')).toBe('"a, ""b""\nc"');
  });
});

describe('toCsv', () => {
  const rows = datasetRows(entries, site);
  const lines = toCsv(rows).split('\r\n');

  it('starts with the header row of column names', () => {
    expect(lines[0]).toBe(datasetColumns.join(','));
  });

  it('ends each record with CRLF, as RFC 4180 has it, and has one record per case', () => {
    expect(toCsv(rows).endsWith('\r\n')).toBe(true);
    expect(lines).toHaveLength(rows.length + 2);
    expect(lines.at(-1)).toBe('');
  });

  it('joins the missed function ids with semicolons and leaves an empty cell for a null', () => {
    expect(lines[2]).toContain(',signal;judgment,');
    const closed = lines[1] ?? '';
    expect(closed).toContain(',reversed,');
    // headcount is the 9th column and next_review the 16th
    expect(closed.split(',')[8]).toBe('');
    expect(closed.split(',')[15]).toBe('');
  });

  it('quotes a company name that holds a comma, a quote and a line break', () => {
    const awkward = caseEntry('odd-2026', { door: 'Calls, "chat"\nand email' });
    const csv = toCsv(datasetRows([awkward], site));
    expect(csv).toContain('"Calls, ""chat""\nand email"');
  });

  it('writes no byte order mark and is plain UTF-8 text', () => {
    expect(toCsv(rows).charCodeAt(0)).not.toBe(0xfeff);
    const accented = caseEntry('aa-2026', { short: 'Bokhandel Æ' });
    expect(toCsv(datasetRows([accented], site))).toContain('Bokhandel Æ');
  });
});

describe('datasetJson', () => {
  const parsed = JSON.parse(datasetJson(datasetRows(entries, site))) as Record<string, unknown>;

  it('carries the licence and the credit before the cases', () => {
    expect(Object.keys(parsed)).toEqual(['licence', 'credit', 'cases']);
    expect(parsed['licence']).toBe('CC BY 4.0');
    expect(parsed['credit']).toBe('The Doorman Fallacy, thedoormanfallacy.com');
  });

  it('keeps missed as an array, a missing headcount and review as null, and the source count as a number', () => {
    const cases = parsed['cases'] as Record<string, unknown>[];
    expect(cases).toHaveLength(2);
    expect(cases[1]?.['missed']).toEqual(['signal', 'judgment']);
    expect(cases[0]?.['headcount']).toBeNull();
    expect(cases[0]?.['next_review']).toBeNull();
    expect(cases[1]?.['sources']).toBe(4);
  });

  it('is the same cases as the CSV', () => {
    const cases = parsed['cases'] as { slug: string }[];
    expect(cases.map((item) => item.slug)).toEqual(datasetRows(entries, site).map((row) => row.slug));
  });
});

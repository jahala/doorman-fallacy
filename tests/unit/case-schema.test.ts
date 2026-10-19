import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { caseSchema, citedSourceIds } from '../../src/data/case-schema.ts';
import { hiddenFunctionIds, hiddenFunctions } from '../../src/data/hidden-functions.ts';
import { statusIds, statuses } from '../../src/data/statuses.ts';
import { tableAfter } from './markdown-table.ts';
import { readCaseFixture } from './fixture-case.ts';

const root = path.resolve(import.meta.dirname, '../..');

/** The paths of every issue the schema reports for this input. */
function issuePaths(input: unknown): (string | number | symbol)[][] {
  const result = caseSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

/** The fixture with one top-level field replaced. */
function withField(field: string, value: unknown): Record<string, unknown> {
  return { ...readCaseFixture('valid'), [field]: value };
}

function withoutField(field: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(readCaseFixture('valid')).filter(([key]) => key !== field));
}

describe('a valid case', () => {
  it('passes, and its dates come out as YYYY-MM-DD strings', () => {
    const parsed = caseSchema.parse(readCaseFixture('valid'));
    expect(parsed.announced).toBe('2025-07-29');
    expect(parsed.lastChecked).toBe('2025-09-30');
    expect(parsed.updates.map((update) => update.date)).toEqual(['2025-07-29', '2025-08-21']);
    expect(parsed.claims[0]?.source).toBe('bank-notice');
    expect(parsed.missed[1]?.sources).toEqual(['gazette-waits', 'union-statement']);
    expect(parsed.sources.map((source) => source.kind)).toEqual(['primary', 'reporting', 'primary', 'reporting']);
  });

  it('accepts dates that a YAML reader turned into Date objects', () => {
    const parsed = caseSchema.parse(withField('announced', new Date('2025-07-29T00:00:00Z')));
    expect(parsed.announced).toBe('2025-07-29');
  });

  it('needs no next review date: it is an override, and the date is derived without it', () => {
    expect(issuePaths(withoutField('nextReview'))).toEqual([]);
    expect(issuePaths(withField('nextReview', '2026-08-21'))).toEqual([]);
    expect(issuePaths(withField('nextReview', null))).toEqual([]);
  });

  it('accepts a headcount that was not disclosed, written null', () => {
    expect(issuePaths(withField('headcount', null))).toEqual([]);
  });

  it('accepts a reader credit, or null, and empty lists of claims, corrections and related cases', () => {
    expect(issuePaths(withField('suggestedBy', 'A. Reader'))).toEqual([]);
    expect(issuePaths({ ...withField('claims', []), corrections: [], related: [] })).toEqual([]);
  });
});

describe('a case that breaks the format is refused, at the field that breaks it', () => {
  const refused: readonly [string, (string | number)[]][] = [
    ['invalid-missing-archive', ['sources', 0, 'archive']],
    ['invalid-summary-too-long', ['updates', 0, 'summary']],
    ['invalid-unknown-status', ['updates', 1, 'status']],
    ['invalid-updates-out-of-order', ['updates', 1, 'date']],
    ['invalid-change-too-long', ['change']],
    ['invalid-no-update-sources', ['updates', 1, 'sources']],
    ['invalid-missed-no-sources', ['missed', 0, 'sources']],
    ['invalid-no-sources-listed', ['sources']],
    ['invalid-unknown-hidden-function', ['missed', 1, 'function']],
    ['invalid-source-id-not-a-slug', ['sources', 3, 'id']],
    ['invalid-claim-quote-short', ['claims', 0, 'quote']],
    ['invalid-update-quote-short', ['updates', 1, 'quote']],
  ];

  it.each(refused)('%s', (fixture, expected) => {
    expect(issuePaths(readCaseFixture(fixture))).toContainEqual(expected);
  });
});

describe('every cited id must be a source, and source ids are unique', () => {
  const crossChecks: readonly [string, (string | number)[]][] = [
    ['invalid-claim-source-unknown', ['claims', 0, 'source']],
    ['invalid-missed-source-unknown', ['missed', 1, 'sources', 1]],
    ['invalid-update-source-unknown', ['updates', 1, 'sources', 0]],
    ['invalid-duplicate-source-id', ['sources', 4, 'id']],
  ];

  it.each(crossChecks)('%s', (fixture, expected) => {
    const paths = issuePaths(readCaseFixture(fixture));
    expect(paths).toEqual([expected]);
  });

  it('says which id is missing', () => {
    const result = caseSchema.safeParse(readCaseFixture('invalid-claim-source-unknown'));
    expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toEqual([
      'Cites no-such-source, which is not in sources',
    ]);
  });

  it('lists the ids cited in the front matter, once each', () => {
    const parsed = caseSchema.parse(readCaseFixture('valid'));
    expect([...citedSourceIds(parsed)].sort()).toEqual(['bank-notice', 'gazette-waits', 'union-statement']);
  });
});

describe('limits and required fields', () => {
  const valid = readCaseFixture('valid');
  const firstUpdate = (valid['updates'] as Record<string, unknown>[])[0] ?? {};

  it('allows 60 characters in change and refuses 61', () => {
    expect(issuePaths(withField('change', 'x'.repeat(60)))).toEqual([]);
    expect(issuePaths(withField('change', 'x'.repeat(61)))).toContainEqual(['change']);
  });

  it('allows 80 characters in a summary and refuses 81', () => {
    const withSummary = (summary: string): unknown =>
      withField('updates', [{ ...firstUpdate, summary }, ...(valid['updates'] as unknown[]).slice(1)]);
    expect(issuePaths(withSummary('x'.repeat(80)))).toEqual([]);
    expect(issuePaths(withSummary('x'.repeat(81)))).toContainEqual(['updates', 0, 'summary']);
  });

  it('allows a quote of four words and refuses three, in a claim and in an update', () => {
    const claim = (valid['claims'] as Record<string, unknown>[])[0] ?? {};
    expect(issuePaths(withField('claims', [{ ...claim, quote: 'one two three four' }]))).toEqual([]);
    expect(issuePaths(withField('claims', [{ ...claim, quote: 'one two three' }]))).toContainEqual(['claims', 0, 'quote']);
    expect(issuePaths(withField('claims', [{ ...claim, quote: '' }]))).toContainEqual(['claims', 0, 'quote']);
    expect(issuePaths(withField('updates', [{ ...firstUpdate, quote: 'one two three' }]))).toContainEqual([
      'updates',
      0,
      'quote',
    ]);
  });

  it('needs at least one update, one hidden function, one source and one watch query and signal', () => {
    expect(issuePaths(withField('updates', []))).toContainEqual(['updates', 0]);
    expect(issuePaths(withField('missed', []))).toContainEqual(['missed', 0]);
    expect(issuePaths(withField('sources', []))).toContainEqual(['sources']);
    expect(issuePaths(withField('watch', { queries: [], signals: ['rehiring'] }))).toContainEqual(['watch', 'queries']);
    expect(issuePaths(withField('watch', { queries: ['q'], signals: [] }))).toContainEqual(['watch', 'signals']);
  });

  it('wants a country as two capital letters', () => {
    expect(issuePaths(withField('country', 'Australia'))).toContainEqual(['country']);
    expect(issuePaths(withField('country', 'au'))).toContainEqual(['country']);
  });

  it('refuses a date that is not on the calendar', () => {
    expect(issuePaths(withField('announced', '2025-02-30'))).toContainEqual(['announced']);
    expect(issuePaths(withField('lastChecked', '2025-13-01'))).toContainEqual(['lastChecked']);
  });

  it('refuses a source kind outside primary and reporting', () => {
    const sources = (valid['sources'] as Record<string, unknown>[]).map((source, index) =>
      index === 0 ? { ...source, kind: 'rumour' } : source,
    );
    expect(issuePaths(withField('sources', sources))).toContainEqual(['sources', 0, 'kind']);
  });

  it('refuses a field the format does not have, so a typo cannot slip through', () => {
    expect(issuePaths({ ...valid, nextreview: '2026-08-21' }).length).toBeGreaterThan(0);
  });

  it('requires the fields the format lists', () => {
    for (const field of ['lastChecked', 'watch', 'sources', 'related', 'corrections', 'claims', 'suggestedBy']) {
      expect(issuePaths(withoutField(field)).length, field).toBeGreaterThan(0);
    }
  });
});

describe('vocabularies', () => {
  it('accepts every status in src/data/statuses.ts as an update status', () => {
    const valid = readCaseFixture('valid');
    const firstUpdate = (valid['updates'] as Record<string, unknown>[])[0] ?? {};
    for (const status of statusIds) {
      expect(issuePaths(withField('updates', [{ ...firstUpdate, status }])), status).toEqual([]);
    }
  });

  it('accepts every hidden function in src/data/hidden-functions.ts', () => {
    const missed = hiddenFunctionIds.map((id) => ({ function: id, evidence: 'Some evidence.', sources: ['union-statement'] }));
    expect(issuePaths(withField('missed', missed))).toEqual([]);
  });

  it('matches the tables in docs/data-model.md: ids, labels and meanings', () => {
    const doc = readFileSync(path.join(root, 'docs/data-model.md'), 'utf8');
    const statusRows = tableAfter(doc, 'Statuses:');
    const functionRows = tableAfter(doc, 'Hidden functions');
    expect(statusRows).toEqual(statusIds.map((id) => [id, statuses[id].label, statuses[id].meaning]));
    expect(functionRows).toEqual(
      hiddenFunctionIds.map((id) => [id, hiddenFunctions[id].label, hiddenFunctions[id].meaning]),
    );
  });
});

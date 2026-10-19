import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { caseSchema } from '../../src/data/case-schema.ts';
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

describe('a valid case', () => {
  it('passes, and its dates come out as YYYY-MM-DD strings', () => {
    const parsed = caseSchema.parse(readCaseFixture('valid'));
    expect(parsed.announced).toBe('2025-07-29');
    expect(parsed.updates.map((update) => update.date)).toEqual(['2025-07-29', '2025-08-21']);
    expect(parsed.nextReview).toBe('2026-08-21');
  });

  it('accepts dates that a YAML reader turned into Date objects', () => {
    const raw = readCaseFixture('valid');
    const parsed = caseSchema.parse({ ...raw, announced: new Date('2025-07-29T00:00:00Z') });
    expect(parsed.announced).toBe('2025-07-29');
  });

  it('needs no next review date when the latest status is reversed', () => {
    expect(issuePaths(readCaseFixture('valid-reversed-no-review'))).toEqual([]);
  });

  it('accepts a headcount that was not disclosed, written null', () => {
    expect(issuePaths({ ...readCaseFixture('valid'), headcount: null })).toEqual([]);
  });
});

describe('a case that breaks the format is refused, at the field that breaks it', () => {
  const refused: readonly [string, (string | number)[]][] = [
    ['invalid-missing-archive', ['updates', 0, 'sources', 0, 'archive']],
    ['invalid-summary-too-long', ['updates', 0, 'summary']],
    ['invalid-unknown-status', ['updates', 1, 'status']],
    ['invalid-missing-next-review', ['nextReview']],
    ['invalid-updates-out-of-order', ['updates', 1, 'date']],
    ['invalid-change-too-long', ['change']],
    ['invalid-no-sources', ['updates', 1, 'sources', 0]],
    ['invalid-unknown-hidden-function', ['missed', 1]],
  ];

  it.each(refused)('%s', (fixture, expected) => {
    expect(issuePaths(readCaseFixture(fixture))).toContainEqual(expected);
  });
});

describe('limits and required fields', () => {
  const valid = readCaseFixture('valid');
  const firstUpdate = (valid['updates'] as Record<string, unknown>[])[0] ?? {};

  it('allows 60 characters in change and refuses 61', () => {
    expect(issuePaths({ ...valid, change: 'x'.repeat(60) })).toEqual([]);
    expect(issuePaths({ ...valid, change: 'x'.repeat(61) })).toContainEqual(['change']);
  });

  it('allows 80 characters in a summary and refuses 81', () => {
    const withSummary = (summary: string): unknown => ({
      ...valid,
      updates: [{ ...firstUpdate, summary }, ...(valid['updates'] as unknown[]).slice(1)],
    });
    expect(issuePaths(withSummary('x'.repeat(80)))).toEqual([]);
    expect(issuePaths(withSummary('x'.repeat(81)))).toContainEqual(['updates', 0, 'summary']);
  });

  it('needs at least one update and at least one hidden function', () => {
    expect(issuePaths({ ...valid, updates: [] })).toContainEqual(['updates', 0]);
    expect(issuePaths({ ...valid, missed: [] })).toContainEqual(['missed', 0]);
  });

  it('refuses a date that is not on the calendar', () => {
    expect(issuePaths({ ...valid, announced: '2025-02-30' })).toContainEqual(['announced']);
  });

  it('refuses a field the format does not have, so a typo cannot slip through', () => {
    expect(issuePaths({ ...valid, nextreview: '2026-08-21' }).length).toBeGreaterThan(0);
  });

  it('requires a next review date for every status except reversed', () => {
    const withoutReview = Object.fromEntries(Object.entries(valid).filter(([key]) => key !== 'nextReview'));
    for (const status of statusIds) {
      const updates = [{ ...firstUpdate, status }];
      const refusedPaths = issuePaths({ ...withoutReview, updates });
      expect(refusedPaths.some((p) => p[0] === 'nextReview')).toBe(status !== 'reversed');
    }
  });
});

describe('vocabularies', () => {
  it('accepts every status in src/data/statuses.ts as an update status', () => {
    const valid = readCaseFixture('valid');
    const firstUpdate = (valid['updates'] as Record<string, unknown>[])[0] ?? {};
    for (const status of statusIds) {
      const input = { ...valid, updates: [{ ...firstUpdate, status }], nextReview: '2026-08-21' };
      expect(issuePaths(input)).toEqual([]);
    }
  });

  it('accepts every hidden function in src/data/hidden-functions.ts', () => {
    const valid = readCaseFixture('valid');
    expect(issuePaths({ ...valid, missed: [...hiddenFunctionIds] })).toEqual([]);
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

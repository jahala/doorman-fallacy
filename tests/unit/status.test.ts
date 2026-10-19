import { describe, expect, it } from 'vitest';
import { caseSchema } from '../../src/data/case-schema.ts';
import { currentStatus, latestUpdate } from '../../src/lib/status.ts';
import { readCaseFixture } from './fixture-case.ts';

const valid = caseSchema.parse(readCaseFixture('valid'));
const [first] = valid.updates;
const second = valid.updates[1];
if (second === undefined) throw new Error('the valid fixture needs two updates');

describe('currentStatus', () => {
  it('is the status of the latest update, not the first', () => {
    expect(first.status).toBe('too-early');
    expect(currentStatus(valid)).toBe('strained');
  });

  it('is the only update\'s status when there is one', () => {
    expect(currentStatus({ updates: [first] })).toBe('too-early');
  });

  it('follows a later update, so a reversal shows as reversed', () => {
    const reversal = { ...second, status: 'reversed' as const, date: '2025-09-01' as const };
    expect(currentStatus({ updates: [first, second, reversal] })).toBe('reversed');
  });
});

describe('latestUpdate', () => {
  it('returns the last update, whose summary the ledger shows as the reported outcome', () => {
    expect(latestUpdate(valid).summary).toBe('Reports of longer waits and staff working overtime.');
  });
});

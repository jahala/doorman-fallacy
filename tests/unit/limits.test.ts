import { describe, expect, it } from 'vitest';
import { cutoffs, rateRules, rateWindowStart } from '../../src/lib/limits.ts';

const now = new Date('2026-10-19T12:30:00.000Z');

describe('cutoffs', () => {
  it('computes every cut-off from the date it is given', () => {
    expect(cutoffs(now)).toEqual({
      resendBefore: '2026-10-19T12:20:00.000Z',
      unconfirmedBefore: '2026-10-12T12:30:00.000Z',
      suggestionPeopleBefore: '2026-07-21T12:30:00.000Z',
      seenBefore: '2025-10-19T12:30:00.000Z',
      runsBefore: '2025-10-19T12:30:00.000Z',
      rateHitsBefore: '2026-10-19T11:30:00.000Z',
    });
  });

  it('counts a year as 365 days across a leap day', () => {
    expect(cutoffs(new Date('2028-03-01T00:00:00.000Z')).seenBefore).toBe('2027-03-02T00:00:00.000Z');
  });

  it('does not change the date it was given', () => {
    const given = new Date(now);
    cutoffs(given);
    expect(given.toISOString()).toBe(now.toISOString());
  });
});

describe('rate rules', () => {
  it('allow 5 suggestions and 5 subscribe attempts an hour', () => {
    expect(rateRules.suggest).toEqual({ limit: 5, windowMs: 3_600_000 });
    expect(rateRules.subscribe).toEqual({ limit: 5, windowMs: 3_600_000 });
  });

  it('start the window one window before now', () => {
    expect(rateWindowStart('suggest', now)).toBe('2026-10-19T11:30:00.000Z');
  });
});

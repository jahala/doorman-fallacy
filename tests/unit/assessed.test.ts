import { describe, expect, it } from 'vitest';
import { recentlyAssessed, rememberAssessed } from '../../desk/assessed.ts';

describe('the memory of assessed organisations', () => {
  const memory = [
    { name: 'Old Co', date: '2026-04-01', recommendation: 'reject' },
    { name: 'Kroger', date: '2026-10-19', recommendation: 'reject' },
  ];

  it('adds new assessments and drops those past 180 days', () => {
    expect(rememberAssessed(memory, [{ name: 'Dukaan', date: '2026-11-12', recommendation: 'draft' }], '2026-11-12').map((entry) => entry.name)).toEqual(['Kroger', 'Dukaan']);
  });

  it('names those assessed in the last 30 days', () => {
    expect(recentlyAssessed(memory, '2026-11-12')).toEqual(['Kroger']);
    expect(recentlyAssessed(memory, '2026-11-19')).toEqual([]);
  });
});

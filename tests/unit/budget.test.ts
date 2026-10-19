import { describe, expect, it } from 'vitest';
import { createBudget } from '../../desk/budget.ts';

describe('createBudget', () => {
  it('gives the last of the budget to exactly one of two spenders reaching for it at once', async () => {
    const budget = createBudget(1);
    const first = budget.reserve(0.4);
    expect(first).not.toBeNull();
    const [a, b] = await Promise.all([Promise.resolve().then(() => budget.reserve(0.5)), Promise.resolve().then(() => budget.reserve(0.5))]);
    expect([a, b].filter((reservation) => reservation !== null)).toHaveLength(1);
  });

  it('counts a settled call at what it actually cost and frees the rest of its reservation', () => {
    const budget = createBudget(1);
    const reservation = budget.reserve(0.6);
    if (reservation === null) throw new Error('expected a reservation');
    budget.settle(reservation, 0.1);
    expect(budget.spent()).toBeCloseTo(0.1);
    expect(budget.reserved()).toBe(0);
    expect(budget.reserve(0.85)).not.toBeNull();
  });

  it('counts a call that may have been charged at its full reservation', () => {
    const budget = createBudget(1);
    const reservation = budget.reserve(0.3);
    if (reservation === null) throw new Error('expected a reservation');
    budget.possiblyCharged(reservation);
    expect(budget.spent()).toBeCloseTo(0.3);
    expect(budget.calls().possiblyCharged).toBe(1);
  });

  it('settles a reservation only once', () => {
    const budget = createBudget(1);
    const reservation = budget.reserve(0.3);
    if (reservation === null) throw new Error('expected a reservation');
    budget.settle(reservation, 0.2);
    budget.settle(reservation, 0.2);
    expect(budget.spent()).toBeCloseTo(0.2);
  });

  it('refuses a reservation that would pass the limit and counts the refusal', () => {
    const budget = createBudget(0.5);
    expect(budget.reserve(0.6)).toBeNull();
    expect(budget.calls().refused).toBe(1);
  });
});

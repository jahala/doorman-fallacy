import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../../src/data/case-schema.ts';
import { dueForReview } from '../../src/lib/review.ts';

interface Item {
  readonly id: string;
  readonly nextReview?: IsoDate | undefined;
}

const today: IsoDate = '2026-10-19';

describe('dueForReview', () => {
  it('returns cases whose review date is today or earlier', () => {
    const items: Item[] = [
      { id: 'past', nextReview: '2026-10-01' },
      { id: 'today', nextReview: '2026-10-19' },
      { id: 'tomorrow', nextReview: '2026-10-20' },
    ];
    expect(dueForReview(items, today).map((item) => item.id)).toEqual(['past', 'today']);
  });

  it('puts the case that has waited longest first', () => {
    const items: Item[] = [
      { id: 'b', nextReview: '2026-10-10' },
      { id: 'c', nextReview: '2026-10-18' },
      { id: 'a', nextReview: '2026-01-05' },
    ];
    expect(dueForReview(items, today).map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the given order for cases due on the same day', () => {
    const items: Item[] = [
      { id: 'x', nextReview: '2026-10-10' },
      { id: 'y', nextReview: '2026-10-10' },
      { id: 'z', nextReview: '2026-10-10' },
    ];
    expect(dueForReview(items, today).map((item) => item.id)).toEqual(['x', 'y', 'z']);
  });

  it('skips cases with no review date', () => {
    const items: Item[] = [{ id: 'reversed' }, { id: 'explicit', nextReview: undefined }];
    expect(dueForReview(items, today)).toEqual([]);
  });

  it('depends only on the date passed in', () => {
    const items: Item[] = [{ id: 'a', nextReview: '2026-10-19' }];
    expect(dueForReview(items, '2026-10-18')).toEqual([]);
    expect(dueForReview(items, '2026-10-19')).toHaveLength(1);
  });

  it('leaves its input untouched', () => {
    const items: Item[] = [
      { id: 'b', nextReview: '2026-10-10' },
      { id: 'a', nextReview: '2026-01-05' },
    ];
    dueForReview(items, today);
    expect(items.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('handles an empty ledger', () => {
    expect(dueForReview([], today)).toEqual([]);
  });
});

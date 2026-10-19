import type { IsoDate } from '../data/case-schema.ts';

interface Reviewable {
  readonly nextReview?: IsoDate | undefined;
}

/**
 * Cases whose review date has arrived (nextReview on or before today), oldest due first.
 * Today is passed in; this function never reads the clock.
 */
export function dueForReview<T extends Reviewable>(cases: readonly T[], today: IsoDate): T[] {
  const due: { readonly item: T; readonly date: IsoDate }[] = [];
  for (const item of cases) {
    if (item.nextReview !== undefined && item.nextReview <= today) {
      due.push({ item, date: item.nextReview });
    }
  }
  // Array.prototype.sort is stable, so cases due on the same day keep their given order.
  due.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return due.map((entry) => entry.item);
}

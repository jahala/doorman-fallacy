import { latestOf, type Case, type CaseUpdate, type IsoDate } from '../data/case-schema.ts';

type Dated = Pick<CaseUpdate, 'date' | 'status'>;

/** What the review date is derived from. A parsed Case fits this. */
export interface Reviewable {
  readonly updates: readonly [Dated, ...Dated[]];
  readonly lastChecked: IsoDate;
  readonly nextReview?: Case['nextReview'];
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * The same day of the month, some months on. When that month is too short the date lands on
 * its last day: 31 Jan plus 1 month is 28 Feb, or 29 Feb in a leap year.
 */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  const newYear = Math.floor(index / 12);
  const newMonth = (index % 12) + 1;
  const newDay = Math.min(day, daysInMonth(newYear, newMonth));
  const pad = (value: number, width: number): string => String(value).padStart(width, '0');
  return `${pad(newYear, 4)}-${pad(newMonth, 2)}-${pad(newDay, 2)}` as IsoDate;
}

function later(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}

/** The date the current unbroken run of the latest status began: the first update of that run. */
function runStart(updates: Reviewable['updates']): IsoDate {
  const latest = latestOf(updates);
  let start = latest.date;
  for (let index = updates.length - 1; index >= 0; index -= 1) {
    const update = updates[index];
    if (update === undefined || update.status !== latest.status) break;
    start = update.date;
  }
  return start;
}

/**
 * When a case is next due for review, or null when it is closed. Docs: data-model.md, "Derived,
 * never stored". A nextReview written in the case is an override and wins.
 *
 * The table gives a wait per latest status. The wait runs from the base date: the later of the
 * latest update and lastChecked, because a review that found nothing restarts the wait. Two
 * rows read differently, and these are the readings:
 *
 * - Holding, "6 months, then yearly". The first review after the case began holding is due 6
 *   months on. Once lastChecked is after the first update of the current holding run, that
 *   review has happened and the wait is 12 months. The run is counted back through consecutive
 *   holding updates, so a second holding update does not drop the case back to 6 months.
 * - Reversed, "12 months, then closed unless news arrives". The 12 months run from the
 *   reversal, the latest update, and a quiet check does not move them. Once lastChecked is on
 *   or after that date the case is closed (null). News is a new update, which changes the
 *   latest status and so the row that applies.
 */
export function derivedNextReview(subject: Reviewable): IsoDate | null {
  if (subject.nextReview !== undefined && subject.nextReview !== null) return subject.nextReview;

  const latest = latestOf(subject.updates);
  const base = later(latest.date, subject.lastChecked);

  switch (latest.status) {
    case 'too-early':
    case 'strained':
      return addMonths(base, 3);
    case 'partly-reversed':
      return addMonths(base, 6);
    case 'holding':
      return addMonths(base, subject.lastChecked > runStart(subject.updates) ? 12 : 6);
    case 'reversed': {
      const closesOn = addMonths(latest.date, 12);
      return subject.lastChecked >= closesOn ? null : closesOn;
    }
  }
}

/**
 * Cases whose review date has arrived (derived date on or before today), oldest due first.
 * A closed case is never due. Today is passed in; this function never reads the clock.
 */
export function dueForReview<T extends Reviewable>(cases: readonly T[], today: IsoDate): T[] {
  const due: { readonly item: T; readonly date: IsoDate }[] = [];
  for (const item of cases) {
    const date = derivedNextReview(item);
    if (date !== null && date <= today) due.push({ item, date });
  }
  // Array.prototype.sort is stable, so cases due on the same day keep their given order.
  due.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return due.map((entry) => entry.item);
}

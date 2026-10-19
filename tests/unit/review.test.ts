import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../../src/data/case-schema.ts';
import type { StatusId } from '../../src/data/statuses.ts';
import { addMonths, derivedNextReview, dueForReview } from '../../src/lib/review.ts';

interface Update {
  readonly date: IsoDate;
  readonly status: StatusId;
}

interface Subject {
  readonly updates: readonly [Update, ...Update[]];
  readonly lastChecked: IsoDate;
  readonly nextReview?: IsoDate | null | undefined;
}

/** A case with one update of this status on this date, last checked on lastChecked. */
function single(status: StatusId, date: IsoDate, lastChecked: IsoDate): Subject {
  return { updates: [{ date, status }], lastChecked };
}

const today: IsoDate = '2026-10-19';

describe('addMonths', () => {
  it('moves the same day of the month when it exists', () => {
    expect(addMonths('2025-03-15', 3)).toBe('2025-06-15');
    expect(addMonths('2025-03-15', 12)).toBe('2026-03-15');
  });

  it('rolls over the year', () => {
    expect(addMonths('2025-11-20', 3)).toBe('2026-02-20');
    expect(addMonths('2025-12-31', 6)).toBe('2026-06-30');
  });

  it('lands on the last day of a shorter month: 31 Jan plus 1 month is the end of February', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2025-11-30', 3)).toBe('2026-02-28');
    expect(addMonths('2025-08-31', 6)).toBe('2026-02-28');
  });

  it('treats 29 February as the last day of February a year on', () => {
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
    expect(addMonths('2024-02-29', 48)).toBe('2028-02-29');
  });

  it('knows the century leap-year rule', () => {
    expect(addMonths('2099-12-31', 2)).toBe('2100-02-28');
    expect(addMonths('1999-12-31', 2)).toBe('2000-02-29');
  });
});

describe('derivedNextReview: the status table in docs/data-model.md', () => {
  it('uses the nextReview override when one is set, for every status, even a closed case', () => {
    const statuses: StatusId[] = ['too-early', 'holding', 'strained', 'partly-reversed', 'reversed'];
    for (const status of statuses) {
      const subject = { ...single(status, '2024-01-10', '2024-01-10'), nextReview: '2030-05-05' as const };
      expect(derivedNextReview(subject), status).toBe('2030-05-05');
    }
  });

  it('ignores a null override', () => {
    const subject = { ...single('strained', '2026-01-10', '2026-01-10'), nextReview: null };
    expect(derivedNextReview(subject)).toBe('2026-04-10');
  });

  describe('too early to tell: 3 months', () => {
    it('counts from the update when nothing was checked since', () => {
      expect(derivedNextReview(single('too-early', '2026-01-31', '2026-01-31'))).toBe('2026-04-30');
    });

    it('counts from the latest check when that is later, because a check with no news restarts the wait', () => {
      expect(derivedNextReview(single('too-early', '2026-01-10', '2026-02-15'))).toBe('2026-05-15');
    });

    it('counts from the update when the recorded check is somehow earlier', () => {
      expect(derivedNextReview(single('too-early', '2026-03-10', '2026-02-01'))).toBe('2026-06-10');
    });
  });

  describe('strained: 3 months', () => {
    it('counts from the later of the update and the latest check', () => {
      expect(derivedNextReview(single('strained', '2026-05-31', '2026-05-31'))).toBe('2026-08-31');
      expect(derivedNextReview(single('strained', '2026-05-31', '2026-06-30'))).toBe('2026-09-30');
    });
  });

  describe('partly reversed: 6 months', () => {
    it('counts from the later of the update and the latest check', () => {
      expect(derivedNextReview(single('partly-reversed', '2025-08-31', '2025-08-31'))).toBe('2026-02-28');
      expect(derivedNextReview(single('partly-reversed', '2025-08-31', '2025-10-01'))).toBe('2026-04-01');
    });
  });

  describe('holding: 6 months, then yearly', () => {
    it('waits 6 months before the first review of a holding case', () => {
      expect(derivedNextReview(single('holding', '2025-03-15', '2025-03-15'))).toBe('2025-09-15');
    });

    it('goes yearly once a review has happened after the first holding update', () => {
      expect(derivedNextReview(single('holding', '2025-03-15', '2025-09-20'))).toBe('2026-09-20');
    });

    it('does not count a check on the very day of the update as a review after it', () => {
      expect(derivedNextReview(single('holding', '2025-03-15', '2025-03-15'))).toBe('2025-09-15');
    });

    it('measures from the first holding update of the unbroken run, so a second holding update does not reset to 6 months', () => {
      const subject: Subject = {
        updates: [
          { date: '2025-01-10', status: 'holding' },
          { date: '2025-07-10', status: 'holding' },
        ],
        lastChecked: '2025-07-10',
      };
      expect(derivedNextReview(subject)).toBe('2026-07-10');
    });

    it('starts the count again when the case was something else in between', () => {
      const subject: Subject = {
        updates: [
          { date: '2025-01-10', status: 'holding' },
          { date: '2025-04-10', status: 'strained' },
          { date: '2025-07-10', status: 'holding' },
        ],
        lastChecked: '2025-07-10',
      };
      expect(derivedNextReview(subject)).toBe('2026-01-10');
    });
  });

  describe('reversed: 12 months from the reversal, then closed unless news arrives', () => {
    it('is due 12 months after the reversal, whatever checks happened in between', () => {
      expect(derivedNextReview(single('reversed', '2025-08-21', '2025-08-21'))).toBe('2026-08-21');
      expect(derivedNextReview(single('reversed', '2025-08-21', '2026-03-01'))).toBe('2026-08-21');
      expect(derivedNextReview(single('reversed', '2025-08-21', '2026-08-20'))).toBe('2026-08-21');
    });

    it('is closed (null) once a check has happened on or after that date', () => {
      expect(derivedNextReview(single('reversed', '2025-08-21', '2026-08-21'))).toBeNull();
      expect(derivedNextReview(single('reversed', '2025-08-21', '2026-10-01'))).toBeNull();
    });

    it('counts a reversal on 29 February to the end of February the year after', () => {
      expect(derivedNextReview(single('reversed', '2024-02-29', '2024-02-29'))).toBe('2025-02-28');
    });

    it('reopens when news arrives: a later update changes the status, and the table applies to that', () => {
      const subject: Subject = {
        updates: [
          { date: '2025-08-21', status: 'reversed' },
          { date: '2026-09-01', status: 'strained' },
        ],
        lastChecked: '2026-09-01',
      };
      expect(derivedNextReview(subject)).toBe('2026-12-01');
    });
  });
});

describe('dueForReview', () => {
  interface Item extends Subject {
    readonly id: string;
  }

  function item(id: string, subject: Subject): Item {
    return { id, ...subject };
  }

  const ids = (items: readonly Item[]): string[] => items.map((entry) => entry.id);

  it('returns cases whose derived review date is today or earlier', () => {
    const items = [
      item('past', single('strained', '2026-06-01', '2026-06-01')),
      item('today', single('strained', '2026-07-19', '2026-07-19')),
      item('tomorrow', single('strained', '2026-07-20', '2026-07-20')),
    ];
    expect(ids(dueForReview(items, today))).toEqual(['past', 'today']);
  });

  it('honours an override over the derived date, both ways', () => {
    const items = [
      item('pushed-out', { ...single('strained', '2026-01-01', '2026-01-01'), nextReview: '2027-01-01' }),
      item('pulled-in', { ...single('holding', '2026-10-01', '2026-10-01'), nextReview: '2026-10-19' }),
    ];
    expect(ids(dueForReview(items, today))).toEqual(['pulled-in']);
  });

  it('puts the case that has waited longest first', () => {
    const items = [
      item('b', { ...single('strained', '2026-01-01', '2026-01-01'), nextReview: '2026-10-10' }),
      item('c', { ...single('strained', '2026-01-01', '2026-01-01'), nextReview: '2026-10-18' }),
      item('a', single('too-early', '2025-09-01', '2025-09-01')),
    ];
    expect(ids(dueForReview(items, today))).toEqual(['a', 'b', 'c']);
  });

  it('keeps the given order for cases due on the same day', () => {
    const same = { ...single('strained', '2026-01-01', '2026-01-01'), nextReview: '2026-10-10' as const };
    const items = [item('x', same), item('y', same), item('z', same)];
    expect(ids(dueForReview(items, today))).toEqual(['x', 'y', 'z']);
  });

  it('skips a closed case, however long ago the reversal was', () => {
    const items = [item('closed', single('reversed', '2024-01-10', '2025-06-01'))];
    expect(dueForReview(items, today)).toEqual([]);
  });

  it('includes a reversed case when its year is up and it has not been checked since', () => {
    const items = [item('year-up', single('reversed', '2025-10-01', '2025-10-01'))];
    expect(ids(dueForReview(items, today))).toEqual(['year-up']);
  });

  it('depends only on the date passed in', () => {
    const items = [item('a', single('strained', '2026-07-19', '2026-07-19'))];
    expect(dueForReview(items, '2026-10-18')).toEqual([]);
    expect(dueForReview(items, '2026-10-19')).toHaveLength(1);
  });

  it('leaves its input untouched', () => {
    const items = [
      item('b', { ...single('strained', '2026-01-01', '2026-01-01'), nextReview: '2026-10-10' }),
      item('a', { ...single('strained', '2026-01-01', '2026-01-01'), nextReview: '2026-01-05' }),
    ];
    dueForReview(items, today);
    expect(ids(items)).toEqual(['b', 'a']);
  });

  it('handles an empty ledger', () => {
    expect(dueForReview([], today)).toEqual([]);
  });
});

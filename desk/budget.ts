/**
 * One budget for every metered call in a desk run, Jev and Claude alike. A call reserves its
 * most it could cost before it is sent; after it, the reservation is settled at what it
 * actually cost, or, when no answer came back, counted in full as possibly charged. Such a
 * call is never sent again. Reserving is synchronous, so two spenders reaching for the last
 * of the budget at once cannot both get it.
 */

export interface Reservation {
  readonly id: number;
  readonly usd: number;
}

export interface Budget {
  readonly limitUsd: number;
  reserve(usd: number): Reservation | null;
  settle(reservation: Reservation, actualUsd: number): void;
  possiblyCharged(reservation: Reservation): void;
  spent(): number;
  reserved(): number;
  calls(): { settled: number; refused: number; possiblyCharged: number };
}

export function createBudget(limitUsd: number): Budget {
  let spent = 0;
  let nextId = 1;
  const open = new Map<number, number>();
  const counts = { settled: 0, refused: 0, possiblyCharged: 0 };
  const reservedTotal = (): number => [...open.values()].reduce((sum, usd) => sum + usd, 0);

  return {
    limitUsd,
    reserve(usd) {
      if (spent + reservedTotal() + usd > limitUsd) {
        counts.refused += 1;
        return null;
      }
      const reservation = { id: nextId++, usd };
      open.set(reservation.id, usd);
      return reservation;
    },
    settle(reservation, actualUsd) {
      if (!open.delete(reservation.id)) return;
      spent += actualUsd;
      counts.settled += 1;
    },
    possiblyCharged(reservation) {
      if (!open.delete(reservation.id)) return;
      spent += reservation.usd;
      counts.possiblyCharged += 1;
    },
    spent: () => spent,
    reserved: reservedTotal,
    calls: () => ({ ...counts }),
  };
}

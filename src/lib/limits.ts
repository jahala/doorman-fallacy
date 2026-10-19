/**
 * Every time limit and count limit the Worker applies, in one place: the rate limits, the life of
 * a confirmation link, the pause between confirmation emails, and the retention periods of
 * docs/data-model.md#d1. Dates come in as arguments and go out as ISO 8601 text, which sorts as
 * text, so D1 can compare them without conversion.
 */

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

/** At most `limit` accepted submissions per visitor in any `windowMs`, for each kind of form. */
export const rateRules = {
  suggest: { limit: 5, windowMs: hour },
  subscribe: { limit: 5, windowMs: hour },
} as const;

export type RateKind = keyof typeof rateRules;

/** Where the counting window for a kind of form starts, when it is `now`. */
export function rateWindowStart(kind: RateKind, now: Date): string {
  return new Date(now.getTime() - rateRules[kind].windowMs).toISOString();
}

export interface Cutoffs {
  /** A confirmation email may be sent again to an unconfirmed address whose last one is older than this. */
  readonly resendBefore: string;
  /** A confirmation link older than this has expired, and its unconfirmed address is deleted. */
  readonly unconfirmedBefore: string;
  /** Names and emails on suggestions resolved before this are blanked. */
  readonly suggestionPeopleBefore: string;
  /** `seen` rows last seen before this are deleted. */
  readonly seenBefore: string;
  /** `runs` rows started before this are deleted. */
  readonly runsBefore: string;
  /** Rate-limit rows older than this no longer count and are deleted. */
  readonly rateHitsBefore: string;
}

/** The earliest moment each kind of row may still have, when it is `now`. A year is 365 days. */
export function cutoffs(now: Date): Cutoffs {
  const before = (ms: number): string => new Date(now.getTime() - ms).toISOString();
  return {
    resendBefore: before(10 * minute),
    unconfirmedBefore: before(7 * day),
    suggestionPeopleBefore: before(90 * day),
    seenBefore: before(365 * day),
    runsBefore: before(365 * day),
    rateHitsBefore: before(Math.max(...Object.values(rateRules).map((rule) => rule.windowMs))),
  };
}

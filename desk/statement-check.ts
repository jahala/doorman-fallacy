/**
 * The Jev questions that check one statement against the sentence it cites: is everything in the
 * statement supported, and does it suggest a motive? Asked by the drafting step (desk/draft.ts) and
 * by the language calibration (scripts/jev-language-check.ts), so both ask exactly the same thing.
 */
export const statementQuestions = {
  supported: {
    type: 'noul',
    instructions:
      'Does `quote`, read together with `source` (who published it, when, and what kind of source it is), support everything that `statement` says? Attributing the quote to its publisher, or dating it by its publication date, is supported. Answer no if `statement` adds any other fact, number, date, cause, intention or judgement that neither `quote` nor `source` contains. Plain rewording is supported.',
    criteria: { true: 'Every part of the statement is in the quote.', false: 'The statement says something the quote does not.' },
  },
  motive: {
    type: 'noul',
    instructions:
      'Does `statement` claim or suggest why the organisation acted, its motives or intentions, in the writer’s own voice? Reporting a reason the organisation itself gave, attributed to it ("the bank said ..."), does not count.',
    criteria: { true: 'The writer asserts or implies a motive.', false: 'No motive, or only one the organisation is reported as giving.' },
  },
};

/**
 * How much a reader needs one statement of a case body, asked of each when the body is over its
 * limit, so the least needed are removed first (trimForLength in desk/review-apply.ts).
 */
export const neededQuestion = {
  needed: {
    type: 'noul',
    instructions:
      'This is one sentence of a ledger case about `organisation`, summed up as `change`; the visible task that was automated is `door`. A reader needs a sentence when it says what was cut, what AI or automation took over, what the organisation said about it, what happened to the people or the work, or what happened next. Reports of problems after the change are what the ledger exists for, and a reader needs them most: complaints, waits, errors, decisions reversed or restored, customers struggling to reach a person, staff taking on the work. A reader does not need background about the organisation (its size, its services, its history), figures from other countries, sites or years, the date or format of a meeting, or a repeat of `change`. How much does the reader need `statement`?',
    criteria: { true: 'The reader needs this to follow the case.', false: 'Background, another matter, or a repeat.' },
  },
} as const;

/** A statement passes when Jev's probability that its sentence supports it reaches this. */
export const supportedThreshold = 0.6;

/**
 * A point of the doorman reading passes when Jev's probability that its evidence reports the work
 * going missing reaches this. At 0.3 it kept all six points a person judged clear and one of 23 that
 * only showed the work existing (docs/research/2026-11-11-jev-reading.md).
 */
export const readingThreshold = 0.3;

/**
 * The question for one point of the doorman reading: does its evidence report that this kind of
 * hidden work went missing, moved or landed on fewer people? A point that only shows the work
 * exists, or that people still do it, says nothing about the fallacy (Judgment on 13 of 14 cases,
 * 2026-11-11). Asked by the drafting step and by scripts/jev-reading-check.ts.
 */
export const readingQuestion = {
  missing: {
    type: 'noul',
    instructions:
      'The point claims that `kind` (meaning: `meaning`) is hidden work this change affected. Does `evidence` report that this work went missing, got worse, moved to other people or to the customer, or was left to fewer people, after or because of the change? Reported complaints, waits, overtime, errors, rehiring or a reversal count. Saying that the work exists, that people still do it, that hard cases still go to people, or that a system now handles routine cases does not count. Neither does a general opinion about AI.',
    criteria: {
      true: 'The evidence reports this work being lost, moved or strained.',
      false: 'The evidence only shows the work exists or is still done, or is an opinion.',
    },
  },
} as const;

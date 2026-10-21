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

/** A statement passes when Jev's probability that its sentence supports it reaches this. */
export const supportedThreshold = 0.6;

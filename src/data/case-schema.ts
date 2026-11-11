import { z } from 'astro/zod';
import { hiddenFunctionIds } from './hidden-functions.ts';
import { minQuoteWords, quoteLongEnough } from '../lib/quotes.ts';
import { statusIds } from './statuses.ts';

/**
 * The shape of one ledger case, as described in docs/data-model.md.
 * This module is pure so unit tests can validate fixtures without Astro.
 */

/** A calendar date written YYYY-MM-DD. These compare correctly as plain strings. */
export type IsoDate = `${number}-${number}-${number}`;

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function isCalendarDate(text: string): text is IsoDate {
  const match = isoDatePattern.exec(text);
  if (match === null) return false;
  const [, year, month, day] = match;
  const probe = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return probe.toISOString().slice(0, 10) === text;
}

/**
 * Case files are YAML, and a YAML reader may turn an unquoted 2025-07-29 into a Date.
 * Both forms are accepted and both come out as the YYYY-MM-DD string.
 */
const isoDate = z
  .union([z.date().transform((date) => date.toISOString().slice(0, 10)), z.string()])
  .refine(isCalendarDate, { message: 'Expected a real calendar date written YYYY-MM-DD' });

const text = z.string().trim().min(1);

/** A short lowercase id such as acs-2025-08. Footnote labels in the body are built from these. */
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Expected a lowercase slug such as acs-2025-08');

/** A verbatim quote. One that is shorter than four words proves nothing. */
const quote = text.refine(quoteLongEnough, { message: `A quote needs at least ${String(minQuoteWords)} words` });

export const sourceKinds = ['primary', 'reporting'] as const;

export const sourceSchema = z.strictObject({
  id: slug,
  kind: z.enum(sourceKinds),
  url: z.url(),
  publisher: text,
  title: text,
  published: isoDate,
  archive: z.url({ message: 'Every source needs an archive link' }),
});

/** What the organisation said the change would do. */
export const claimSchema = z.strictObject({
  date: isoDate,
  who: text,
  said: text,
  source: slug,
  quote,
});

/** One point of the doorman reading: analysis, tied to the reported evidence it rests on. */
export const missedSchema = z.strictObject({
  function: z.enum(hiddenFunctionIds),
  evidence: text,
  sources: z.array(slug).min(1),
});

export const updateSchema = z.strictObject({
  date: isoDate,
  status: z.enum(statusIds),
  summary: text.max(80),
  sources: z.array(slug).min(1),
  quote,
});

export const correctionSchema = z.strictObject({
  date: isoDate,
  what: text,
});

export const watchSchema = z.strictObject({
  queries: z.array(text).min(1),
  signals: z.array(text).min(1),
});

/** The newest update. Updates are stored oldest first and a case has at least one. */
export function latestOf<T>(updates: readonly [T, ...T[]]): T {
  const [first, ...rest] = updates;
  return rest.at(-1) ?? first;
}

export const caseSchema = z
  .strictObject({
    company: text,
    short: text,
    country: z.string().regex(/^[A-Z]{2}$/, 'Expected an ISO 3166 alpha-2 code such as AU'),
    area: text,
    change: text.max(60).regex(/\.$/, 'The change line is one sentence ending in a full stop'),
    announced: isoDate,
    headcount: z.number().int().positive().nullable(),
    door: text,
    claims: z.array(claimSchema),
    // Empty until a source reports hidden work going missing, moving or landing on fewer people.
    missed: z.array(missedSchema),
    updates: z.tuple([updateSchema], updateSchema),
    corrections: z.array(correctionSchema),
    suggestedBy: text.nullable(),
    lastChecked: isoDate,
    /** An override. The review date is otherwise derived in lib/review.ts. */
    nextReview: isoDate.nullable().optional(),
    watch: watchSchema,
    sources: z.array(sourceSchema).min(1),
    related: z.array(text),
  })
  .superRefine((value, ctx) => {
    const known = new Set<string>();
    value.sources.forEach((source, index) => {
      if (known.has(source.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sources', index, 'id'],
          message: `Source id ${source.id} is used twice`,
        });
      }
      known.add(source.id);
    });

    const cite = (id: string, path: (string | number)[]): void => {
      if (!known.has(id)) {
        ctx.addIssue({ code: 'custom', path, message: `Cites ${id}, which is not in sources` });
      }
    };
    value.claims.forEach((claim, index) => {
      cite(claim.source, ['claims', index, 'source']);
    });
    value.missed.forEach((point, index) => {
      point.sources.forEach((id, at) => {
        cite(id, ['missed', index, 'sources', at]);
      });
    });
    value.updates.forEach((update, index) => {
      update.sources.forEach((id, at) => {
        cite(id, ['updates', index, 'sources', at]);
      });
    });

    value.updates.forEach((update, index) => {
      const previous = value.updates[index - 1];
      if (previous !== undefined && update.date < previous.date) {
        ctx.addIssue({
          code: 'custom',
          path: ['updates', index, 'date'],
          message: 'Updates run oldest first',
        });
      }
    });
  });

export type Case = z.output<typeof caseSchema>;
export type CaseSource = z.output<typeof sourceSchema>;
export type CaseClaim = z.output<typeof claimSchema>;
export type MissedPoint = z.output<typeof missedSchema>;
export type CaseUpdate = z.output<typeof updateSchema>;

/**
 * Every source id the front matter cites: claims, missed points and updates.
 * The body cites sources too, in its footnotes; scripts/check-cases adds those.
 */
export function citedSourceIds(value: Pick<Case, 'claims' | 'missed' | 'updates'>): Set<string> {
  const cited = new Set<string>();
  for (const claim of value.claims) cited.add(claim.source);
  for (const point of value.missed) for (const id of point.sources) cited.add(id);
  for (const update of value.updates) for (const id of update.sources) cited.add(id);
  return cited;
}

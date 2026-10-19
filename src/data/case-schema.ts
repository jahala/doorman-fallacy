import { z } from 'astro/zod';
import { hiddenFunctionIds } from './hidden-functions.ts';
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

export const sourceSchema = z.strictObject({
  url: z.url(),
  publisher: text,
  title: text,
  published: isoDate,
  archive: z.url({ message: 'Every source needs an archive link' }),
});

export const updateSchema = z.strictObject({
  date: isoDate,
  status: z.enum(statusIds),
  summary: text.max(80),
  sources: z.tuple([sourceSchema], sourceSchema),
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
    change: text.max(60),
    announced: isoDate,
    headcount: z.number().int().positive().nullable(),
    door: text,
    missed: z.tuple([z.enum(hiddenFunctionIds)], z.enum(hiddenFunctionIds)),
    updates: z.tuple([updateSchema], updateSchema),
    nextReview: isoDate.optional(),
  })
  .superRefine((value, ctx) => {
    const latest = latestOf(value.updates);

    if (latest.status !== 'reversed' && value.nextReview === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['nextReview'],
        message: 'nextReview is required unless the latest status is reversed',
      });
    }

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
export type CaseUpdate = z.output<typeof updateSchema>;
export type CaseSource = z.output<typeof sourceSchema>;

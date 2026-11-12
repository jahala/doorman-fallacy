/**
 * Applies a review to a published case: what the review agent adds, removes and corrects
 * (desk/prompts/review.md). Pure: the case as read, the review, the new sources and today's date
 * go in; the case to render, or the reasons it cannot be, come out. The statements a review adds
 * are checked before this runs (desk/review.ts); this holds the rules of the case as a whole.
 *
 * A correction is written by this code, never by the agent, so the words a reader sees in the
 * corrections list cannot come from a reader's report or from a model.
 */
import { z } from 'astro/zod';
import { maxBodyStatements } from '../scripts/check-cases.ts';
import type { ReadCase } from './case-file.ts';
import { bodyLength, bodySections, statementsOf, withoutPlaces, type CaseRecord, type CitingParts, type Draft, type SourceMaterial } from './case-render.ts';

const statement = z.object({ text: z.string(), cite: z.string() });
const paragraphs = z.array(z.array(statement));

const reviewSchema = z.object({
  add: z.object({
    claims: z.array(z.object({ date: z.string(), who: z.string(), said: z.string(), cite: z.string() })),
    missed: z.array(z.object({ function: z.string(), evidence: z.string(), cite: z.string() })),
    updates: z.array(z.object({ date: z.string(), status: z.string(), summary: z.string(), cite: z.string() })),
    body: z.object({ role: paragraphs, change: paragraphs, next: paragraphs }),
  }),
  /** Why a statement goes. Only the first two are corrections a reader is told about. */
  remove: z.array(z.object({ place: z.string(), reason: z.enum(['not-supported', 'wrong-case', 'superseded', 'length']) })),
  fields: z.array(
    z.discriminatedUnion('field', [
      z.object({ field: z.literal('change'), value: z.string(), reason: z.enum(['news', 'error']) }),
      z.object({ field: z.literal('door'), value: z.string(), reason: z.enum(['news', 'error']) }),
      z.object({ field: z.literal('headcount'), value: z.number().int().positive().nullable(), reason: z.enum(['news', 'error']) }),
    ]),
  ),
  /** New open questions, or null to keep the case's own. */
  open: z.array(z.string()).nullable(),
  /** What the review found for each reader's error report it was given. */
  reports: z.array(z.object({ id: z.number().int(), outcome: z.enum(['corrected', 'no-change']), reason: z.string() })),
  /** The kind of each new source the additions cite. */
  kinds: z.record(z.string(), z.enum(['primary', 'reporting'])),
});

export type Review = z.infer<typeof reviewSchema>;

export const emptyReview: Review = {
  add: { claims: [], missed: [], updates: [], body: { role: [], change: [], next: [] } },
  remove: [],
  fields: [],
  open: null,
  reports: [],
  kinds: {},
};

export function parseReview(value: unknown): { ok: true; review: Review } | { ok: false; problems: string[] } {
  const parsed = reviewSchema.safeParse(value);
  if (parsed.success) return { ok: true, review: parsed.data };
  return { ok: false, problems: parsed.error.issues.map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`) };
}

/** The same additions without every statement that cites one of these sources. */
export function dropCiting<T extends CitingParts>(parts: T, sourceIds: ReadonlySet<string>): T {
  const cites = (cite: string): boolean => sourceIds.has(cite.split('#')[0] ?? '');
  return withoutPlaces(parts, new Set(statementsOf(parts).filter((item) => cites(item.cite)).map((item) => item.where)));
}

/** A statement that opens by pointing back ("This would...", "He said") or says "this would" leans on the one before it. */
const leaning = /^(this|that|these|those|he|she|it|they|his|her|its|their)\b|\b(this|these)\s+(would|will|was|were|is|are|meant|means|had|has|could|did)\b/i;

/**
 * Removals that leave the body hanging: a kept statement that names someone introduced only in a
 * removed one, or that leans on the removed statement just before it. A name is a capitalised word
 * the body uses inside a sentence, other than the organisation's own.
 */
export function hangingProblems(draft: Draft, removed: ReadonlySet<string>): string[] {
  const body = statementsOf(draft).filter((item) => /^(role|change|next)\[/.test(item.where));
  const own = new Set([draft.company, draft.short].flatMap((name) => name.split(/\s+/)));
  const proper = new Set(body.flatMap((item) => [...item.text.matchAll(/(?<=\S\s+)\p{Lu}[\p{L}'’-]+/gu)].map((match) => match[0])).filter((word) => !own.has(word)));
  const names = (text: string): string[] => [...text.matchAll(/\p{Lu}[\p{L}'’-]+/gu)].map((match) => match[0]).filter((word) => proper.has(word));
  const problems: string[] = [];
  body.forEach((item, index) => {
    if (removed.has(item.where)) return;
    const before = body.slice(0, index);
    const previous = before.at(-1);
    if (previous !== undefined && removed.has(previous.where) && leaning.test(item.text)) {
      problems.push(`${item.where} ("${item.text.slice(0, 70)}") leans on ${previous.where}, which is removed; keep both or remove both`);
    }
    for (const name of new Set(names(item.text))) {
      if (before.some((other) => !removed.has(other.where) && names(other.text).includes(name))) continue;
      const introduced = before.find((other) => removed.has(other.where) && names(other.text).includes(name));
      if (introduced !== undefined) problems.push(`${item.where} names ${name}, who is introduced only in ${introduced.where}, which is removed; keep both or remove both`);
    }
  });
  return problems;
}

/**
 * The statements to remove so the body fits within `max`, given how much a reader needs each one
 * (`needed`, from Jev: desk/checks.ts) and how many statements additions bring (`added`). The least
 * needed go first, but only from the end of a paragraph, since a later sentence leans on the ones
 * before it; a paragraph can shrink to nothing. A removal that would leave a name or a "this"
 * hanging elsewhere is skipped, and each section keeps one statement. Statements already in
 * `removed` stay removed and are not counted again.
 */
export function trimForLength(
  draft: Draft,
  removed: ReadonlySet<string>,
  added: number,
  needed: ReadonlyMap<string, number>,
  max: number,
): { ok: true; places: Set<string> } | { ok: false; problem: string } {
  const body = statementsOf(draft).filter((item) => /^(role|change|next)\[/.test(item.where) && !removed.has(item.where));
  let over = body.length + added - max;
  const places = new Set<string>();
  if (over <= 0) return { ok: true, places };
  const order = [...body].sort((a, b) => (needed.get(a.where) ?? 1) - (needed.get(b.where) ?? 1));
  // Each round takes the least needed statement that can go now. A statement another leans on may
  // be free to go once that one has gone, so every round starts again from the least needed.
  while (over > 0) {
    const left = (section: string): number => body.filter((other) => other.where.startsWith(`${section}[`) && !places.has(other.where)).length;
    // Only the last sentence left in its paragraph may go: later sentences lean on earlier ones.
    const paragraphOf = (where: string): string => where.replace(/\[\d+\]$/, '');
    const isLast = (item: { where: string }): boolean => {
      const index = body.indexOf(item as (typeof body)[number]);
      return !body.slice(index + 1).some((other) => paragraphOf(other.where) === paragraphOf(item.where) && !places.has(other.where));
    };
    const next = order.find(
      (item) =>
        !places.has(item.where) &&
        isLast(item) &&
        left(item.where.split('[')[0] ?? '') > 1 &&
        hangingProblems(draft, new Set([...removed, ...places, item.where])).length === 0,
    );
    if (next === undefined) break;
    places.add(next.where);
    over -= 1;
  }
  return over <= 0 ? { ok: true, places } : { ok: false, problem: `the body cannot be brought within ${String(max)} statements without leaving one hanging` };
}

export type Applied = { ok: true; draft: Draft; sources: SourceMaterial[]; record: CaseRecord; corrections: string[] } | { ok: false; problems: string[] };

const fieldLabels = { change: 'summary line', door: 'task that was automated', headcount: 'number of roles' } as const;

function shown(value: string | number | null): string {
  if (value === null) return 'not disclosed';
  return typeof value === 'number' ? String(value) : `"${value}"`;
}

export function applyReview(read: ReadCase, review: Review, newSources: readonly SourceMaterial[], today: string): Applied {
  const problems: string[] = [];
  const places = new Map(statementsOf(read.draft).map((item) => [item.where, item.text]));
  const corrections: string[] = [];

  for (const removal of review.remove) {
    const removed = places.get(removal.place);
    if (removed === undefined) {
      problems.push(`the case has no statement at ${removal.place}`);
      continue;
    }
    if (removal.reason === 'not-supported') corrections.push(`Removed a sentence its source did not support: "${removed}"`);
    if (removal.reason === 'wrong-case') corrections.push(`Removed a sentence about another matter: "${removed}"`);
  }
  // A statement goes for length only when the case would otherwise be over the limit.
  const lengthRemovals = review.remove.filter((removal) => removal.reason === 'length').length;
  if (lengthRemovals > 0 && bodyLength(read.draft) + bodyLength(review.add) - (review.remove.length - lengthRemovals) <= maxBodyStatements) {
    problems.push(`the case is within its limit of ${String(maxBodyStatements)} statements, so nothing goes for length`);
  }
  const removedPlaces = new Set(review.remove.map((removal) => removal.place));
  problems.push(...hangingProblems(read.draft, removedPlaces));
  const kept = withoutPlaces(read.draft, removedPlaces);

  let draft: Draft = {
    ...kept,
    claims: [...kept.claims, ...review.add.claims],
    missed: [...kept.missed, ...review.add.missed],
    // Oldest first; a stable sort keeps same-day updates in the order they were written.
    updates: [...kept.updates, ...review.add.updates].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    body: {
      role: [...kept.body.role, ...review.add.body.role],
      change: [...kept.body.change, ...review.add.body.change],
      next: [...kept.body.next, ...review.add.body.next],
      open: review.open ?? kept.body.open,
    },
  };
  for (const change of review.fields) {
    const before = draft[change.field];
    if (change.reason === 'error' && before !== change.value) corrections.push(`Corrected the ${fieldLabels[change.field]} from ${shown(before)} to ${shown(change.value)}.`);
    draft = { ...draft, [change.field]: change.value };
  }

  if (draft.updates.length === 0) problems.push('the review would leave the case with no update');
  for (const name of bodySections) if (draft.body[name].length === 0) problems.push(`the review would leave the ${name} section empty`);
  if (bodyLength(draft) > maxBodyStatements) problems.push(`the body would hold ${String(bodyLength(draft))} statements; at most ${String(maxBodyStatements)}`);
  for (const report of review.reports) {
    if (report.outcome === 'corrected' && corrections.length === 0) problems.push(`report ${String(report.id)} is marked corrected, but the review corrected nothing`);
  }
  if (problems.length > 0) return { ok: false, problems };

  const known = new Set(read.sources.map((source) => source.id));
  const sources = [...read.sources, ...newSources.filter((source) => !known.has(source.id))];
  const record: CaseRecord = { ...read.record, corrections: [...read.record.corrections, ...corrections.map((what) => ({ date: today, what }))] };
  return { ok: true, draft, sources, record, corrections };
}

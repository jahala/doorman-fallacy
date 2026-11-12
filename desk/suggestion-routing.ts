/**
 * Where each reader's suggestion goes in the weekly run, and what it is resolved as once the desk
 * has looked. Pure: the suggestions, the triaged leads and the run's results go in.
 *
 * - An error report goes to its case's review. One about a case the ledger does not hold is
 *   resolved at once.
 * - A suggested case's links were triaged with the sweep. A lead about an organisation already in
 *   the ledger goes to that case's review; any other organisation is assessed whatever its rank. A
 *   link with no readable page, or no organisation the assessor can look at, is not a lead.
 * - A suggestion stays open when the desk could not look at it this week (triage failed, the
 *   budget ran out, a stage stopped), so the next run tries again.
 */
import { sameOrganisation } from '../src/lib/leads.ts';
import { assessable, clusters, type Triaged } from './clusters.ts';
import type { ErrorReport } from './review-material.ts';
import type { Resolution, Suggestion } from './suggestion-sql.ts';

export interface CaseName {
  readonly slug: string;
  readonly company: string;
  readonly short: string;
}

export interface Routed {
  readonly linksForCase: ReadonlyMap<string, readonly string[]>;
  readonly reportsForCase: ReadonlyMap<string, readonly ErrorReport[]>;
  /** Suggestion ids by the organisation to assess. */
  readonly toAssess: ReadonlyMap<string, readonly number[]>;
  /** Suggestion ids by the case whose review reads them. */
  readonly toCase: ReadonlyMap<string, readonly number[]>;
  readonly resolved: readonly Resolution[];
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

export function routeSuggestions(suggestions: readonly Suggestion[], triaged: readonly Triaged[], cases: readonly CaseName[]): Routed {
  const linksForCase = new Map<string, string[]>();
  const reportsForCase = new Map<string, ErrorReport[]>();
  const toAssess = new Map<string, number[]>();
  const toCase = new Map<string, number[]>();
  const resolved: Resolution[] = [];
  const groups = clusters(triaged);

  for (const suggestion of suggestions) {
    if (suggestion.kind === 'error') {
      const slug = suggestion.caseSlug ?? '';
      if (cases.some((item) => item.slug === slug)) {
        push(reportsForCase, slug, { id: suggestion.id, note: suggestion.note, links: suggestion.links });
        push(toCase, slug, suggestion.id);
      } else resolved.push({ id: suggestion.id, label: 'error:unknown-case' });
      continue;
    }

    const leads = triaged.filter((item) => item.feeds.includes('suggestion') && suggestion.links.includes(item.url));
    if (leads.length === 0) {
      resolved.push({ id: suggestion.id, label: 'case:not-a-lead' });
      continue;
    }
    if (leads.every((item) => item.triage === null)) continue;
    const group = groups.find((candidate) => candidate.items.some((item) => leads.includes(item)));
    const known = group === undefined || group.key.startsWith('unnamed:') ? undefined : cases.find((item) => [item.company, item.short].some((name) => sameOrganisation(name, group.name)));
    if (group !== undefined && known !== undefined) {
      for (const lead of leads) push(linksForCase, known.slug, lead.url);
      push(toCase, known.slug, suggestion.id);
    } else if (group !== undefined && assessable(group)) push(toAssess, group.name, suggestion.id);
    else resolved.push({ id: suggestion.id, label: 'case:not-a-lead' });
  }
  return { linksForCase, reportsForCase, toAssess, toCase, resolved };
}

/** What the assessor and the drafter found, for the suggestions they were given. */
export function resolveAssessed(
  toAssess: ReadonlyMap<string, readonly number[]>,
  assessed: readonly { cluster: string; ok: boolean; recommendation: string | null }[],
  drafted: ReadonlyMap<string, { published: boolean }>,
): Resolution[] {
  const resolved: Resolution[] = [];
  for (const [name, ids] of toAssess) {
    const outcome = assessed.find((item) => item.cluster === name);
    if (outcome?.ok !== true) continue;
    const draft = drafted.get(name);
    const label =
      outcome.recommendation === 'watch'
        ? 'case:watch'
        : outcome.recommendation === 'reject'
          ? 'case:rejected'
          : outcome.recommendation === 'draft' && draft !== undefined
            ? draft.published
              ? 'case:published'
              : 'case:not-published'
            : null;
    if (label !== null) for (const id of ids) resolved.push({ id, label });
  }
  return resolved;
}

/** What each case's review found, for the suggestions it was given. A review that did not finish leaves them open. */
export function resolveReviewed(
  toCase: ReadonlyMap<string, readonly number[]>,
  reportsForCase: ReadonlyMap<string, readonly ErrorReport[]>,
  reviews: ReadonlyMap<string, { reviewed: boolean; problems: readonly string[]; reports: readonly { id: number; outcome: 'corrected' | 'no-change' }[] }>,
): Resolution[] {
  const resolved: Resolution[] = [];
  for (const [slug, ids] of toCase) {
    const review = reviews.get(slug);
    if (review?.reviewed !== true || review.problems.length > 0) continue;
    const reportIds = new Set((reportsForCase.get(slug) ?? []).map((report) => report.id));
    for (const id of ids) {
      if (!reportIds.has(id)) {
        resolved.push({ id, label: 'case:in-ledger' });
        continue;
      }
      const answer = review.reports.find((report) => report.id === id);
      if (answer !== undefined) resolved.push({ id, label: answer.outcome === 'corrected' ? 'error:corrected' : 'error:no-change' });
    }
  }
  return resolved;
}

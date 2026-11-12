/**
 * How the desk reads readers' suggestions and error reports from D1, and marks each one resolved.
 * Pure: the SQL is built here and run by the caller (desk/suggestions.ts runs it through Wrangler;
 * tests/worker/suggestion-sql.test.ts runs it on the real local D1 with the real migrations).
 *
 * Only a credited reader's name leaves D1, because only that name is ever published. Email
 * addresses never leave it.
 */

export const openSuggestionsSql =
  'SELECT id, kind, case_slug, links, note, CASE WHEN credit = 1 THEN name END AS credit_name FROM suggestions WHERE resolved_at IS NULL ORDER BY id';

/** What the desk found, stored in `triage_label` when it resolves a suggestion. */
export const resolutionLabels = [
  // A suggested case: about an organisation already in the ledger, so its links went to that case's review.
  'case:in-ledger',
  'case:published',
  // Recommended for drafting, but the draft did not pass the publishing checks.
  'case:not-published',
  'case:watch',
  'case:rejected',
  // No readable page, or the page is not about a named organisation cutting roles for AI.
  'case:not-a-lead',
  'error:corrected',
  'error:no-change',
  // An error report about a case the ledger does not hold.
  'error:unknown-case',
] as const;

export type ResolutionLabel = (typeof resolutionLabels)[number];

export interface Suggestion {
  readonly id: number;
  readonly kind: 'case' | 'error';
  readonly caseSlug: string | null;
  readonly links: readonly string[];
  readonly note: string;
  /** The reader's name when they asked to be credited; otherwise null. */
  readonly creditName: string | null;
}

function links(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && /^https?:\/\//.test(item)) : [];
  } catch {
    return [];
  }
}

/** The rows of openSuggestionsSql as suggestions. A row that is not one is reported, not guessed at. */
export function readSuggestionRows(rows: readonly unknown[]): { suggestions: Suggestion[]; problems: string[] } {
  const suggestions: Suggestion[] = [];
  const problems: string[] = [];
  for (const row of rows) {
    const value = row as Record<string, unknown> | null;
    const id = value?.['id'];
    const kind = value?.['kind'];
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || (kind !== 'case' && kind !== 'error')) {
      problems.push(`a suggestion row is not readable: ${JSON.stringify(row).slice(0, 120)}`);
      continue;
    }
    const slug = value?.['case_slug'];
    const note = value?.['note'];
    const name = value?.['credit_name'];
    suggestions.push({
      id,
      kind,
      caseSlug: typeof slug === 'string' && slug !== '' ? slug : null,
      links: links(value?.['links']),
      note: typeof note === 'string' ? note : '',
      creditName: typeof name === 'string' && name.trim() !== '' ? name.trim() : null,
    });
  }
  return { suggestions, problems };
}

export type Resolution = { readonly id: number; readonly label: ResolutionLabel };

/**
 * One UPDATE that marks these suggestions resolved at `at` (ISO 8601 UTC), each with its label.
 * Values are checked and written into the statement, since Wrangler's command line binds no
 * parameters: ids are integers and labels come from the fixed list, so nothing a reader typed
 * reaches the SQL. A suggestion already resolved is left as it was.
 */
export function resolveSql(resolutions: readonly Resolution[], at: string): { ok: true; sql: string | null } | { ok: false; problem: string } {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(at)) return { ok: false, problem: `not an ISO time: ${at}` };
  for (const { id, label } of resolutions) {
    if (!Number.isSafeInteger(id) || id < 1) return { ok: false, problem: `not a suggestion id: ${String(id)}` };
    if (!(resolutionLabels as readonly string[]).includes(label)) return { ok: false, problem: `not a resolution label: ${label}` };
  }
  if (resolutions.length === 0) return { ok: true, sql: null };
  const cases = resolutions.map(({ id, label }) => `WHEN ${String(id)} THEN '${label}'`).join(' ');
  const ids = resolutions.map(({ id }) => String(id)).join(', ');
  return { ok: true, sql: `UPDATE suggestions SET resolved_at = '${at}', triage_label = CASE id ${cases} END WHERE id IN (${ids}) AND resolved_at IS NULL` };
}

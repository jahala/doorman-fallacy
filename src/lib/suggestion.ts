import { parseEmail, emailMaxLength } from './email-address.ts';
import { firstValue, valuesOf, type Fields, type Result } from './form.ts';

/** The limits of the suggestion form. The page's maxlength attributes read them too. */
export const suggestionLimits = {
  links: 5,
  linkLength: 2048,
  note: 2000,
  name: 100,
  email: emailMaxLength,
  caseSlug: 100,
} as const;

export type SuggestionKind = 'case' | 'error';

export interface Suggestion {
  readonly kind: SuggestionKind;
  /** The case an error report is about; null for a suggested case. */
  readonly caseSlug: string | null;
  readonly links: readonly string[];
  readonly note: string;
  readonly name: string | null;
  readonly email: string | null;
  /** Whether the person asked to be credited by name. */
  readonly credit: boolean;
}

export type SuggestionProblem =
  | 'kind-invalid'
  | 'case-missing'
  | 'case-invalid'
  | 'links-missing'
  | 'links-too-many'
  | 'link-invalid'
  | 'note-missing'
  | 'note-too-long'
  | 'name-too-long'
  | 'email-invalid';

const slugShape = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Line breaks as the browser counts them: one character each. */
function tidyText(raw: string): string {
  return raw.replaceAll('\r\n', '\n').replaceAll('\r', '\n').trim();
}

/** The URL in its normal form, or null unless it is an http or https address with no password. */
function normaliseLink(raw: string): string | null {
  if (raw.length > suggestionLimits.linkLength || /\s/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  return url.href.length > suggestionLimits.linkLength ? null : url.href;
}

/** Every link sent, from `link` fields and from `links` fields with one URL a line. Empty ones are skipped. */
function rawLinks(fields: Fields): string[] {
  return [...valuesOf(fields, 'link'), ...valuesOf(fields, 'links').flatMap((value) => value.split(/\r\n|\r|\n/))]
    .map((value) => value.trim())
    .filter((value) => value !== '');
}

/**
 * Checks a suggestion or an error report. The result carries every problem found, in a fixed
 * order, so the caller never has to guess. The honeypot is the caller's to check first.
 */
export function parseSuggestion(fields: Fields): Result<Suggestion, SuggestionProblem> {
  const problems: SuggestionProblem[] = [];

  const kindText = firstValue(fields, 'kind').trim();
  const kind: SuggestionKind = kindText === 'error' ? 'error' : 'case';
  if (kindText !== '' && kindText !== 'case' && kindText !== 'error') problems.push('kind-invalid');

  const slug = firstValue(fields, 'case').trim();
  let caseSlug: string | null = null;
  if (kind === 'error') {
    if (slug === '') problems.push('case-missing');
    else if (slug.length > suggestionLimits.caseSlug || !slugShape.test(slug)) problems.push('case-invalid');
    else caseSlug = slug;
  }

  const links: string[] = [];
  const sent = rawLinks(fields);
  let linkInvalid = false;
  for (const raw of sent) {
    const link = normaliseLink(raw);
    if (link === null) linkInvalid = true;
    else if (!links.includes(link)) links.push(link);
  }
  if (linkInvalid) problems.push('link-invalid');
  else if (links.length > suggestionLimits.links) problems.push('links-too-many');
  else if (links.length === 0 && kind === 'case') problems.push('links-missing');

  const note = tidyText(firstValue(fields, 'note'));
  if (note.length > suggestionLimits.note) problems.push('note-too-long');
  else if (note === '' && kind === 'error') problems.push('note-missing');

  const name = tidyText(firstValue(fields, 'name'));
  if (name.length > suggestionLimits.name) problems.push('name-too-long');

  const emailText = firstValue(fields, 'email').trim();
  const email = emailText === '' ? null : parseEmail(emailText);
  if (emailText !== '' && email === null) problems.push('email-invalid');

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    value: {
      kind,
      caseSlug,
      links,
      note,
      name: name === '' ? null : name,
      email,
      credit: valuesOf(fields, 'credit').some((value) => value !== ''),
    },
  };
}

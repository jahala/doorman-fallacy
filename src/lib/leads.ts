/**
 * Pure handling of news leads for the desk's sweep: tidy titles, merge duplicates, and
 * find the candidate values (organisation names, headcounts) that a model then chooses
 * between. Code finds candidates; the model only selects, which keeps it away from
 * counting and number reading.
 */

export interface RawLead {
  readonly title: string;
  readonly url: string;
  readonly outlet: string;
  readonly published: string;
  readonly snippet: string;
  readonly feed: string;
  readonly query: string;
}

export interface Lead extends RawLead {
  readonly feeds: readonly string[];
  readonly queries: readonly string[];
}

/** Google News titles end with " - Publisher". Split that off when it is there. */
export function splitPublisher(raw: string): { title: string; publisher: string | null } {
  const match = /^(.*\S)\s+-\s+([^-]{2,80})$/.exec(raw.trim());
  if (match?.[1] === undefined || match[2] === undefined) return { title: raw.trim(), publisher: null };
  return { title: match[1], publisher: match[2].trim() };
}

/** A key that ignores case, punctuation and thousands separators. */
export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/(\d),(\d{3})/g, '$1$2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Keeps the first lead for each title and each URL; records every feed and query that found it. */
export function dedupeLeads(leads: readonly RawLead[]): Lead[] {
  const kept: Lead[] = [];
  const byKey = new Map<string, number>();
  for (const raw of leads) {
    const keys = [`t:${titleKey(raw.title)}`, `u:${raw.url}`];
    const index = keys.map((key) => byKey.get(key)).find((found) => found !== undefined);
    if (index === undefined) {
      byKey.set(keys[0] ?? '', kept.length);
      byKey.set(keys[1] ?? '', kept.length);
      kept.push({ ...raw, feeds: [raw.feed], queries: [raw.query] });
      continue;
    }
    const existing = kept[index];
    if (existing === undefined) continue;
    kept[index] = {
      ...existing,
      feeds: existing.feeds.includes(raw.feed) ? existing.feeds : [...existing.feeds, raw.feed],
      queries: existing.queries.includes(raw.query) ? existing.queries : [...existing.queries, raw.query],
    };
    for (const key of keys) byKey.set(key, index);
  }
  return kept;
}

const notNames = new Set([
  'A', 'AI', 'A.I.', 'An', 'And', 'As', 'At', 'But', 'By', 'For', 'From', 'How', 'I', 'If', 'In', 'Is', 'It',
  'New', 'Not', 'Of', 'On', 'Or', 'The', 'This', 'To', 'Up', 'Us', 'What', 'When', 'Where', 'Who', 'Why',
  'With', 'CEO', 'CEOs', 'Jobs', 'Job', 'Layoffs', 'Exclusive', 'Report', 'Opinion', 'Analysis', 'Watch',
  'Are', 'Be', 'Will', 'Says', 'Said', 'Claims', 'Cuts', 'Cutting', 'Cut', 'Plans', 'These', 'Those', 'Video', 'All',
  'Tech', 'Companies', 'Workers', 'Staff', 'Employees', 'Amid', 'After', 'Over', 'More', 'Most',
]);

const joiners = new Set(['of', '&', 'de', 'la', 'du', 'van', 'von']);

/** Every contiguous part of a run, longest first, that neither starts nor ends with a joiner. */
function namesInRun(run: readonly string[]): string[] {
  const names: string[] = [];
  for (let length = run.length; length >= 1; length -= 1) {
    for (let start = 0; start + length <= run.length; start += 1) {
      const part = run.slice(start, start + length);
      if (joiners.has(part[0] ?? '') || joiners.has(part.at(-1) ?? '')) continue;
      const name = part.join(' ');
      if (!notNames.has(name)) names.push(name);
    }
  }
  return names;
}

/**
 * Runs of capitalised words, joined by "of", "&" and similar, plus their shorter parts, so a
 * name glued to a capitalised verb ("Microsoft Says") can still be chosen. Over-finding is
 * fine: the model picks the right one or none.
 */
export function companyCandidates(text: string): string[] {
  const found: string[] = [];
  let run: string[] = [];
  const flush = (): void => {
    for (const name of namesInRun(run)) if (!found.includes(name)) found.push(name);
    run = [];
  };
  for (const token of text.split(/\s+/)) {
    const endsClause = /[:;,!?]$/.test(token) || /[a-z]\.$/.test(token);
    const word = token
      .replace(/^[^\p{L}\p{N}&]+|[^\p{L}\p{N}&.]+$/gu, '')
      .replace(/['’]s$/u, '');
    const capitalised = /^[\p{Lu}\p{N}]/u.test(word) && !/^\d+$/.test(word);
    if (word !== '' && capitalised && !notNames.has(word)) {
      run.push(word);
    } else if (word !== '' && run.length > 0 && joiners.has(word)) {
      run.push(word);
    } else {
      flush();
    }
    if (endsClause) flush();
  }
  flush();
  return found.slice(0, 40);
}

const headcountPattern = /(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(\s?(?:k\b|thousand\b|million\b))?(?!\s?%|[\d.,]*%)/gi;

/** Numbers that could be a count of roles: plain, with separators, or with k / thousand / million. Years and percentages are skipped. */
export function headcountCandidates(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(headcountPattern)) {
    const [whole, digits, unit] = match;
    if (digits === undefined) continue;
    const isYear = unit === undefined && /^(19|20)\d{2}$/.test(digits);
    if (isYear) continue;
    const candidate = whole.trim();
    if (!found.includes(candidate)) found.push(candidate);
  }
  return found;
}

/** The count a candidate stands for, or null when it is not a count. */
export function headcountValue(candidate: string): number | null {
  const match = /^(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(k|thousand|million)?$/i.exec(candidate.trim());
  if (match?.[1] === undefined) return null;
  const base = Number(match[1].replace(/,/g, ''));
  const unit = match[2]?.toLowerCase();
  const factor = unit === 'k' || unit === 'thousand' ? 1000 : unit === 'million' ? 1_000_000 : 1;
  return Math.round(base * factor);
}

export type SizeBucket = 'not stated' | 'under 100' | '100 to 999' | '1,000 to 9,999' | '10,000 or more';

export function sizeBucket(count: number | null): SizeBucket {
  if (count === null) return 'not stated';
  if (count < 100) return 'under 100';
  if (count < 1000) return '100 to 999';
  if (count < 10000) return '1,000 to 9,999';
  return '10,000 or more';
}

const companyForms = new Set(['co', 'inc', 'ltd', 'llc', 'plc', 'ab', 'asa', 'as', 'a/s', 'ag', 'sa', 'nv', 'bv', 'gmbh', 'corp', 'corporation', 'limited']);
const joinedSuffixes = ['group', 'corp', 'bank', 'co'];

function orgWords(name: string): string[] {
  const words = name
    // Norwegian, Swedish and Danish write the possessive without an apostrophe: "DNBs".
    .replace(/\b(\p{Lu}[\p{Lu}\p{N}]+)s\b/gu, '$1')
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .replace(/[^\p{L}\p{N}&/ ]+/gu, ' ')
    .split(/\s+/)
    .filter((word) => word !== '');
  if (words[0] === 'the') words.shift();
  while (words.length > 1 && companyForms.has(words.at(-1) ?? '')) words.pop();
  return words;
}

/**
 * Whether two names found in headlines are the same organisation: equal once case, "the" and
 * company forms are set aside; one a word-by-word start of the other ("DNB", "DNB Bank"); or a
 * one-word name joined to a common suffix ("Citi", "Citigroup").
 */
export function sameOrganisation(a: string, b: string): boolean {
  const [short, long] = [orgWords(a), orgWords(b)].sort((x, y) => x.length - y.length || x.join(' ').length - y.join(' ').length);
  if (short === undefined || long === undefined || short.length === 0) return false;
  if (short.every((word, index) => long[index] === word)) return true;
  if (short.length === 1 && long.length === 1) {
    const [s] = short;
    const [l] = long;
    if (s === undefined || l === undefined || s.length < 4 || !l.startsWith(s)) return false;
    return joinedSuffixes.includes(l.slice(s.length));
  }
  return false;
}

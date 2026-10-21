import type { Case, CaseSource, IsoDate } from '../data/case-schema.ts';
import { hiddenFunctions } from '../data/hidden-functions.ts';
import type { LedgerRow } from '../data/ledger-row.ts';
import { statuses } from '../data/statuses.ts';
import { derivedNextReview } from './review.ts';
import { currentStatus, latestUpdate } from './status.ts';

/**
 * What the ledger pages show, worked out from cases. The pages arrange these values and decide
 * nothing themselves. A case entry is shaped like an Astro collection entry: its id is the file
 * name without .md, which is also the page's slug.
 */
export interface CaseEntry {
  readonly id: string;
  readonly data: Case;
}

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** 2026-10-06 as "6 October 2026". Read from the text, so no time zone can move the day. */
export function formatDate(date: IsoDate): string {
  const [year = '', month = '1', day = '1'] = date.split('-');
  return `${String(Number(day))} ${months[Number(month) - 1] ?? ''} ${year}`;
}

const regionNames = new Intl.DisplayNames('en-GB', { type: 'region' });

/** The English name of an ISO 3166 alpha-2 code. A code the runtime does not know comes back as itself. */
export function countryName(code: string): string {
  return regionNames.of(code) ?? code;
}

/** "No cases", "1 case", "12 cases". */
export function countLabel(count: number): string {
  if (count === 0) return 'No cases';
  return count === 1 ? '1 case' : `${String(count)} cases`;
}

/** Newest announcement first. Cases announced on one day are ordered by id so the page never reshuffles. */
export function newestFirst<T extends CaseEntry>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.data.announced !== b.data.announced) return a.data.announced < b.data.announced ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function ledgerRow(entry: CaseEntry): LedgerRow {
  const { data } = entry;
  return {
    company: data.short,
    meta: `${countryName(data.country)} · ${data.area}`,
    change: data.change,
    status: statuses[currentStatus(data)].label,
    outcome: latestUpdate(data).summary,
    href: `/ledger/${entry.id}`,
  };
}

/** The line above a case's headline: country, area and the announcement date. */
export function caseKicker(data: Case): string {
  return `${countryName(data.country)} · ${data.area} · ${formatDate(data.announced)}`;
}

export interface Fact {
  readonly term: string;
  readonly value: string;
}

/** The facts row under a case's headline. */
export function caseFacts(data: Case): Fact[] {
  const next = derivedNextReview(data);
  return [
    { term: 'Status', value: statuses[currentStatus(data)].label },
    { term: 'Roles', value: data.headcount === null ? 'Not stated' : data.headcount.toLocaleString('en-GB') },
    { term: 'The door', value: data.door },
    { term: 'Last checked', value: formatDate(data.lastChecked) },
    { term: 'Next review', value: next === null ? 'Closed' : formatDate(next) },
  ];
}

export interface SourceRef {
  readonly id: string;
  /** Position in the case's source list, counting from 1. The Sources list shows the same number. */
  readonly number: number;
  readonly publisher: string;
}

function kindLabel(kind: CaseSource['kind']): string {
  switch (kind) {
    case 'primary':
      return 'Primary source';
    case 'reporting':
      return 'Report';
  }
}

export interface SourceEntry extends SourceRef {
  readonly title: string;
  readonly url: string;
  readonly published: string;
  readonly kind: string;
  readonly archive: string;
}

/** The Sources list: every source, numbered in the order the case lists them. */
export function sourceEntries(data: Pick<Case, 'sources'>): SourceEntry[] {
  return data.sources.map((source, index) => ({
    id: source.id,
    number: index + 1,
    publisher: source.publisher,
    title: source.title,
    url: source.url,
    published: formatDate(source.published),
    kind: kindLabel(source.kind),
    archive: source.archive,
  }));
}

/** Numbered references to the cited sources. The schema guarantees every id exists. */
function refs(data: Pick<Case, 'sources'>, ids: readonly string[]): SourceRef[] {
  const entries = sourceEntries(data);
  return ids.flatMap((id) => {
    const found = entries.find((entry) => entry.id === id);
    return found === undefined ? [] : [{ id: found.id, number: found.number, publisher: found.publisher }];
  });
}

export interface ReadingPoint {
  readonly label: string;
  /** Where /idea explains this kind of hidden work. */
  readonly href: string;
  readonly meaning: string;
  readonly evidence: string;
  readonly sources: SourceRef[];
}

/** The doorman reading: each missed point with its hidden function and the sources its evidence rests on. */
export function doormanReading(data: Pick<Case, 'missed' | 'sources'>): ReadingPoint[] {
  return data.missed.map((point) => ({
    label: hiddenFunctions[point.function].label,
    href: `/idea#${point.function}`,
    meaning: hiddenFunctions[point.function].meaning,
    evidence: point.evidence,
    sources: refs(data, point.sources),
  }));
}

export interface ClaimEntry {
  readonly who: string;
  readonly date: string;
  readonly quote: string;
  readonly source: SourceRef;
}

/** What they said: each claim's speaker, date and verbatim quote, with its numbered source. */
export function claimEntries(data: Pick<Case, 'claims' | 'sources'>): ClaimEntry[] {
  return data.claims.flatMap((claim) => {
    const [source] = refs(data, [claim.source]);
    return source === undefined
      ? []
      : [{ who: claim.who, date: formatDate(claim.date), quote: claim.quote, source }];
  });
}

export interface TimelineEntry {
  readonly date: string;
  readonly status: string;
  readonly summary: string;
  readonly quote: string;
  readonly sources: SourceRef[];
}

/** Every update, oldest first, as the case lists them. */
export function timelineEntries(data: Pick<Case, 'updates' | 'sources'>): TimelineEntry[] {
  return data.updates.map((update) => ({
    date: formatDate(update.date),
    status: statuses[update.status].label,
    summary: update.summary,
    quote: update.quote,
    sources: refs(data, update.sources),
  }));
}

export interface Changelog {
  readonly corrections: { readonly date: string; readonly what: string }[];
  readonly lastChecked: string;
  /**
   * The date of the latest update, when the case was checked after it and nothing else changed
   * since: no correction came after that update. Null otherwise.
   */
  readonly noNewReportsSince: string | null;
}

export function caseChangelog(data: Pick<Case, 'corrections' | 'lastChecked' | 'updates'>): Changelog {
  const latest = latestUpdate(data).date;
  const quiet = latest < data.lastChecked && data.corrections.every((correction) => correction.date <= latest);
  return {
    corrections: data.corrections.map((correction) => ({ date: formatDate(correction.date), what: correction.what })),
    lastChecked: formatDate(data.lastChecked),
    noNewReportsSince: quiet ? formatDate(latest) : null,
  };
}

export interface FeedItem {
  readonly title: string;
  readonly link: string;
  readonly pubDate: Date;
  readonly description: string;
}

/** One feed item per case, newest announcement first, dated at its latest update. */
export function feedItems(entries: readonly CaseEntry[]): FeedItem[] {
  return newestFirst(entries).map((entry) => {
    const latest = latestUpdate(entry.data);
    return {
      title: `${entry.data.short}: ${entry.data.change}`,
      link: `/ledger/${entry.id}/`,
      pubDate: new Date(`${latest.date}T00:00:00Z`),
      description: latest.summary,
    };
  });
}

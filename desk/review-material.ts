/**
 * What a review reads: the pages found since a case was last checked, and the material the review
 * agent sees. Pure; desk/review.ts does the searching and fetching.
 */
import { maxBodyStatements } from '../scripts/check-cases.ts';
import type { ReadCase } from './case-file.ts';
import { bodyLength, citedSentence, slugOf, statementsOf, type SourceMaterial } from './case-render.ts';

/** A page that may hold news for a case. `published` is YYYY-MM-DD, or '' when not known yet. */
export interface Candidate {
  readonly url: string;
  readonly title: string;
  readonly publisher: string;
  readonly published: string;
  /** A link a reader or the week's sweep pointed at; searched pages come after these. */
  readonly pointed: boolean;
}

/** A reader's error report about this case. Its note is the reader's own words. */
export interface ErrorReport {
  readonly id: number;
  readonly note: string;
  readonly links: readonly string[];
}

/** The address without its fragment; search results sometimes carry one (#1). */
export function withoutFragment(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function canonical(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
  } catch {
    return url;
  }
}

/**
 * The pages a review reads, at most `limit`: pointed links first, then searched pages newest
 * first. A page the case already cites is left out, and so is a searched page dated before
 * `since` or not dated at all.
 */
export function selectCandidates(candidates: readonly Candidate[], citedUrls: readonly string[], since: string, limit: number): Candidate[] {
  const seen = new Set(citedUrls.map(canonical));
  const kept: Candidate[] = [];
  const ordered = [...candidates.filter((item) => item.pointed), ...candidates.filter((item) => !item.pointed).sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : 0))];
  for (const item of ordered) {
    const key = canonical(item.url);
    if (seen.has(key)) continue;
    if (!item.pointed && (item.published === '' || item.published < since)) continue;
    seen.add(key);
    kept.push({ ...item, url: withoutFragment(item.url) });
  }
  return kept.slice(0, limit);
}

/** A source id from the publisher and the month, unique among those taken: fsu-2026-11, fsu-2026-11-b. */
export function newSourceId(publisher: string, published: string, taken: ReadonlySet<string>): string {
  const name = slugOf(publisher.replace(/^www\./i, '').replace(/\.[a-z]+$/i, '')).split('-').slice(0, 3).join('-') || 'source';
  const base = `${name}-${published.slice(0, 7)}`;
  if (!taken.has(base)) return base;
  for (const letter of 'bcdefghijklmnopqrstuvwxyz') if (!taken.has(`${base}-${letter}`)) return `${base}-${letter}`;
  return `${base}-${String(taken.size)}`;
}

const numbered = (sentences: readonly string[]): string[] => sentences.map((sentence, index) => `${String(index + 1)}. ${sentence}`);

/** What the review agent sees, after desk/prompts/review.md. */
export function reviewMaterial(read: ReadCase, newSources: readonly SourceMaterial[], reports: readonly ErrorReport[], today: string): unknown {
  const { draft } = read;
  return {
    today,
    max_body: maxBodyStatements,
    case: {
      company: draft.company,
      short: draft.short,
      country: draft.country,
      area: draft.area,
      change: draft.change,
      announced: draft.announced,
      headcount: draft.headcount,
      door: draft.door,
      status: draft.updates.at(-1)?.status ?? '',
      last_checked: read.lastChecked,
      body_statements: bodyLength(draft),
      // A reading point cites its source as a whole, so it is shown with its source and no quote.
      statements: statementsOf(draft).map((item) => {
        const found = citedSentence(item.cite, read.sources);
        if (item.where.startsWith('missed[')) return { place: item.where, text: item.text, source: item.cite.split('#')[0] ?? '', quote: null };
        return { place: item.where, text: item.text, cite: item.cite, quote: found.ok ? found.sentence : '' };
      }),
      open: draft.body.open,
      watch: draft.watch,
    },
    existing_sources: read.sources.map((source) => ({ id: source.id, kind: source.kind, publisher: source.publisher, title: source.title, published: source.published, sentences: numbered(source.sentences) })),
    new_sources: newSources.map((source) => ({ id: source.id, publisher: source.publisher, title: source.title, published: source.published, url: source.url, sentences: numbered(source.sentences) })),
    reports: reports.map((report) => ({ id: report.id, note: report.note, links: report.links })),
  };
}

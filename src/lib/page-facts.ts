/**
 * What a page says about itself: its title, its publisher and the date it was published, read
 * from its meta tags and structured data. The desk uses these for a link a reader sent, which
 * arrives with no headline or date. Pure; null where the page does not say.
 */
import { decodeEntities } from './entities.ts';

export interface PageFacts {
  readonly title: string | null;
  readonly publisher: string | null;
  /** YYYY-MM-DD. */
  readonly published: string | null;
}

function decode(text: string): string {
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

function meta(html: string, name: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (key?.toLowerCase() !== name) continue;
    const content = /\bcontent\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
    const value = content?.[2] ?? content?.[3];
    if (value !== undefined && value.trim() !== '') return decode(value);
  }
  return null;
}

function calendarDate(value: string | null): string | null {
  const date = /^(\d{4}-\d{2}-\d{2})/.exec(value?.trim() ?? '')?.[1];
  return date !== undefined && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? date : null;
}

export function pageFacts(html: string): PageFacts {
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const title = meta(html, 'og:title') ?? (titleTag === undefined ? null : decode(titleTag) || null);
  const publisher = meta(html, 'og:site_name');
  const structured = /"datePublished"\s*:\s*"([^"]+)"/.exec(html)?.[1] ?? null;
  const published = calendarDate(meta(html, 'article:published_time')) ?? calendarDate(meta(html, 'datepublished')) ?? calendarDate(structured);
  return { title, publisher, published };
}

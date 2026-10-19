/**
 * Fetches leads from free news sources. This is the I/O edge of the sweep: each function
 * returns the leads it found or a failure message, never throws.
 */
import { splitPublisher, type RawLead } from '../src/lib/leads.ts';

export type Fetched = { ok: true; leads: RawLead[] } | { ok: false; source: string; query: string; message: string };

const userAgent = 'Mozilla/5.0 (compatible; doorman-fallacy-desk/0.1; +https://thedoormanfallacy.com)';

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

function stripTags(html: string): string {
  return decodeEntities(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tag(xml: string, name: string): string {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
  return match?.[1] === undefined ? '' : decodeEntities(match[1]).trim();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function isoDate(text: string): string {
  const time = Date.parse(text);
  return Number.isNaN(time) ? '' : new Date(time).toISOString().slice(0, 10);
}

async function get(url: string): Promise<{ ok: true; body: string } | { ok: false; message: string }> {
  try {
    const response = await fetch(url, { headers: { 'user-agent': userAgent }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return { ok: false, message: `HTTP ${String(response.status)}` };
    return { ok: true, body: await response.text() };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function googleNews(query: string, days: number): Promise<Fetched> {
  const q = encodeURIComponent(`${query} when:${String(days)}d`);
  const result = await get(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`);
  if (!result.ok) return { ok: false, source: 'gnews', query, message: result.message };
  const leads: RawLead[] = [];
  for (const match of result.body.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = match[1] ?? '';
    const split = splitPublisher(tag(item, 'title'));
    leads.push({
      title: split.title,
      url: tag(item, 'link'),
      outlet: tag(item, 'source') || split.publisher || '',
      published: isoDate(tag(item, 'pubDate')),
      snippet: '',
      feed: 'gnews',
      query,
    });
  }
  return { ok: true, leads };
}

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
}

export async function gdelt(query: string, days: number): Promise<Fetched> {
  const q = encodeURIComponent(`${query} sourcelang:english`);
  const result = await get(
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&format=json&maxrecords=75&timespan=${String(days)}d&sort=datedesc`,
  );
  if (!result.ok) return { ok: false, source: 'gdelt', query, message: result.message };
  let parsed: { articles?: GdeltArticle[] };
  try {
    parsed = JSON.parse(result.body) as { articles?: GdeltArticle[] };
  } catch {
    return { ok: false, source: 'gdelt', query, message: result.body.slice(0, 120) };
  }
  const leads = (parsed.articles ?? []).flatMap((article): RawLead[] => {
    if (article.url === undefined || article.title === undefined) return [];
    const seen = article.seendate ?? '';
    return [
      {
        title: stripTags(article.title),
        url: article.url,
        outlet: article.domain ?? '',
        published: seen.length >= 8 ? `${seen.slice(0, 4)}-${seen.slice(4, 6)}-${seen.slice(6, 8)}` : '',
        snippet: '',
        feed: 'gdelt',
        query,
      },
    ];
  });
  return { ok: true, leads };
}

interface HnHit {
  title?: string;
  url?: string | null;
  objectID?: string;
  created_at?: string;
}

export async function hackerNews(query: string, days: number, nowSeconds: number): Promise<Fetched> {
  const since = nowSeconds - days * 86_400;
  const result = await get(
    `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query.replace(/"/g, ''))}&tags=story&hitsPerPage=50&numericFilters=created_at_i>${String(since)}`,
  );
  if (!result.ok) return { ok: false, source: 'hn', query, message: result.message };
  let parsed: { hits?: HnHit[] };
  try {
    parsed = JSON.parse(result.body) as { hits?: HnHit[] };
  } catch {
    return { ok: false, source: 'hn', query, message: 'unreadable response' };
  }
  const leads = (parsed.hits ?? []).flatMap((hit): RawLead[] => {
    if (hit.title === undefined) return [];
    const url = hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID ?? ''}`;
    return [
      {
        title: hit.title,
        url,
        outlet: url.startsWith('https://news.ycombinator.com') ? 'Hacker News' : hostOf(url),
        published: (hit.created_at ?? '').slice(0, 10),
        snippet: '',
        feed: 'hn',
        query,
      },
    ];
  });
  return { ok: true, leads };
}

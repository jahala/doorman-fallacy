/**
 * Whether a quote appears word for word in a page. This is a plain text match with no model
 * involved: markup, entities, case, whitespace (including the space a tag leaves next to
 * punctuation) and typographic quotes and dashes are normalised, and nothing else. Publishing check 2 in docs/engineering.md.
 */
import { decodeEntities } from './entities.ts';

export function normaliseText(text: string): string {
  return decodeEntities(text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/[“”„″]/g, '"')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    // A tag is replaced by a space, so a link just before a full stop leaves "filings ." behind. Spaces
    // next to punctuation are dropped on both sides of the match, the page and the quote alike.
    .replace(/ ?([.,;:!?)\]]) ?/g, (_, mark: string) => `${mark} `)
    .replace(/([([]) /g, '$1')
    .replace(/ ?(["']) ?/g, '$1')
    .replace(/ $/, '')
    .toLowerCase()
    .trim();
}

/** Quotes shorter than this prove nothing, so they never count as found. */
export const minQuoteWords = 4;

function stripQuoteMarks(quote: string): string {
  return normaliseText(quote).replace(/^["']|["']$/g, '').trim();
}

/** The number of words in a quote, ignoring markup, case and the quotation marks around it. */
export function quoteWordCount(quote: string): number {
  const needle = stripQuoteMarks(quote);
  return needle === '' ? 0 : needle.split(' ').length;
}

/** Whether the quote is long enough to prove anything. */
export function quoteLongEnough(quote: string): boolean {
  return quoteWordCount(quote) >= minQuoteWords;
}

export function quoteFound(quote: string, page: string): boolean {
  if (!quoteLongEnough(quote)) return false;
  return normaliseText(page).includes(stripQuoteMarks(quote));
}

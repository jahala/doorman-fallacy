/**
 * Whether a quote appears word for word in a page. This is a plain text match with no model
 * involved: markup, entities, case, whitespace and typographic quotes and dashes are
 * normalised, and nothing else. Publishing check 2 in docs/engineering.md.
 */

const entities: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '"', rdquo: '"', lsquo: "'", rsquo: "'", ndash: '-', mdash: '-', hellip: '...',
};

function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => entities[name.toLowerCase()] ?? whole);
}

export function normaliseText(text: string): string {
  return decode(text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/[“”„″]/g, '"')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
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

/**
 * Turns an article page into its sentences, as written. The drafting agent cites these by
 * number, so every quote in a case is a sentence copied from the page by code, never typed
 * by a model.
 */

const named: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', ndash: '–', mdash: '—', hellip: '…',
};

function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => named[name.toLowerCase()] ?? whole);
}

const abbreviations = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'sr', 'jr', 'inc', 'ltd', 'co', 'corp', 'plc', 'vs', 'etc', 'no', 'fig', 'gen', 'gov',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'approx', 'est',
]);

function endsSentence(token: string, next: string | undefined): boolean {
  const bare = token.replace(/["'“”‘’)\]]+$/u, '');
  if (!/[.!?]$/.test(bare)) return false;
  if (next === undefined) return true;
  if (!/^["'“‘([]?[\p{Lu}\p{N}]/u.test(next)) return false;
  if (!bare.endsWith('.')) return true;
  const word = bare.slice(0, -1).replace(/^["'“‘(]+/u, '');
  if (abbreviations.has(word.toLowerCase())) return false;
  if (/^\p{L}$/u.test(word)) return false;
  if (/^(\p{L}\.)+\p{L}$/u.test(word)) return false;
  return true;
}

export function splitSentences(text: string): string[] {
  const tokens = text.split(/\s+/).filter((token) => token !== '');
  const sentences: string[] = [];
  let current: string[] = [];
  tokens.forEach((token, index) => {
    current.push(token);
    if (endsSentence(token, tokens[index + 1])) {
      sentences.push(current.join(' '));
      current = [];
    }
  });
  if (current.length > 0) sentences.push(current.join(' '));
  return sentences;
}

function textOf(html: string): string {
  return decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));
}

/** Paragraph texts from <p> and <pre> blocks, outside navigation, headers, footers and asides. */
function blockTexts(html: string): string[] {
  const body = html.replace(/<(script|style|noscript|nav|header|footer|aside|form|figure)\b[\s\S]*?<\/\1>/gi, ' ');
  const texts: string[] = [];
  for (const match of body.matchAll(/<(p|pre)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const inner = match[2] ?? '';
    // In <pre>, a blank line ends a paragraph and a single line break only wraps it.
    const paragraphs = match[1]?.toLowerCase() === 'pre' ? textOf(inner).split(/\n\s*\n/) : [textOf(inner)];
    texts.push(...paragraphs);
  }
  return texts;
}

function jsonBlocks(html: string, pattern: RegExp): unknown[] {
  return [...html.matchAll(pattern)].flatMap((match) => {
    try {
      return [JSON.parse(match[1] ?? '') as unknown];
    } catch {
      return [];
    }
  });
}

function strings(value: unknown, keep: (key: string, text: string) => boolean, key = ''): string[] {
  if (typeof value === 'string') return keep(key, value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => strings(item, keep, key));
  if (value !== null && typeof value === 'object') return Object.entries(value).flatMap(([name, item]) => strings(item, keep, name));
  return [];
}

/** A quotation mark at either end of a sentence whose quote marks do not pair up belongs to a neighbouring sentence. */
function trimOpenQuote(sentence: string): string {
  const marks = (sentence.match(/["\u201C\u201D]/g) ?? []).length;
  if (marks % 2 === 0) return sentence;
  if (/^["\u201C]/.test(sentence)) return sentence.slice(1);
  if (/["\u201D]$/.test(sentence)) return sentence.slice(0, -1);
  return sentence;
}

function sentencesFrom(texts: readonly string[]): string[] {
  const seen = new Set<string>();
  const sentences: string[] = [];
  for (const text of texts) {
    for (const sentence of splitSentences(text.replace(/\s+/g, ' ').trim()).map(trimOpenQuote)) {
      if (sentence.split(' ').length < 5 || seen.has(sentence)) continue;
      seen.add(sentence);
      sentences.push(sentence);
    }
  }
  return sentences;
}

/**
 * Sentences of five words or more from the page's article text. Pages hold that text in
 * different places, so four are read and the one with the most sentences wins: paragraphs,
 * structured data (articleBody), and article HTML inside a Next.js data block.
 */
export function articleSentences(html: string): string[] {
  const linkedData = jsonBlocks(html, /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  const nextData = jsonBlocks(html, /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/gi);
  const candidates = [
    sentencesFrom(blockTexts(html)),
    sentencesFrom(strings(linkedData, (key) => key === 'articleBody')),
    sentencesFrom(strings(nextData, (_, text) => /<(p|pre)\b/i.test(text)).flatMap((inner) => blockTexts(inner))),
  ];
  return candidates.reduce((best, next) => (next.length > best.length ? next : best), []);
}

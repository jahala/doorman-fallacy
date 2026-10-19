import { describe, expect, it } from 'vitest';
import { quoteFound, quoteLongEnough, quoteWordCount } from '../../src/lib/quotes.ts';

const page = `<html><body><p>The bank said it &ldquo;did not adequately consider all relevant
business considerations&rdquo; and that the roles were <em>not</em> redundant.</p></body></html>`;

describe('quoteFound', () => {
  it('finds a quote across tags, entities, line breaks and curly quotes', () => {
    expect(quoteFound('did not adequately consider all relevant business considerations', page)).toBe(true);
    expect(quoteFound('the roles were not redundant', page)).toBe(true);
  });

  it('does not find a quote with one word changed', () => {
    expect(quoteFound('did not properly consider all relevant business considerations', page)).toBe(false);
  });

  it('does not accept an empty or very short quote', () => {
    expect(quoteFound('', page)).toBe(false);
    expect(quoteFound('the', page)).toBe(false);
  });
});

describe('quoteWordCount and quoteLongEnough', () => {
  it('counts words and ignores the quotation marks around the quote', () => {
    expect(quoteWordCount('one two three four')).toBe(4);
    expect(quoteWordCount('\u201Cone two three four\u201D')).toBe(4);
    expect(quoteWordCount('  one   two\nthree ')).toBe(3);
    expect(quoteWordCount('')).toBe(0);
    expect(quoteWordCount('   ')).toBe(0);
  });

  it('wants at least four words', () => {
    expect(quoteLongEnough('one two three')).toBe(false);
    expect(quoteLongEnough('one two three four')).toBe(true);
  });
});

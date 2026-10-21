import { describe, expect, it } from 'vitest';
import { quoteFound, quoteLongEnough, quoteWordCount } from '../../src/lib/quotes.ts';

const page = `<html><body><p>The bank said it &ldquo;did not adequately consider all relevant
business considerations&rdquo; and that the roles were <em>not</em> redundant.</p></body></html>`;

describe('quoteFound', () => {
  it('finds a quote across tags, entities, line breaks and curly quotes', () => {
    expect(quoteFound('did not adequately consider all relevant business considerations', page)).toBe(true);
    expect(quoteFound('the roles were not redundant', page)).toBe(true);
  });

  it('finds a quote whose sentence ends in a link, or has a link before a comma', () => {
    // TechCrunch, 2024: the tag between the link text and the full stop must not leave a space behind.
    const page =
      '<p>Duolingo had 600 full-time employees in 2022, per <a href="https://example.com">company filings</a>.</p>' +
      '<p>In a comment to <a href="https://example.com">Bloomberg</a>, the company also confirmed it.</p>';
    expect(quoteFound('Duolingo had 600 full-time employees in 2022, per company filings.', page)).toBe(true);
    expect(quoteFound('In a comment to Bloomberg, the company also confirmed it.', page)).toBe(true);
  });

  it('keeps words in separate paragraphs apart, so a quote cannot run across them', () => {
    expect(quoteFound('the end of one paragraphthe start of the next', '<p>the end of one paragraph</p><p>the start of the next</p>')).toBe(false);
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

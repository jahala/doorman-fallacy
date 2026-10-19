import { describe, expect, it } from 'vitest';
import { quoteFound } from '../../src/lib/quotes.ts';

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

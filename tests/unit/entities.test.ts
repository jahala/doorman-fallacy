import { describe, expect, it } from 'vitest';
import { decodeEntities } from '../../src/lib/entities.ts';
import { articleSentences } from '../../src/lib/sentences.ts';
import { quoteFound } from '../../src/lib/quotes.ts';

describe('decodeEntities', () => {
  it('decodes accented letters by name, keeping their case, and by number', () => {
    expect(decodeEntities('S&atilde;o Jos&eacute;, &Eacute;mile, Gar&ccedil;on, Stra&szlig;e, caf&#233;, caf&#xE9;')).toBe('São José, Émile, Garçon, Straße, café, café');
  });

  it('decodes the punctuation entities and leaves an unknown name as it is', () => {
    expect(decodeEntities('A&amp;B&nbsp;&ldquo;x&rdquo; &notareal;')).toBe('A&B “x” &notareal;');
  });

  it('gives sentences with their letters, and the quote check finds them on the encoded page', () => {
    const html = '<article><p>Os trabalhadores de S&atilde;o Paulo foram demitidos em janeiro.</p><p>A empresa n&atilde;o comentou a decis&atilde;o.</p><p>O sindicato pediu uma reuni&atilde;o.</p></article>';
    const sentences = articleSentences(html);
    expect(sentences).toContain('Os trabalhadores de São Paulo foram demitidos em janeiro.');
    expect(quoteFound('Os trabalhadores de São Paulo foram demitidos em janeiro.', html)).toBe(true);
  });
});

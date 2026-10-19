import { describe, expect, it } from 'vitest';
import { demotedHeadings, lowerHeading } from '../../src/lib/demote-headings.ts';

describe('lowerHeading', () => {
  it('moves each heading it is given one level down', () => {
    expect(demotedHeadings.map(lowerHeading)).toEqual(['h2', 'h3', 'h4', 'h5', 'h6']);
  });

  it('leaves an h6, and any tag that is not a heading, as it is', () => {
    expect(['h6', 'p', 'section', 'h7', 'hr'].map(lowerHeading)).toEqual(['h6', 'p', 'section', 'h7', 'hr']);
  });
});

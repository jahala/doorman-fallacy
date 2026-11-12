import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readCase } from '../../desk/case-file.ts';
import { renderCase } from '../../desk/case-render.ts';

const casesDir = path.resolve(import.meta.dirname, '../../src/content/cases');
const published = readdirSync(casesDir).filter((name) => name.endsWith('.md'));

describe('readCase', () => {
  it('finds published cases to read', () => {
    expect(published.length).toBeGreaterThan(0);
  });

  // The contract a review rests on: a case read back and rendered again is the same file, so a
  // review changes only what it adds, removes or corrects.
  it.each(published)('%s renders back to the same text', (name) => {
    const text = readFileSync(path.join(casesDir, name), 'utf8');
    const read = readCase(text);
    if (!read.ok) throw new Error(read.problems.join('; '));
    const rendered = renderCase(read.value.draft, read.value.sources, read.value.lastChecked, read.value.record);
    if (!rendered.ok) throw new Error(rendered.problems.join('; '));
    expect(rendered.text).toBe(text);
  });

  it('gives each source the quotes the case holds from it, so a review can cite them again', () => {
    const text = readFileSync(path.resolve(import.meta.dirname, '../fixtures/review/cba-2025.md'), 'utf8');
    const read = readCase(text);
    if (!read.ok) throw new Error(read.problems.join('; '));
    const source = read.value.sources.find((item) => item.id === 'acs-reversal');
    expect(source?.sentences).toContain('We have apologised to the employees concerned and acknowledge we should have been more thorough in our assessment of the roles required.');
    expect(read.value.draft.body.next[0]?.[2]?.cite).toMatch(/^acs-reversal#\d+$/);
  });

  it('refuses a body sentence that has no footnote, rather than dropping it', () => {
    const text = readFileSync(path.resolve(import.meta.dirname, '../fixtures/review/cba-2025.md'), 'utf8').replace(
      'CBA said it was also reviewing its internal processes.[^acs-reversal-6]',
      'CBA said it was also reviewing its internal processes.',
    );
    const read = readCase(text);
    expect(read.ok).toBe(false);
  });

  it('refuses a reading point whose source holds no quote in the case', () => {
    const text = readFileSync(path.resolve(import.meta.dirname, '../fixtures/review/cba-2025.md'), 'utf8').replace('      - acs-reversal\nupdates:', '      - extra-source\nupdates:');
    const read = readCase(text);
    expect(read.ok).toBe(false);
  });
});

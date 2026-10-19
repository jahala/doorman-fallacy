import { describe, expect, it } from 'vitest';
import { parseSuggestion, suggestionLimits, type SuggestionProblem } from '../../src/lib/suggestion.ts';

type Fields = Record<string, string[]>;

function valid(extra: Fields = {}): Fields {
  return { link: ['https://example.com/report'], ...extra };
}

function problemsOf(fields: Fields): readonly SuggestionProblem[] {
  const result = parseSuggestion(fields);
  return result.ok ? [] : result.problems;
}

describe('parseSuggestion: a case', () => {
  it('takes one link and defaults to a case, with every optional field empty', () => {
    expect(parseSuggestion(valid())).toEqual({
      ok: true,
      value: {
        kind: 'case',
        caseSlug: null,
        links: ['https://example.com/report'],
        note: '',
        name: null,
        email: null,
        credit: false,
      },
    });
  });

  it('keeps note, name, email and the credit wish, tidied', () => {
    const result = parseSuggestion(
      valid({
        note: ['  The bank cut 45 roles.\r\nThen reversed.  '],
        name: ['  Ada Lovelace '],
        email: [' Ada@Example.com '],
        credit: ['on'],
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      value: { note: 'The bank cut 45 roles.\nThen reversed.', name: 'Ada Lovelace', email: 'ada@example.com', credit: true },
    });
  });

  it('reads repeated link fields and skips the empty ones', () => {
    const result = parseSuggestion({ link: ['https://a.example/1', '', '  ', 'https://b.example/2'] });
    expect(result).toMatchObject({ ok: true, value: { links: ['https://a.example/1', 'https://b.example/2'] } });
  });

  it('reads a links field with one URL per line, and combines it with link fields', () => {
    const result = parseSuggestion({
      link: ['https://a.example/1'],
      links: ['https://b.example/2\r\nhttps://c.example/3\n\n'],
    });
    expect(result).toMatchObject({
      ok: true,
      value: { links: ['https://a.example/1', 'https://b.example/2', 'https://c.example/3'] },
    });
  });

  it('writes each URL in its normal form and drops a repeat', () => {
    const result = parseSuggestion({ link: ['https://Example.com', 'https://example.com/', 'http://example.com/'] });
    expect(result).toMatchObject({ ok: true, value: { links: ['https://example.com/', 'http://example.com/'] } });
  });

  it('allows five links and no more', () => {
    const five = Array.from({ length: 5 }, (_unused, index) => `https://example.com/${String(index)}`);
    expect(parseSuggestion({ link: five }).ok).toBe(true);
    expect(problemsOf({ link: [...five, 'https://example.com/5'] })).toEqual(['links-too-many']);
  });

  it('needs at least one link', () => {
    expect(problemsOf({})).toEqual(['links-missing']);
    expect(problemsOf({ link: ['', ' '] })).toEqual(['links-missing']);
  });

  it.each([
    ['a javascript URL', 'javascript:alert(1)'],
    ['a data URL', 'data:text/html,hello'],
    ['an ftp URL', 'ftp://example.com/file'],
    ['text with no scheme', 'example.com/report'],
    ['a URL with a password', 'https://user:secret@example.com/'],
    ['a URL with a space inside', 'https://example.com/a b'],
    ['a URL over the length limit', `https://example.com/${'a'.repeat(suggestionLimits.linkLength)}`],
  ])('rejects %s', (_label, link) => {
    expect(problemsOf({ link: [link] })).toEqual(['link-invalid']);
  });

  it('rejects a note over 2000 characters and accepts exactly 2000', () => {
    expect(parseSuggestion(valid({ note: ['x'.repeat(2000)] })).ok).toBe(true);
    expect(problemsOf(valid({ note: ['x'.repeat(2001)] }))).toEqual(['note-too-long']);
  });

  it('counts a line break as one character, as the browser does', () => {
    const note = `${'x\r\n'.repeat(999)}x`;
    expect(note.length).toBeGreaterThan(2000);
    expect(parseSuggestion(valid({ note: [note] })).ok).toBe(true);
  });

  it('rejects a name over 100 characters', () => {
    expect(parseSuggestion(valid({ name: ['x'.repeat(100)] })).ok).toBe(true);
    expect(problemsOf(valid({ name: ['x'.repeat(101)] }))).toEqual(['name-too-long']);
  });

  it('rejects an email that is present and not valid, and accepts a blank one', () => {
    expect(problemsOf(valid({ email: ['not an email'] }))).toEqual(['email-invalid']);
    expect(parseSuggestion(valid({ email: ['  '] }))).toMatchObject({ ok: true, value: { email: null } });
  });

  it('ignores a case slug on a suggested case', () => {
    expect(parseSuggestion(valid({ case: ['dnb-2026'] }))).toMatchObject({ ok: true, value: { caseSlug: null } });
  });

  it('reports every problem at once, in a fixed order', () => {
    expect(problemsOf({ link: ['nope'], note: ['x'.repeat(2001)], name: ['x'.repeat(101)], email: ['nope'] })).toEqual([
      'link-invalid',
      'note-too-long',
      'name-too-long',
      'email-invalid',
    ]);
  });
});

describe('parseSuggestion: an error report', () => {
  const report: Fields = { kind: ['error'], case: ['dnb-2026'], note: ['The headcount is wrong.'] };

  it('needs a case and a note, and takes links as optional', () => {
    expect(parseSuggestion(report)).toEqual({
      ok: true,
      value: {
        kind: 'error',
        caseSlug: 'dnb-2026',
        links: [],
        note: 'The headcount is wrong.',
        name: null,
        email: null,
        credit: false,
      },
    });
    expect(parseSuggestion({ ...report, link: ['https://example.com/x'] })).toMatchObject({
      ok: true,
      value: { links: ['https://example.com/x'] },
    });
  });

  it('rejects a missing note', () => {
    expect(problemsOf({ kind: ['error'], case: ['dnb-2026'] })).toEqual(['note-missing']);
    expect(problemsOf({ kind: ['error'], case: ['dnb-2026'], note: ['   '] })).toEqual(['note-missing']);
  });

  it('rejects a missing case, and a case that is not a slug', () => {
    expect(problemsOf({ kind: ['error'], note: ['x'] })).toEqual(['case-missing']);
    expect(problemsOf({ kind: ['error'], note: ['x'], case: ['Not A Slug'] })).toEqual(['case-invalid']);
    expect(problemsOf({ kind: ['error'], note: ['x'], case: ['../etc'] })).toEqual(['case-invalid']);
  });

  it('still rejects a link that is not http or https', () => {
    expect(problemsOf({ ...report, link: ['javascript:alert(1)'] })).toEqual(['link-invalid']);
  });
});

describe('parseSuggestion: kind', () => {
  it('rejects a kind that is neither case nor error', () => {
    expect(problemsOf(valid({ kind: ['spam'] }))).toEqual(['kind-invalid']);
  });
});

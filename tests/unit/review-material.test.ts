import { describe, expect, it } from 'vitest';
import { newSourceId, selectCandidates, type Candidate } from '../../desk/review-material.ts';

const page = (url: string, published: string, pointed = false): Candidate => ({ url, title: url, publisher: 'Example', published, pointed });

describe('selectCandidates', () => {
  it('puts pointed links first and searched pages newest first, up to the limit', () => {
    const picked = selectCandidates([page('https://a.example/old', '2026-10-20'), page('https://b.example/new', '2026-11-10'), page('https://c.example/sent', '', true)], [], '2026-10-14', 2);
    expect(picked.map((item) => item.url)).toEqual(['https://c.example/sent', 'https://b.example/new']);
  });

  it('leaves out pages the case cites, also with www or a trailing slash, and duplicates, and drops fragments', () => {
    const picked = selectCandidates([page('https://www.a.example/story/', '2026-11-01'), page('https://b.example/x#top', '2026-11-01'), page('https://b.example/x', '2026-11-01')], ['https://a.example/story'], '2026-10-14', 8);
    expect(picked.map((item) => item.url)).toEqual(['https://b.example/x']);
  });

  it('leaves out searched pages from before the window or with no date, but keeps a pointed link without one', () => {
    const picked = selectCandidates([page('https://a.example/1', '2026-10-01'), page('https://a.example/2', ''), page('https://a.example/3', '', true)], [], '2026-10-14', 8);
    expect(picked.map((item) => item.url)).toEqual(['https://a.example/3']);
  });
});

describe('newSourceId', () => {
  it('names a source by its publisher and month', () => {
    expect(newSourceId('Finance Sector Union', '2026-11-02', new Set())).toBe('finance-sector-union-2026-11');
    expect(newSourceId('www.lesechos.fr', '2026-11-02', new Set())).toBe('lesechos-2026-11');
    expect(newSourceId('Göteborgs-Posten', '2026-01-09', new Set())).toBe('goteborgs-posten-2026-01');
  });

  it('stays unique against ids already taken', () => {
    expect(newSourceId('Reuters', '2026-11-02', new Set(['reuters-2026-11']))).toBe('reuters-2026-11-b');
  });
});

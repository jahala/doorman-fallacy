import { describe, expect, it } from 'vitest';
import { readableFirst } from '../../desk/clusters.ts';

const item = (url: string): { url: string } => ({ url });

describe('readableFirst', () => {
  it('puts reports with a direct address before Google News redirect links, keeping each group in order', () => {
    const items = [
      item('https://news.google.com/rss/articles/A'),
      item('https://www.dr.dk/a'),
      item('https://news.google.com/rss/articles/B'),
      item('https://www.nrk.no/b'),
    ];
    expect(readableFirst(items).map((entry) => entry.url)).toEqual([
      'https://www.dr.dk/a',
      'https://www.nrk.no/b',
      'https://news.google.com/rss/articles/A',
      'https://news.google.com/rss/articles/B',
    ]);
  });

  it('leaves a list with no redirect links as it is', () => {
    const items = [item('https://a.example/1'), item('https://b.example/2')];
    expect(readableFirst(items)).toEqual(items);
  });
});

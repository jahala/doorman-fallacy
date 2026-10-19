import { describe, expect, it } from 'vitest';
import {
  companyCandidates,
  sameOrganisation,
  dedupeLeads,
  headcountCandidates,
  headcountValue,
  sizeBucket,
  splitPublisher,
  titleKey,
  type RawLead,
} from '../../src/lib/leads.ts';

const lead = (title: string, url: string, feed = 'gnews'): RawLead => ({
  title,
  url,
  outlet: 'Example News',
  published: '2026-10-10',
  snippet: '',
  feed,
  query: 'q',
});

describe('splitPublisher', () => {
  it('takes the publisher off the end of a Google News title', () => {
    expect(splitPublisher('Kroger to lay off 3k corporate employees - Fox Business')).toEqual({
      title: 'Kroger to lay off 3k corporate employees',
      publisher: 'Fox Business',
    });
  });

  it('leaves a title without a publisher alone', () => {
    expect(splitPublisher('Kroger to lay off 3k corporate employees')).toEqual({
      title: 'Kroger to lay off 3k corporate employees',
      publisher: null,
    });
  });
});

describe('titleKey and dedupeLeads', () => {
  it('treats titles that differ only in case and punctuation as the same', () => {
    expect(titleKey('Kroger to lay off 3,000 workers!')).toBe(titleKey('kroger to lay off 3000 workers'));
  });

  it('keeps the first of two leads with the same title and records both feeds', () => {
    const result = dedupeLeads([
      lead('Kroger to lay off 3,000 workers', 'https://a.example/1', 'gnews'),
      lead('Kroger to lay off 3000 workers', 'https://b.example/2', 'gdelt'),
      lead('Klarna hires humans again', 'https://c.example/3'),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]?.url).toBe('https://a.example/1');
    expect(result[0]?.feeds).toEqual(['gnews', 'gdelt']);
  });

  it('merges leads with the same URL even when titles differ', () => {
    const result = dedupeLeads([
      lead('Kroger cuts jobs', 'https://a.example/1'),
      lead('Kroger cuts 3,000 jobs as it leans into AI', 'https://a.example/1'),
    ]);
    expect(result).toHaveLength(1);
  });
});

describe('companyCandidates', () => {
  it('finds capitalised names and skips sentence words and AI', () => {
    const found = companyCandidates('Commonwealth Bank reverses AI job cuts after union challenge');
    expect(found).toContain('Commonwealth Bank');
    expect(found).not.toContain('AI');
  });

  it('keeps names joined by & and of', () => {
    expect(companyCandidates('Bank of America and Procter & Gamble trim staff')).toEqual(
      expect.arrayContaining(['Bank of America', 'Procter & Gamble']),
    );
  });

  it('offers the shorter leading names inside a run, so a name glued to a verb can still be chosen', () => {
    expect(companyCandidates('These Are The Jobs Microsoft Says Will Be Replaced By AI')).toContain('Microsoft');
    expect(companyCandidates('Video: Bank of America at Sibos 2026')).toContain('Bank of America');
  });

  it('drops a possessive ending', () => {
    expect(companyCandidates("Nvidia’s next move could spell trouble")).toContain('Nvidia');
  });

  it('finds nothing in a title with no names', () => {
    expect(companyCandidates('why the robots are coming for your job')).toEqual([]);
  });
});

describe('headcountCandidates and headcountValue', () => {
  it('finds plain, comma, k and word numbers and skips years', () => {
    const found = headcountCandidates('In 2026, Kroger cuts 3k jobs, Amazon 14,000 and Salesforce 4 thousand');
    expect(found).toEqual(['3k', '14,000', '4 thousand']);
  });

  it('turns a candidate into a count', () => {
    expect(headcountValue('3k')).toBe(3000);
    expect(headcountValue('14,000')).toBe(14000);
    expect(headcountValue('4 thousand')).toBe(4000);
    expect(headcountValue('1.5 million')).toBe(1500000);
    expect(headcountValue('45')).toBe(45);
  });

  it('does not treat a percentage as a count', () => {
    expect(headcountCandidates('Firm cuts 10% of staff')).toEqual([]);
  });
});

describe('sizeBucket', () => {
  it('buckets counts and reports an unknown count', () => {
    expect(sizeBucket(null)).toBe('not stated');
    expect(sizeBucket(45)).toBe('under 100');
    expect(sizeBucket(700)).toBe('100 to 999');
    expect(sizeBucket(3000)).toBe('1,000 to 9,999');
    expect(sizeBucket(14000)).toBe('10,000 or more');
  });
});

describe('sameOrganisation', () => {
  it('matches a name and its longer form', () => {
    expect(sameOrganisation('DNB', 'DNB Bank')).toBe(true);
    expect(sameOrganisation('Citi', 'Citigroup')).toBe(true);
    expect(sameOrganisation('Commonwealth Bank', 'Commonwealth Bank of Australia')).toBe(true);
  });

  it('treats a Scandinavian possessive on a short capitalised name as the name', () => {
    expect(sameOrganisation('DNBs', 'DNB')).toBe(true);
    expect(sameOrganisation('IKEAs', 'IKEA')).toBe(true);
  });

  it('ignores case and a trailing company form', () => {
    expect(sameOrganisation('kroger', 'The Kroger Co.')).toBe(true);
    expect(sameOrganisation('Klarna', 'Klarna AB')).toBe(true);
  });

  it('keeps different organisations apart', () => {
    expect(sameOrganisation('Apple', 'Applebee’s')).toBe(false);
    expect(sameOrganisation('Meta', 'Metallica')).toBe(false);
    expect(sameOrganisation('Bank of America', 'Bank of Ireland')).toBe(false);
    expect(sameOrganisation('AT', 'AT&T')).toBe(false);
  });
});


import { datasetColumns } from '../../src/lib/dataset.ts';
import { builtRoutes, expect, readBuilt, test } from './site.ts';

const casePages = builtRoutes().filter((route) => /^\/ledger\/[^/]+\/$/.test(route));

test('/ledger.csv is served as CSV, with a header row and one record per case', async ({ request, siteUrl }) => {
  const response = await request.get(new URL('/ledger.csv', siteUrl).href);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('text/csv');
  const text = await response.text();
  expect(text.charCodeAt(0)).not.toBe(0xfeff);
  expect(text.startsWith(`${datasetColumns.join(',')}\r\n`)).toBe(true);
  expect(text.endsWith('\r\n')).toBe(true);
  const slugs = [...text.matchAll(/^([a-z0-9-]+),https:\/\/thedoormanfallacy\.com\/ledger\//gm)].map((match) => match[1] ?? '');
  expect(slugs.map((slug) => `/ledger/${slug}/`).sort()).toEqual(casePages);
});

test('/ledger.json is served as JSON with the licence and credit, and the same cases as the CSV and the pages', async ({
  request,
  siteUrl,
}) => {
  const response = await request.get(new URL('/ledger.json', siteUrl).href);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('application/json');
  const body = (await response.json()) as { licence: string; credit: string; cases: Record<string, unknown>[] };
  expect(body.licence).toBe('CC BY 4.0');
  expect(body.credit).toBe('The Doorman Fallacy, thedoormanfallacy.com');
  expect(body.cases.map((item) => `/ledger/${String(item['slug'])}/`).sort()).toEqual(casePages);
  for (const item of body.cases) {
    expect(Object.keys(item)).toEqual([...datasetColumns]);
    expect(item['url']).toBe(`https://thedoormanfallacy.com/ledger/${String(item['slug'])}/`);
    expect(Array.isArray(item['missed'])).toBe(true);
  }
  expect(readBuilt('ledger.csv').split('\r\n').length - 2).toBe(body.cases.length);
});

test('the dataset carries no em dash', () => {
  expect(readBuilt('ledger.csv')).not.toContain('\u2014');
  expect(readBuilt('ledger.json')).not.toContain('\u2014');
});

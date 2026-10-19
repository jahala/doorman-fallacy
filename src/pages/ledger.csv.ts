import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { datasetRows, toCsv } from '../lib/dataset.ts';
import { siteOrigin } from '../lib/site.ts';

/** The whole ledger as one CSV file, built with the site from the same cases as the pages. */
export const GET: APIRoute = async () => {
  const rows = datasetRows(await getCollection('cases'), siteOrigin);
  return new Response(toCsv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
};

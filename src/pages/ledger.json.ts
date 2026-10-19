import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { datasetJson, datasetRows } from '../lib/dataset.ts';
import { siteOrigin } from '../lib/site.ts';

/** The whole ledger as one JSON file, built with the site from the same cases as the pages. */
export const GET: APIRoute = async () => {
  const rows = datasetRows(await getCollection('cases'), siteOrigin);
  return new Response(datasetJson(rows), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};

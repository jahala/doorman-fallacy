import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { feedItems } from '../lib/ledger.ts';

export async function GET(context: APIContext): Promise<Response> {
  if (context.site === undefined) throw new Error('astro.config.ts sets no site, and feed links need one');
  return rss({
    title: 'The Doorman Fallacy',
    description: 'New cases and updates in the ledger of what happened after organisations cut roles for AI.',
    site: context.site,
    items: feedItems(await getCollection('cases')),
  });
}

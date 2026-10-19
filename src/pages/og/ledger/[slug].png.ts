import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { pngResponse, renderCard } from '../../../og/render.ts';
import { caseCard } from '../../../lib/share.ts';

export const getStaticPaths = (async () => {
  const entries = await getCollection('cases');
  return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}) satisfies GetStaticPaths;

interface Props {
  entry: CollectionEntry<'cases'>;
}

export const GET: APIRoute<Props> = async ({ props }) => pngResponse(await renderCard(caseCard(props.entry)));

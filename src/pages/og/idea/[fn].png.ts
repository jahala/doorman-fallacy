import type { APIRoute, GetStaticPaths } from 'astro';
import { hiddenFunctionIds, type HiddenFunctionId } from '../../../data/hidden-functions.ts';
import { pngResponse, renderCard } from '../../../og/render.ts';
import { ideaCard } from '../../../lib/share.ts';

export const getStaticPaths = (() => hiddenFunctionIds.map((fn) => ({ params: { fn } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => pngResponse(await renderCard(ideaCard(params['fn'] as HiddenFunctionId)));

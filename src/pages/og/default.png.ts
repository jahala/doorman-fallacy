import type { APIRoute } from 'astro';
import { pngResponse, renderCard } from '../../og/render.ts';
import { siteCard } from '../../lib/share.ts';

export const GET: APIRoute = async () => pngResponse(await renderCard(siteCard()));

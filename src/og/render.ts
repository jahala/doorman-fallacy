import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import tokensCss from '../styles/tokens.css?raw';
import { cardElement, cardSize, type ShareCard } from '../lib/share.ts';
import { schemePalette, type Palette } from '../lib/tokens.ts';

/**
 * Share cards as PNG files, at build time and with no browser. This is the edge: it reads the
 * font files and runs the renderers. satori reads WOFF, TTF and OTF but not WOFF2, so the cards
 * use the .woff files of @fontsource/prata and the static @fontsource/inter. The layout itself
 * is a pure function in lib/share.ts.
 */
const fontFiles = [
  { name: 'Prata', weight: 400, specifier: '@fontsource/prata/files/prata-latin-400-normal.woff' },
  { name: 'Inter', weight: 400, specifier: '@fontsource/inter/files/inter-latin-400-normal.woff' },
  { name: 'Inter', weight: 500, specifier: '@fontsource/inter/files/inter-latin-500-normal.woff' },
] as const;

function lightPalette(): Palette {
  const palette = schemePalette(tokensCss, 'light');
  if (palette === undefined) throw new Error('src/styles/tokens.css is missing a colour token that the share cards need');
  return palette;
}

const palette = lightPalette();

/** Read once per build: the same three files serve every card. */
const fonts = Promise.all(
  fontFiles.map(async ({ name, weight, specifier }) => ({
    name,
    weight,
    style: 'normal' as const,
    data: await readFile(fileURLToPath(import.meta.resolve(specifier))),
  })),
);

export async function renderCard(card: ShareCard): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await satori(cardElement(card, palette), { ...cardSize, fonts: await fonts });
  // satori has already turned the text into paths, so the renderer needs no fonts of its own.
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: cardSize.width }, font: { loadSystemFonts: false } });
  return new Uint8Array(png.render().asPng());
}

export function pngResponse(png: Uint8Array<ArrayBuffer>): Response {
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
}

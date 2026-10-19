import { readFileSync } from 'node:fs';
import path from 'node:path';
import { hiddenFunctionIds } from '../../src/data/hidden-functions.ts';
import { pngSize } from './png.ts';
import { builtRoutes, distDir, distFiles, expect, fileForPath, htmlFileForRoute, readBuilt, test } from './site.ts';

const origin = 'https://thedoormanfallacy.com';
const routes = builtRoutes();

/** The content of one meta tag, found by its property or name. */
function meta(html: string, key: string): string | undefined {
  for (const tag of html.matchAll(/<meta\s[^>]*>/g)) {
    const text = tag[0];
    const named = /\s(?:property|name)="([^"]*)"/.exec(text)?.[1];
    if (named === key) return /\scontent="([^"]*)"/.exec(text)?.[1]?.replaceAll('&#34;', '"').replaceAll('&amp;', '&');
  }
  return undefined;
}

test('the PNG reader reads the size of a PNG it can check: the 180 by 180 touch icon', () => {
  expect(pngSize(readFileSync(path.join(distDir, 'apple-touch-icon.png')))).toEqual({ width: 180, height: 180 });
  expect(pngSize(Buffer.from('not a png at all, just some text'))).toBeUndefined();
});

for (const route of routes) {
  test(`${route} has a title, description and image for Open Graph and Twitter, and the image is 1200 by 630`, () => {
    const html = readBuilt(htmlFileForRoute(route));
    expect(meta(html, 'og:title')).toBeTruthy();
    expect(meta(html, 'og:description')).toBeTruthy();
    expect(meta(html, 'og:site_name')).toBe('The Doorman Fallacy');
    // The 404 page is built as 404.html, and its address is /404/.
    expect(meta(html, 'og:url')).toBe(`${origin}${route.replace(/\.html$/, '/')}`);
    expect(['website', 'article']).toContain(meta(html, 'og:type'));
    expect(meta(html, 'og:image:width')).toBe('1200');
    expect(meta(html, 'og:image:height')).toBe('630');
    expect(meta(html, 'og:image:alt')).toBeTruthy();
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');
    expect(meta(html, 'twitter:title')).toBe(meta(html, 'og:title'));
    expect(meta(html, 'twitter:description')).toBe(meta(html, 'og:description'));
    expect(meta(html, 'twitter:image:alt')).toBe(meta(html, 'og:image:alt'));

    const image = meta(html, 'og:image');
    expect(image).toMatch(new RegExp(`^${origin}/og/.+\\.png$`));
    expect(meta(html, 'twitter:image')).toBe(image);
    const file = fileForPath(new URL(image ?? '', origin).pathname);
    expect(file, `${route} names ${image ?? 'no image'}, which is not in dist/`).toBeDefined();
    expect(pngSize(readFileSync(path.join(distDir, file ?? '')))).toEqual({ width: 1200, height: 630 });
  });

  test(`${route} links the favicon and the touch icon, and sets the theme colour from the paper colour`, () => {
    const html = readBuilt(htmlFileForRoute(route));
    expect(html).toMatch(/<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml"/);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
    expect(distFiles()).toContain('favicon.svg');
    expect(distFiles()).toContain('apple-touch-icon.png');
    expect(html).toMatch(/<meta name="theme-color" content="#faf9f7" media="\(prefers-color-scheme: light\)"/);
    expect(html).toMatch(/<meta name="theme-color" content="#121211" media="\(prefers-color-scheme: dark\)"/);
  });
}

test('each hidden function page, and each case page, names its own card; every other page names the site card', () => {
  const own = (route: string): string | undefined => {
    const idea = /^\/idea\/([^/]+)\/$/.exec(route)?.[1];
    if (idea !== undefined) return `${origin}/og/idea/${idea}.png`;
    const slug = /^\/ledger\/([^/]+)\/$/.exec(route)?.[1];
    return slug === undefined ? undefined : `${origin}/og/ledger/${slug}.png`;
  };
  const wrong = routes.flatMap((route) => {
    const image = meta(readBuilt(htmlFileForRoute(route)), 'og:image');
    const expected = own(route) ?? `${origin}/og/default.png`;
    return image === expected ? [] : [`${route}: ${image ?? 'none'}, expected ${expected}`];
  });
  expect(wrong).toEqual([]);
});

test('every hidden function and every case has a card in dist, and no card is left without a page', () => {
  const cards = distFiles().filter((file) => file.startsWith('og/')).sort();
  const cases = routes.flatMap((route) => /^\/ledger\/([^/]+)\/$/.exec(route)?.[1] ?? []);
  expect(cards).toEqual(
    ['og/default.png', ...hiddenFunctionIds.map((id) => `og/idea/${id}.png`), ...cases.map((slug) => `og/ledger/${slug}.png`)].sort(),
  );
});

test('no page names its title, description or image text with an em dash', () => {
  const found = routes.filter((route) => {
    const html = readBuilt(htmlFileForRoute(route));
    return ['og:title', 'og:description', 'og:image:alt'].some((key) => (meta(html, key) ?? '').includes('\u2014'));
  });
  expect(found).toEqual([]);
});

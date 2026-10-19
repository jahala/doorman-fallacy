import path from 'node:path';
import { builtRoutes, distFiles, expect, htmlFileForRoute, readBuilt, test } from './site.ts';

test('dist/ holds no script files and no build leftovers', () => {
  const files = distFiles();
  const scripts = files.filter((file) => ['.js', '.mjs', '.cjs'].includes(path.extname(file)));
  expect(scripts).toEqual([]);
  expect(files.filter((file) => file.startsWith('.prerender/'))).toEqual([]);
});

for (const route of builtRoutes()) {
  test(`${route} has no script elements, inline handlers or script links`, () => {
    const html = readBuilt(htmlFileForRoute(route));
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/modulepreload/i);
  });
}

test('the pages run no script in the browser', async ({ page, siteUrl }) => {
  await page.goto(new URL('/', siteUrl).href);
  expect(await page.locator('script').count()).toBe(0);
});

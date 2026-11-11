import path from 'node:path';
import { visitCount } from '../../src/data/visit-count.ts';
import { builtRoutes, distFiles, expect, htmlFileForRoute, readBuilt, test } from './site.ts';

// The site ships one script: the inline page-view counter (D-024). Nothing else runs in the browser.

test('dist/ holds no script files and no build leftovers', () => {
  const files = distFiles();
  const scripts = files.filter((file) => ['.js', '.mjs', '.cjs'].includes(path.extname(file)));
  expect(scripts).toEqual([]);
  expect(files.filter((file) => file.startsWith('.prerender/'))).toEqual([]);
});

for (const route of builtRoutes()) {
  test(`${route} has one script, the inline page-view counter, and no inline handlers or script links`, () => {
    const html = readBuilt(htmlFileForRoute(route));
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
    expect(scripts).toHaveLength(1);
    const [, attributes = '', body = ''] = scripts[0] ?? [];
    expect(attributes).not.toMatch(/\ssrc\s*=/i);
    expect(body).toContain(JSON.stringify(visitCount.intakeHost));
    expect(body).toContain('/i/v0/e/');
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/modulepreload/i);
  });
}

test('a page served from any other host, such as a test server, counts nothing', async ({ page, siteUrl }) => {
  const sent: string[] = [];
  await page.route(`https://${visitCount.intakeHost}/**`, async (route) => {
    sent.push(route.request().url());
    await route.fulfill({ status: 200, body: '{}' });
  });
  await page.goto(new URL('/', siteUrl).href);
  await page.waitForLoadState('networkidle');
  expect(sent).toEqual([]);
});

test('a page on the site’s own host sends one cookieless page view to its intake host, and stores nothing', async ({ page, siteUrl }) => {
  // Serve the built home page as if from the real host, and catch what the counter sends.
  await page.route(`https://${visitCount.siteHost}/**`, async (route) => {
    const local = new URL(new URL(route.request().url()).pathname, siteUrl).href;
    await route.fulfill({ response: await page.request.fetch(local) });
  });
  const bodies: unknown[] = [];
  await page.route(`https://${visitCount.intakeHost}/**`, async (route) => {
    bodies.push(JSON.parse(route.request().postData() ?? 'null'));
    await route.fulfill({ status: 200, body: '{}' });
  });
  const sentOne = page.waitForRequest(`https://${visitCount.intakeHost}/i/v0/e/`);
  await page.goto(`https://${visitCount.siteHost}/ledger`);
  await sentOne;
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({
    api_key: visitCount.token,
    batch: [{ event: '$pageview', properties: { distinct_id: '$posthog_cookieless', $cookieless_mode: true, $pathname: '/ledger' } }],
  });
  expect(await page.context().cookies()).toEqual([]);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
});

test('a visitor who asks not to be tracked sends nothing, even on the site’s own host', async ({ browser, siteUrl }) => {
  const context = await browser.newContext({ extraHTTPHeaders: { DNT: '1' } });
  const page = await context.newPage();
  await page.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }));
  await page.route(`https://${visitCount.siteHost}/**`, async (route) => {
    const local = new URL(new URL(route.request().url()).pathname, siteUrl).href;
    await route.fulfill({ response: await page.request.fetch(local) });
  });
  const sent: string[] = [];
  await page.route(`https://${visitCount.intakeHost}/**`, async (route) => {
    sent.push(route.request().url());
    await route.fulfill({ status: 200, body: '{}' });
  });
  await page.goto(`https://${visitCount.siteHost}/`);
  await page.waitForLoadState('networkidle');
  expect(sent).toEqual([]);
  await context.close();
});

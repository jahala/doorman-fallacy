import { hiddenFunctions } from '../../src/data/hidden-functions.ts';
import { statuses } from '../../src/data/statuses.ts';
import { builtRoutes, expect, test } from './site.ts';

const contentPages = [
  { route: '/idea/', h1: 'The doorman fallacy', current: 'The idea' },
  { route: '/approach/', h1: 'How the ledger is kept', current: undefined },
  { route: '/privacy/', h1: 'Privacy', current: undefined },
  { route: '/about/', h1: 'About', current: 'About' },
  { route: '/checks/your-hidden-job/', h1: 'Your hidden job', current: undefined },
  { route: '/checks/before-you-cut/', h1: 'Before you cut', current: undefined },
] as const;

test('every content page is built', () => {
  const built = builtRoutes();
  expect(contentPages.map((entry) => entry.route).filter((route) => !built.includes(route))).toEqual([]);
});

for (const { route, h1, current } of contentPages) {
  test(`${route} has one h1, the right title and the right current nav item`, async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText(h1);
    const marked = page.locator('.site-nav a[aria-current="page"]');
    if (current === undefined) await expect(marked).toHaveCount(0);
    else await expect(marked).toHaveText(current);
  });
}

test('/idea lists the six hidden functions from the data file, and the portrait beside its credit', async ({
  page,
  siteUrl,
}) => {
  await page.goto(new URL('/idea/', siteUrl).href);
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'The hidden work' }) });
  for (const { label, meaning } of Object.values(hiddenFunctions)) {
    await expect(section).toContainText(label);
    await expect(section).toContainText(meaning);
  }
  await expect(page.locator('figure.photo')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'See what happened in practice' })).toHaveAttribute('href', '/ledger');
  await expect(page.getByRole('link', { name: 'Before the decision: two printable guides' })).toHaveAttribute(
    'href',
    '/checks/your-hidden-job',
  );
  await expect(page.locator('main')).toContainText('The idea and the story are Rory Sutherland');
});

test('/approach lists every status from the data file', async ({ page, siteUrl }) => {
  await page.goto(new URL('/approach/', siteUrl).href);
  const table = page.locator('table');
  for (const { label, meaning } of Object.values(statuses)) {
    await expect(table).toContainText(label);
    await expect(table).toContainText(meaning);
  }
});

test('/checks/before-you-cut has one table row per hidden function, with two empty columns to write in', async ({
  page,
  siteUrl,
}) => {
  await page.goto(new URL('/checks/before-you-cut/', siteUrl).href);
  const rows = page.locator('table tbody tr');
  expect(await rows.count()).toBe(Object.keys(hiddenFunctions).length);
  for (const [index, { label, meaning }] of Object.values(hiddenFunctions).entries()) {
    const row = rows.nth(index);
    await expect(row).toContainText(label);
    await expect(row).toContainText(meaning);
    await expect(row.locator('td.checklist__cell')).toHaveCount(2);
    await expect(row.locator('td.checklist__cell').first()).toHaveText('');
  }
});

test('each guide links to its companion', async ({ page, siteUrl }) => {
  await page.goto(new URL('/checks/your-hidden-job/', siteUrl).href);
  await expect(page.getByRole('link', { name: 'Before you cut' })).toHaveAttribute('href', '/checks/before-you-cut');
  await page.goto(new URL('/checks/before-you-cut/', siteUrl).href);
  await expect(page.getByRole('link', { name: 'Your hidden job' })).toHaveAttribute('href', '/checks/your-hidden-job');
});

test('/checks/your-hidden-job tags only the six hidden functions, from the data file, in ink-2 and never colour-coded', async ({
  page,
  siteUrl,
}) => {
  await page.goto(new URL('/checks/your-hidden-job/', siteUrl).href);
  const tags = page.locator('.checklist__tag');
  expect(await tags.allTextContents()).toEqual(
    Object.values(hiddenFunctions).map(({ label }) => `(${label})`),
  );
  const colours = await tags.evaluateAll((elements) => [...new Set(elements.map((e) => getComputedStyle(e).color))]);
  const ink2 = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.className = 'ink-2';
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
  expect(colours).toEqual([ink2]);
});

for (const { route } of contentPages) {
  test(`${route}: no link is glued to the word before it`, async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const glued = await page.locator('main a').evaluateAll((anchors) =>
      anchors
        .map((anchor) => ({ text: anchor.textContent.trim(), before: anchor.previousSibling?.textContent ?? '' }))
        .filter(({ before }) => before !== '' && !/[\s(‘“]$/.test(before))
        .map(({ text, before }) => `${before.slice(-12)}|${text}`),
    );
    expect(glued).toEqual([]);
  });
}

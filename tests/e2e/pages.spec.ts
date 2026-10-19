import { hiddenFunctionIds, hiddenFunctions } from '../../src/data/hidden-functions.ts';
import { statuses } from '../../src/data/statuses.ts';
import { builtRoutes, expect, test } from './site.ts';

const hiddenWorkPages = hiddenFunctionIds.map((id) => ({
  route: `/idea/${id}/`,
  h1: hiddenFunctions[id].label,
  current: 'The idea',
}));

const contentPages = [
  { route: '/idea/', h1: 'The doorman fallacy', current: 'The idea' },
  ...hiddenWorkPages,
  { route: '/ledger/', h1: 'The ledger', current: 'The ledger' },
  { route: '/approach/', h1: 'How the ledger is kept', current: 'The ledger' },
  { route: '/suggest/', h1: 'Suggest a case', current: 'The ledger' },
  { route: '/privacy/', h1: 'Privacy', current: undefined },
  { route: '/about/', h1: 'About', current: 'About' },
] satisfies readonly { route: string; h1: string; current: string | undefined }[];

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
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'The hidden work', exact: true }) });
  for (const { label, meaning } of Object.values(hiddenFunctions)) {
    await expect(section).toContainText(label);
    await expect(section).toContainText(meaning);
  }
  await expect(page.locator('figure.photo')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'More pages' }).getByRole('link', { name: /The ledger/ })).toHaveAttribute('href', '/ledger');
  await expect(page.locator('main')).toContainText('The idea and the story are Rory Sutherland');
});

test('/ledger#statuses lists every status from the data file', async ({ page, siteUrl }) => {
  await page.goto(new URL('/ledger/', siteUrl).href);
  const table = page.locator('#statuses table');
  for (const { label, meaning } of Object.values(statuses)) {
    await expect(table).toContainText(label);
    await expect(table).toContainText(meaning);
  }
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

test('/ledger#watch lists what to watch after an announcement, from the data file', async ({ page, siteUrl }) => {
  const { afterSigns } = await import('../../src/data/signs.ts');
  await page.goto(new URL('/ledger/', siteUrl).href);
  const after = page.locator('#watch');
  for (const sign of afterSigns) await expect(after.getByText(sign.title)).toBeVisible();
});


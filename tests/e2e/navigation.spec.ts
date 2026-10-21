import type { Page } from '@playwright/test';
import { expect, readBuilt, test } from './site.ts';

const firstCase = (JSON.parse(readBuilt('ledger.json')) as { cases: { slug: string; short: string }[] }).cases[0];

/** The computed font size of a type token class, as the page renders it. */
function sizeOf(page: Page, className: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('p');
    probe.className = name;
    document.body.append(probe);
    const size = getComputedStyle(probe).fontSize;
    probe.remove();
    return size;
  }, className);
}

/** Every heading of one level in main, with its text, font size and family. */
function headingsOf(page: Page, level: string): Promise<{ text: string; size: string; family: string }[]> {
  return page.locator(`main ${level}:not(.visually-hidden):not(.sr-only)`).evaluateAll((elements) =>
    elements.map((element) => ({
      text: element.textContent.trim(),
      size: getComputedStyle(element).fontSize,
      family: getComputedStyle(element).fontFamily,
    })),
  );
}

// One hierarchy everywhere: the home page sets its section headings a step larger than the text pages.
const scales = [
  { route: '/', h1: 't-hero', h2: 't-display', h3: 't-title' },
  ...['/idea/', '/ledger/', `/ledger/${firstCase?.slug ?? ''}/`, '/approach/', '/privacy/', '/about/'].map((route) => ({
    route,
    h1: 't-display',
    h2: 't-title',
    h3: 't-subhead',
  })),
];

for (const { route, h1, h2, h3 } of scales) {
  test(`${route} sets h1 in ${h1}, h2 in ${h2} and h3 in ${h3}, all in the heading face`, async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    if (route === '/') expect(await headingsOf(page, 'h2')).toContainEqual(expect.objectContaining({ text: 'Updates from the ledger', size: await sizeOf(page, 't-title') }));
    const want = { h1: await sizeOf(page, h1), h2: await sizeOf(page, h2), h3: await sizeOf(page, h3) };
    for (const level of ['h1', 'h2', 'h3'] as const) {
      // The sign-up at the foot of the home page is a form, so its heading is a step smaller.
      const found = (await headingsOf(page, level)).filter(({ text }) => !(route === '/' && text === 'Updates from the ledger'));
      for (const heading of found) {
        expect(heading.size, `${level} "${heading.text}"`).toBe(want[level]);
        expect(heading.family, `${level} "${heading.text}"`).toContain('Prata');
      }
    }
  });
}

test('only the home page title is set at the hero size, a fifth larger than every other title', async ({ page, siteUrl }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(siteUrl);
  const hero = Number.parseFloat(await sizeOf(page, 't-hero'));
  const display = Number.parseFloat(await sizeOf(page, 't-display'));
  expect(display / hero).toBeCloseTo(0.8, 2);
  expect(Number.parseFloat(await page.locator('h1').evaluate((element) => getComputedStyle(element).fontSize))).toBe(hero);
  await expect(page.locator('main .t-hero')).toHaveCount(1);
});

for (const route of ['/idea/', '/ledger/', '/approach/']) {
  test(`${route} lists its sections on the page, numbered as the sections are`, async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const contents = page.getByRole('navigation', { name: 'On this page' });
    const items = await contents.locator('a').evaluateAll((anchors) =>
      anchors.map((anchor) => ({
        id: (anchor.getAttribute('href') ?? '').replace(/^#/, ''),
        number: anchor.querySelector('.section-number')?.textContent.trim(),
        label: anchor.querySelector('.contents__label')?.textContent.trim(),
      })),
    );
    const sections = await page.locator('main section:has(> .text-section__head > .section-number)').evaluateAll((elements) =>
      elements.map((element) => ({
        id: element.id,
        number: element.querySelector('.section-number')?.textContent.trim(),
        label: element.querySelector('h2')?.textContent.trim(),
      })),
    );
    expect(items.length).toBeGreaterThan(1);
    expect(items).toEqual(sections);
  });
}

const trails = [
  { route: '/approach/', trail: [['The ledger', '/ledger']], here: 'How the ledger is kept' },
  { route: '/suggest/', trail: [['The ledger', '/ledger']], here: 'Suggest a case' },
  { route: `/ledger/${firstCase?.slug ?? ''}/`, trail: [['The ledger', '/ledger']], here: firstCase?.short ?? '' },
];

for (const { route, trail, here } of trails) {
  test(`${route} shows where it sits, ending with the page itself`, async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    const links = await crumbs.locator('a').evaluateAll((anchors) => anchors.map((anchor) => [anchor.textContent.trim(), anchor.getAttribute('href')]));
    expect(links).toEqual(trail);
    await expect(crumbs.locator('li[aria-current="page"]')).toHaveText(here);
    await expect(page.locator('h1')).toHaveText(here);
  });
}

for (const route of ['/', '/idea/', '/ledger/', '/about/', '/privacy/']) {
  test(`${route} is a top-level page, so it shows no breadcrumb`, async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveCount(0);
  });
}

test('the case pages mark their section of the site in the header', async ({ page, siteUrl }) => {
  for (const [route, current] of [
    [`/ledger/${firstCase?.slug ?? ''}/`, 'The ledger'],
  ] as const) {
    await page.goto(new URL(route, siteUrl).href);
    await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveText(current);
  }
});

test('the footer is a site map in three groups: the idea, the ledger and the site', async ({ page, siteUrl }) => {
  await page.goto(siteUrl);
  const map = page.getByRole('navigation', { name: 'Site map' });
  expect(await map.locator(':scope > div > p').allInnerTexts()).toEqual(['The idea', 'The ledger', 'The site']);
  for (const href of ['/idea#questions', '/ledger', '/approach', '/suggest', '/about', '/privacy', '/rss.xml']) {
    await expect(map.locator(`a[href="${href}"]`)).toHaveCount(1);
  }
});

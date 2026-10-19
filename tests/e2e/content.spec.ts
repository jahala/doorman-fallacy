import { builtRoutes, expect, test } from './site.ts';

for (const route of builtRoutes()) {
  test(`${route}: the arrow marks external links and only external links`, async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const links = await page.locator('a[href]').evaluateAll((anchors) =>
      anchors.map((anchor) => ({
        href: anchor.getAttribute('href') ?? '',
        text: anchor.textContent,
      })),
    );
    const wrong = links.filter(({ href, text }) => /^https?:/.test(href) !== text.includes('↗'));
    expect(wrong).toEqual([]);
  });

  test(`${route}: every photograph has a caption and a credit to its photographer`, async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const images = await page.locator('img').count();
    const figures = page.locator('figure.photo');
    expect(await figures.locator('img').count()).toBe(images);
    for (const figure of await figures.all()) {
      const caption = figure.locator('figcaption');
      await expect(caption).toContainText('Unsplash');
      await expect(caption.locator('a[href^="https://unsplash.com/@"]')).toHaveCount(1);
      await expect(caption.locator('a[href^="https://unsplash.com/photos/"]')).toHaveCount(1);
    }
  });

  test(`${route}: pages carry no text with an em dash`, async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    expect(await page.locator('body').innerText()).not.toContain('\u2014');
  });

  test(`${route}: nothing scrolls sideways on a 375px phone`, async ({ page, siteUrl }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(new URL(route, siteUrl).href);
    const widths = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      window: window.innerWidth,
    }));
    expect(widths.content).toBeLessThanOrEqual(widths.window);
  });
}

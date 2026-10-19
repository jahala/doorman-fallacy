import { expect, test } from './site.ts';
import { pdfPageCount } from './pdf.ts';

const guides = ['/checks/your-hidden-job/', '/checks/before-you-cut/'] as const;
const formats = ['A4', 'Letter'] as const;

/** 10pt in CSS pixels. Chromium rounds sizes to the pixel, so the floor allows a hair less. */
const tenPointPx = 13.3;

/** 8mm in CSS pixels: room for a line of handwriting. */
const minCellPx = 30;

test('the page counter sees more than one page in a page that prints on several (instrument check)', async ({
  page,
  siteUrl,
}) => {
  await page.goto(new URL('/specimen/', siteUrl).href);
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ format: 'A4' });
  expect(pdfPageCount(pdf)).toBeGreaterThan(1);
});

for (const guide of guides) {
  for (const format of formats) {
    test(`${guide} prints on exactly one ${format} page`, async ({ page, siteUrl }) => {
      await page.goto(new URL(guide, siteUrl).href);
      await page.emulateMedia({ media: 'print' });
      const pdf = await page.pdf({ format });
      expect(pdfPageCount(pdf)).toBe(1);
    });
  }

  test(`${guide} prints with no navigation, the address and licence at the foot, and no text under 10pt`, async ({
    page,
    siteUrl,
  }) => {
    const address = new URL(guide, 'https://thedoormanfallacy.com').href;
    await page.goto(new URL(guide, siteUrl).href);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.site-header')).toBeHidden();
    await expect(page.locator('nav:visible')).toHaveCount(0);
    await expect(page.locator('form, button, input')).toHaveCount(0);
    const text = await page.locator('body').innerText();
    expect(text).toContain(address);
    expect(text).toContain('thedoormanfallacy.com · CC BY 4.0');
    const small = await page.evaluate((floor) => {
      const found: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const element = node.parentElement;
        if (element === null || (node.textContent ?? '').trim() === '') continue;
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (element.getClientRects().length === 0) continue;
        const size = parseFloat(style.fontSize);
        if (size < floor) found.push(`${String(size)}px: ${(node.textContent ?? '').trim().slice(0, 40)}`);
      }
      return found;
    }, tenPointPx);
    expect(small).toEqual([]);
  });

  test(`${guide} gives every question at least two ruled writing lines in print, or a table cell tall enough to write in`, async ({
    page,
    siteUrl,
  }) => {
    await page.goto(new URL(guide, siteUrl).href);
    await page.emulateMedia({ media: 'print' });
    const questions = page.locator('.checklist__question');
    expect(await questions.count()).toBeGreaterThan(0);
    for (const question of await questions.all()) {
      const cells = question.locator('td.checklist__cell');
      if ((await cells.count()) > 0) {
        for (const cell of await cells.all()) {
          const box = await cell.boundingBox();
          expect(box?.height ?? 0).toBeGreaterThanOrEqual(minCellPx);
        }
        continue;
      }
      const lines = question.locator('.checklist__line');
      expect(await lines.count()).toBeGreaterThanOrEqual(2);
      for (const line of await lines.all()) {
        const border = await line.evaluate((element) => getComputedStyle(element).borderBottomWidth);
        expect(parseFloat(border)).toBeGreaterThan(0);
      }
    }
  });
}

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { questions } from '../../src/data/questions.ts';
import { expect, test } from './site.ts';

test('/idea#questions gives each question its ideas, with every source, linking those that have an address', async ({ page, siteUrl }) => {
  await page.goto(new URL('/idea/', siteUrl).href);
  const rows = page.locator('#questions .question:not(#signs)');
  await expect(rows).toHaveCount(questions.length);
  for (const [index, question] of questions.entries()) {
    const row = rows.nth(index);
    await expect(row.getByRole('heading', { level: 3 })).toHaveText(question.title);
    await expect(row).toContainText(question.ask);
    for (const part of question.parts) {
      await expect(row).toContainText(part.title);
      await expect(row).toContainText(part.detail);
      for (const source of part.sources) {
        if (source.href === undefined) await expect(row).toContainText(source.cite);
        else await expect(row.locator(`a[href="${source.href}"]`)).toContainText(source.cite);
      }
    }
  }
});

test('every illustration is a figure with a caption, and its icons are hidden from assistive technology', async ({ page, siteUrl }) => {
  for (const [route, selector] of [
    ['/idea/', 'figure.where'],
    ['/ledger/', 'figure.saved-lost'],
  ] as const) {
    await page.goto(new URL(route, siteUrl).href);
    const figure = page.locator(selector);
    await expect(figure.locator('figcaption')).not.toBeEmpty();
    const exposed = await figure.locator('svg').evaluateAll((svgs) => svgs.filter((svg) => svg.getAttribute('aria-hidden') !== 'true').length);
    expect(exposed, `${route} ${selector}`).toBe(0);
  }
});

test('no SVG on any page writes a colour of its own; they all take currentColor from the tokens', async () => {
  const dist = path.resolve(import.meta.dirname, '../../dist');
  const pages: string[] = [];
  const walk = async (folder: string): Promise<void> => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.html')) pages.push(full);
    }
  };
  await walk(dist);
  const colour = /<svg[\s\S]*?<\/svg>/g;
  const literal = /(fill|stroke|stop-color|color)="(#|rgb|hsl)[^"]*"/;
  const offenders: string[] = [];
  for (const file of pages) {
    for (const svg of (await readFile(file, 'utf8')).match(colour) ?? []) {
      if (literal.test(svg)) offenders.push(path.relative(dist, file));
    }
  }
  expect(offenders).toEqual([]);
});

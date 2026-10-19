import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { hiddenFunctionIds, hiddenFunctions } from '../../src/data/hidden-functions.ts';
import { modelSteps } from '../../src/data/model.ts';
import { expect, test } from './site.ts';

test('the home page shows the whole job: the visible task, and each kind of hidden work linking to its page', async ({
  page,
  siteUrl,
}) => {
  await page.goto(siteUrl);
  const figure = page.locator('figure.whole-job');
  await expect(figure.locator('figcaption')).toHaveText(/job description draws the box in the middle/);
  await expect(figure.locator('.whole-job__task')).toContainText('Opening the door');
  for (const id of hiddenFunctionIds) {
    await expect(figure.getByRole('link', { name: hiddenFunctions[id].label })).toHaveAttribute('href', `/idea/${id}`);
  }
});

test('the home page lists the five steps by title, from the data file, and links to them with sources', async ({ page, siteUrl }) => {
  await page.goto(siteUrl);
  const steps = page.locator('.model__steps li');
  await expect(steps).toHaveCount(modelSteps.length);
  for (const [index, step] of modelSteps.entries()) await expect(steps.nth(index)).toContainText(step.title);
  await expect(page.getByRole('link', { name: 'The five steps, with their sources' })).toHaveAttribute('href', '/idea#model');
});

test('/idea#model gives each step its detail and every source, linking those that have an address', async ({ page, siteUrl }) => {
  await page.goto(new URL('/idea/', siteUrl).href);
  const items = page.locator('#model .model-steps__item');
  await expect(items).toHaveCount(modelSteps.length);
  for (const [index, step] of modelSteps.entries()) {
    const item = items.nth(index);
    await expect(item).toContainText(step.title);
    await expect(item).toContainText(step.detail);
    for (const source of step.sources) {
      if (source.href === undefined) await expect(item).toContainText(source.cite);
      else await expect(item.locator(`a[href="${source.href}"]`)).toContainText(source.cite);
    }
  }
});

test('every illustration is a figure with a caption, and its icons are hidden from assistive technology', async ({ page, siteUrl }) => {
  for (const [route, selector] of [
    ['/', 'figure.whole-job'],
    ['/idea/', 'figure.where'],
    ['/idea/', 'figure.saved-lost'],
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

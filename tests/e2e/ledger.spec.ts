import { builtRoutes, expect, fileForPath, readBuilt, test } from './site.ts';

const casePages = builtRoutes().filter((route) => /^\/ledger\/[^/]+\/$/.test(route));

test('the site builds a page for every case, and the DNB case is one of them', () => {
  expect(casePages).toContain('/ledger/dnb-2026/');
});

test('the ledger lists every case, each row linking to its page', async ({ page, siteUrl }) => {
  await page.goto(new URL('/ledger', siteUrl).href);
  const hrefs = await page.locator('table.ledger tbody a').evaluateAll((anchors) =>
    anchors.map((anchor) => anchor.getAttribute('href')),
  );
  expect(hrefs.map((href) => `${href ?? ''}/`).sort()).toEqual(casePages);
  await expect(page.locator('.ledger-count').getByRole('link', { name: 'How the ledger is kept' })).toHaveAttribute('href', '/approach');
  await expect(page.getByRole('link', { name: 'The ledger', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('the ledger writes each status as a word and never as a pill', async ({ page, siteUrl }) => {
  await page.goto(new URL('/ledger', siteUrl).href);
  const row = page.locator('table.ledger tbody tr').first();
  await expect(row.locator('.ledger__status')).toHaveText('Too early to tell');
  const style = await row.locator('.ledger__status').evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, radius: computed.borderRadius };
  });
  expect(style).toEqual({ background: 'rgba(0, 0, 0, 0)', radius: '0px' });
});

test('the home page previews at most five cases and says how many the ledger holds', async ({ page, siteUrl }) => {
  await page.goto(new URL('/', siteUrl).href);
  const rows = await page.locator('table.ledger tbody tr').count();
  expect(rows).toBeGreaterThan(0);
  expect(rows).toBeLessThanOrEqual(5);
  await expect(page.locator('table.ledger caption')).toContainText(`${casePages.length === 1 ? '1 case' : `${String(casePages.length)} cases`} in the ledger, newest first.`);
  await expect(page.getByText('Example rows')).toHaveCount(0);
});

for (const route of casePages) {
  test.describe(route, () => {
    test('has the sections in order, with the analysis labelled as analysis', async ({ page, siteUrl }) => {
      await page.goto(new URL(route, siteUrl).href);
      const headings = await page.locator('article h2').allInnerTexts();
      for (const expected of ['Reported', 'The doorman reading', 'Timeline', 'Changelog', 'Sources', 'Report an error']) {
        expect(headings).toContain(expected);
      }
      expect(headings.indexOf('Reported')).toBeLessThan(headings.indexOf('The doorman reading'));
      expect(headings.indexOf('Sources')).toBeLessThan(headings.indexOf('Report an error'));
      await expect(page.locator('#reading').locator('xpath=..').getByText('Analysis.')).toBeVisible();
    });

    test('shows the facts row with its five facts', async ({ page, siteUrl }) => {
      await page.goto(new URL(route, siteUrl).href);
      expect(await page.locator('dl.facts dt').allInnerTexts()).toEqual([
        'Status',
        'Roles',
        'The door',
        'Last checked',
        'Next review',
      ]);
    });

    test('every footnote reference reaches a footnote that shows a quote, and each source has an archived copy', async ({ page, siteUrl }) => {
      await page.goto(new URL(route, siteUrl).href);
      const references = page.locator('a[data-footnote-ref]');
      const footnotes = page.locator('.footnotes li');
      expect(await references.count()).toBeGreaterThan(0);
      expect(await footnotes.count()).toBe(await references.count());
      for (const text of await footnotes.allInnerTexts()) expect(text).toMatch(/^[“"].+[”"]/);
      const sources = page.locator('.sources__item');
      for (const source of await sources.all()) {
        await expect(source.getByRole('link', { name: /Archived copy/ })).toHaveAttribute('href', /^https:\/\/web\.archive\.org\//);
      }
    });

    test('the error form posts to the Worker with the case and kind, and has an empty honeypot', async ({ page, siteUrl }) => {
      await page.goto(new URL(route, siteUrl).href);
      const slug = route.split('/')[2] ?? '';
      const form = page.locator('form[action="/api/suggest"]');
      await expect(form).toHaveAttribute('method', 'post');
      await expect(form.locator('input[name="case"]')).toHaveAttribute('value', slug);
      await expect(form.locator('input[name="kind"]')).toHaveAttribute('value', 'error');
      const note = form.locator('textarea[name="note"]');
      await expect(note).toHaveAttribute('required', '');
      await expect(note).toHaveAttribute('maxlength', '2000');
      await expect(form.getByLabel('What is wrong, and where did you see the right information?')).toHaveCount(1);
      await expect(form.locator('input[name="email"]')).toHaveAttribute('type', 'email');
      const trap = form.locator('input[name="website"]');
      await expect(trap).toHaveAttribute('tabindex', '-1');
      await expect(trap).toHaveAttribute('autocomplete', 'off');
      await expect(trap).toHaveValue('');
      await expect(form.getByLabel('Leave this empty')).toHaveCount(1);
      await expect(form.getByRole('button', { name: 'Send' })).toBeVisible();
    });

    test('links to the history of the case on GitHub', async ({ page, siteUrl }) => {
      await page.goto(new URL(route, siteUrl).href);
      const slug = route.split('/')[2] ?? '';
      await expect(page.getByRole('link', { name: /History of this case/ })).toHaveAttribute(
        'href',
        `https://github.com/jahala/doorman-fallacy/commits/master/src/content/cases/${slug}.md`,
      );
    });
  });
}

test.describe('the feed', () => {
  const feed = readBuilt('rss.xml');
  const items = [...feed.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1] ?? '');

  test('has one item per case, linking to its page', () => {
    expect(items.length).toBe(casePages.length);
    const links = items.map((item) => /<link>([^<]+)<\/link>/.exec(item)?.[1] ?? '');
    expect(links.map((link) => new URL(link).pathname).sort()).toEqual(casePages);
    for (const link of links) {
      expect(link.startsWith('https://thedoormanfallacy.com/')).toBe(true);
      expect(fileForPath(new URL(link).pathname)).toBeDefined();
    }
  });

  test('titles each item with the short name and the change, and gives a date and a description', () => {
    expect(items.some((item) => item.includes('<title>DNB: About 400 roles cut as AI agents take on tasks.</title>'))).toBe(true);
    for (const item of items) {
      expect(item).toMatch(/<pubDate>[^<]+<\/pubDate>/);
      expect(item).toMatch(/<description>[^<]+<\/description>/);
    }
  });

  test('is announced in the head of every page', async ({ page, siteUrl }) => {
    for (const route of builtRoutes()) {
      await page.goto(new URL(route, siteUrl).href);
      await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute('href', '/rss.xml');
    }
  });

  test('is served as XML and carries no em dash', async ({ request, siteUrl }) => {
    const response = await request.get(new URL('/rss.xml', siteUrl).href);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('xml');
    expect(await response.text()).not.toContain('—');
  });
});

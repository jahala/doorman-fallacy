import type { Locator, Page } from '@playwright/test';
import { citation, definition } from '../../src/data/definition.ts';
import { hiddenFunctionIds, hiddenFunctions } from '../../src/data/hidden-functions.ts';
import { questions } from '../../src/data/questions.ts';
import { statusIds, statuses } from '../../src/data/statuses.ts';
import { expect, readBuilt, test } from './site.ts';

/** The cases as the published dataset has them: the pages must agree with it. */
interface DatasetCase {
  readonly slug: string;
  readonly status: (typeof statusIds)[number];
  readonly missed: readonly string[];
}
const dataset = JSON.parse(readBuilt('ledger.json')) as { cases: DatasetCase[] };
const caseCount = dataset.cases.length;

async function headings(page: Page): Promise<string[]> {
  return page.locator('main h2').allInnerTexts();
}

/** The computed size of an element that carries a type token class, as the page really renders it. */
async function sizeOf(page: Page, className: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('p');
    probe.className = name;
    document.body.append(probe);
    const size = getComputedStyle(probe).fontSize;
    probe.remove();
    return size;
  }, className);
}

async function colourOf(page: Page, className: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('p');
    probe.className = name;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, className);
}

function style(locator: Locator): Promise<{ family: string; size: string; weight: string; fontStyle: string; colour: string; top: string }> {
  return locator.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      family: computed.fontFamily,
      size: computed.fontSize,
      weight: computed.fontWeight,
      fontStyle: computed.fontStyle,
      colour: computed.color,
      top: computed.borderTopWidth,
    };
  });
}

test.describe('the home page', () => {
  test('keeps its sections in order after the hero', async ({ page, siteUrl }) => {
    await page.goto(new URL('/', siteUrl).href);
    expect(await headings(page)).toEqual(['The work beyond the task.', 'The ledger', 'Updates from the ledger']);
    await expect(page.locator('h1')).toHaveText('What does a doorman actually do?');
  });

  test('names the six kinds of hidden work from the data file, each linking to its page, then links on to the questions', async ({ page, siteUrl }) => {
    await page.goto(new URL('/', siteUrl).href);
    const items = page.locator('section.beyond li');
    await expect(items).toHaveCount(hiddenFunctionIds.length);
    for (const [index, id] of hiddenFunctionIds.entries()) {
      const item = items.nth(index);
      await expect(item.getByRole('link', { name: hiddenFunctions[id].label })).toHaveAttribute('href', `/idea#${id}`);
      await expect(item).toContainText(hiddenFunctions[id].meaning);
    }
    await expect(page.locator('section.beyond').getByRole('link', { name: 'Before automating a role' })).toHaveAttribute('href', '/idea#questions');
  });

  test('previews the ledger without column heads in view, each row showing its status under the change', async ({ page, siteUrl }) => {
    await page.goto(new URL('/', siteUrl).href);
    const table = page.locator('table.ledger');
    await expect(table.locator('thead')).toHaveClass(/visually-hidden/);
    for (const row of await table.locator('tbody tr').all()) await expect(row).toContainText('Reported outcome: ');
    await expect(page.getByRole('link', { name: 'View all cases' })).toHaveAttribute('href', '/ledger');
  });
});

test.describe('the ledger summary', () => {
  const counted = statusIds
    .map((id) => ({ id, count: dataset.cases.filter((item) => item.status === id).length }))
    .filter(({ count }) => count > 0);
  const sentence = `${caseCount === 1 ? '1 case' : `${String(caseCount)} cases`}: ${counted
    .map(({ id, count }) => `${String(count)} ${statuses[id].label.toLowerCase()}`)
    .join(', ')}.`;

  for (const route of ['/ledger/']) {
    test(`on ${route} states the count and the statuses that have cases, and links each hidden function recorded as missing`, async ({
      page,
      siteUrl,
    }) => {
      await page.goto(new URL(route, siteUrl).href);
      const summary = page.locator('.ledger-summary');
      await expect(summary.locator('.ledger-summary__sentence')).toHaveText(sentence);
      const wanted = hiddenFunctionIds
        .map((id) => ({ id, count: dataset.cases.filter((item) => item.missed.includes(id)).length }))
        .filter(({ count }) => count > 0);
      const row = summary.locator('.ledger-summary__missing');
      if (wanted.length === 0) {
        await expect(row).toHaveCount(0);
        return;
      }
      await expect(row).toContainText('Hidden work recorded as missing:');
      const items = row.locator('li');
      await expect(items).toHaveCount(wanted.length);
      for (const [index, { id, count }] of wanted.entries()) {
        const item = items.nth(index);
        await expect(item.getByRole('link', { name: hiddenFunctions[id].label })).toHaveAttribute('href', `/idea#${id}`);
        await expect(item).toContainText(String(count));
      }
    });
  }
});

test.describe('/ledger', () => {
  test('keeps its sections in order', async ({ page, siteUrl }) => {
    await page.goto(new URL('/ledger/', siteUrl).href);
    expect(await headings(page)).toEqual([
      'The cases',
      'What the ledger watches for',
      'Statuses and follow-up',
      'What is known beyond the ledger',
      'The data',
    ]);
  });

  test('has the summary above the table', async ({ page, siteUrl }) => {
    await page.goto(new URL('/ledger/', siteUrl).href);
    const order = await page.locator('#cases').evaluate((element) => {
      const summary = element.querySelector('.ledger-summary');
      const table = element.querySelector('table');
      if (summary === null || table === null) return 'missing';
      return summary.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING ? 'summary first' : 'table first';
    });
    expect(order).toBe('summary first');
  });

  test('says how to download, follow and reuse the ledger, and gives the press address', async ({ page, siteUrl }) => {
    await page.goto(new URL('/ledger/', siteUrl).href);
    const section = page.locator('#data');
    await expect(section.getByRole('link', { name: 'CSV' })).toHaveAttribute('href', '/ledger.csv');
    await expect(section.getByRole('link', { name: 'JSON' })).toHaveAttribute('href', '/ledger.json');
    await expect(section.getByRole('link', { name: 'RSS feed' })).toHaveAttribute('href', '/rss.xml');
    await expect(section.getByRole('link', { name: /CC BY 4\.0/ })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
    await expect(section).toContainText('with credit to The Doorman Fallacy');
    await expect(section.getByRole('link', { name: 'citation on the idea page' })).toHaveAttribute('href', '/idea#cite');
    await expect(section.getByRole('link', { name: 'hello@thedoormanfallacy.com' })).toHaveAttribute('href', 'mailto:hello@thedoormanfallacy.com');
  });

  for (const width of [1440, 390]) {
    test(`sets company names in the display face at the subhead size, and the status in the small size and ink-2, at ${String(width)}px`, async ({
      page,
      siteUrl,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(new URL('/ledger/', siteUrl).href);
      const company = await style(page.locator('.ledger__company').first());
      expect(company.family).toContain('Prata');
      expect(company.size).toBe(await sizeOf(page, 't-subhead'));
      const status = await style(page.locator('.ledger__status').first());
      expect(status.size).toBe(await sizeOf(page, 't-small'));
      expect(status.colour).toBe(await colourOf(page, 'ink-2'));
      expect(status.weight).toBe('400');
      // The status is a block that opens the outcome cell, so the outcome text starts under it.
      const above = await page.locator('.ledger__status').first().evaluate((element) => {
        const outcome = element.nextSibling;
        if (outcome === null || outcome.nodeType !== Node.TEXT_NODE) return false;
        const range = document.createRange();
        range.selectNodeContents(outcome);
        return getComputedStyle(element).display === 'block' && range.getBoundingClientRect().top >= element.getBoundingClientRect().bottom - 1;
      });
      expect(above).toBe(true);
    });
  }

  test('reports what is known beyond the ledger with each source as an external link after its paragraph', async ({ page, siteUrl }) => {
    await page.goto(new URL('/ledger/', siteUrl).href);
    const section = page.locator('#known');
    await expect(section).toContainText(
      'The ledger records named cases with sources. Around it, two surveys and a forecast are widely quoted. Here is what they say, and where they come from.',
    );
    const sources = [
      ['Forrester’s Predictions 2026: The Future of Work', 'Resultsense, 30 October 2025', 'https://www.resultsense.com/news/2025-10-30-forrester-predicts-ai-layoff-reversals-lower-pay/'],
      ['A 2025 survey by Orgvue', 'HR Dive, 29 April 2025', 'https://www.hrdive.com/news/leaders-who-laid-off-workers-due-to-ai-regretted-it/746643/'],
      ['A 2026 survey for SHL', 'SHL, 29 October 2026', 'https://www.shl.com/about/news-and-events/press-releases/workers-replaced-by-ai-would-demand-higher-pay-and-greater-job-security-to-return-shl-research-finds/'],
    ] as const;
    const items = section.locator('.known__item');
    await expect(items).toHaveCount(sources.length);
    for (const [index, [start, label, href]] of sources.entries()) {
      const item = items.nth(index);
      await expect(item.locator('p').first()).toContainText(start);
      const link = item.locator('p').nth(1).getByRole('link');
      await expect(link).toHaveAttribute('href', href);
      await expect(link).toContainText(label);
      await expect(link).toContainText('↗');
    }
    await expect(section).toContainText(
      'Surveys and forecasts are not cases. A survey reports what people say, a forecast is a judgement about the future, and some come from companies that sell tools for the decision they describe. The ledger counts only what named organisations did, from sources anyone can check.',
    );
    const caution = section.locator('p', { hasText: 'Surveys and forecasts are not cases.' });
    expect((await style(caution)).colour).toBe(await colourOf(page, 'ink-2'));
  });
});

test.describe('/idea', () => {
  const route = '/idea/';

  test('opens with the definition as its lead, and a block on how to cite it', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    await expect(page.locator('h1')).toHaveText('The doorman fallacy');
    await expect(page.locator('.page-head__lead')).toHaveText(definition);
    const cite = page.locator('#cite');
    await expect(cite.getByText('How to cite', { exact: true })).toBeVisible();
    await expect(cite).toContainText(citation);
    await expect(cite).toContainText('The cases and this text are free to reuse under CC BY 4.0 ↗.');
    const licence = cite.getByRole('link', { name: /CC BY 4\.0/ });
    await expect(licence).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
    await expect(licence).toContainText('↗');
  });

  test('keeps its sections in order', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    expect(await headings(page)).toEqual([
      'The story',
      'The hidden work',
      'The three questions',
      'When automation is the right call',
      'Further reading',
    ]);
  });

  test('asks the per-kind questions and the signs of the mistake only once, inside the three questions', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    await expect(page.locator('#signs')).toHaveCount(0);
    await expect(page.getByText('The question to ask')).toHaveCount(0);
    const signs = page.locator('#questions .question__signs li');
    await expect(signs).toHaveCount(questions.flatMap((question) => question.signs).length);
  });

  for (const [width, aligned] of [
    [1440, true],
    [390, false],
  ] as const) {
    test(`${aligned ? 'puts each question in the heading column and its ideas in the text column' : 'stacks each question above its ideas'}, at ${String(width)}px`, async ({ page, siteUrl }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(new URL(route, siteUrl).href);
      const section = page.locator('#questions');
      const left = (locator: Locator): Promise<number> => locator.evaluate((element) => Math.round(element.getBoundingClientRect().left));
      const headLeft = await left(section.locator('.text-section__head'));
      const bodyLeft = await left(section.locator('.text-section__body'));
      for (const row of await section.locator('.question').all()) {
        expect(await left(row.locator('.question__head'))).toBe(headLeft);
        expect(await left(row.locator('.question__parts'))).toBe(aligned ? bodyLeft : headLeft);
      }
    });
  }

  for (const id of hiddenFunctionIds) {
    test(`gives ${id} its own entry, anchored for links: the meaning, today's example and how its loss shows, and its cases in the ledger`, async ({ page, siteUrl }) => {
      await page.goto(new URL(route, siteUrl).href);
      const entry = hiddenFunctions[id];
      const item = page.locator(`#hidden li#${id}`);
      await expect(item.getByRole('heading', { level: 3 })).toHaveText(entry.label);
      for (const text of [entry.meaning, entry.today, entry.whenMissing]) await expect(item).toContainText(text);
      expect(await item.locator('dt').allInnerTexts()).toEqual(['Today, for example', 'When it goes missing']);
      const wanted = dataset.cases.filter((item) => item.missed.includes(id)).map((item) => `/ledger/${item.slug}`).sort();
      const linked = (await item.locator('.hidden-kind__ledger a').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? ''))).sort();
      expect(linked).toEqual(wanted);
      if (wanted.length === 0) await expect(item).toContainText('No case in the ledger records this missing yet.');
    });
  }

  test('keeps the portrait beside the hidden work', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    await expect(page.locator('#hidden figure.photo')).toHaveCount(1);
  });

  test('says when automation is the right call, and links the cuts that held up to the ledger', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const section = page.locator('section', { has: page.getByRole('heading', { name: 'When automation is the right call' }) });
    await expect(section).toContainText('Sometimes the machine should take the task. Automating it is the right call when:');
    expect(await section.locator('li').allInnerTexts()).toEqual([
      'The visible task really is the whole job: resetting a password, changing an address, tracking a parcel.',
      'The hidden work has been named, and someone has been given it on purpose.',
      'The hidden work is measured after the change, as well as the saving.',
      'The people who did the job helped design the change, and can say when it is not working.',
    ]);
    await expect(section).toContainText('The ledger records cuts that held up as faithfully as those that were reversed.');
    await expect(section.getByRole('link', { name: 'cuts that held up' })).toHaveAttribute('href', '/ledger');
  });

  test('lists seven things to read, each with a line of why in ink-2', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const items = page.locator('ul.reading > li');
    await expect(items).toHaveCount(7);
    await expect(items.first()).toContainText('Rory Sutherland, Alchemy: The Surprising Power of Ideas That Don’t Make Sense (2019).');
    await expect(items.first()).toContainText('Where the doorman comes from.');
    await expect(items.last()).toContainText('Marilyn Strathern (1997), after Charles Goodhart (1975):');
    await expect(items.last()).toContainText('“When a measure becomes a target, it ceases to be a good measure.”');
    for (const item of await items.all()) expect((await style(item.locator('p').nth(1))).colour).toBe(await colourOf(page, 'ink-2'));
  });

  test('ends with a link on to the ledger', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const pager = page.getByRole('navigation', { name: 'More pages' });
    await expect(pager.getByRole('link')).toHaveCount(1);
    await expect(pager.getByRole('link', { name: 'Next The ledger' })).toHaveAttribute('href', '/ledger');
  });
});

test.describe('the case pages', () => {
  test('link each point of the doorman reading to its kind of hidden work on /idea', async ({ page, siteUrl }) => {
    for (const item of dataset.cases) {
      await page.goto(new URL(`/ledger/${item.slug}/`, siteUrl).href);
      const hrefs = await page.locator('#reading').locator('xpath=../..').locator('h3 a').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
      expect(hrefs, item.slug).toEqual(item.missed.map((id) => `/idea#${id}`));
    }
  });
});

test.describe('/approach', () => {
  const route = '/approach/';

  test('keeps its sections in order, and sends follow-up to the ledger page', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    expect(await headings(page)).toEqual([
      'What counts as a case',
      'How a case is written',
      'The checks every case passes',
      'Reported facts and the doorman reading',
      'Following up',
      'Corrections',
      'Tools and licences',
      'Common questions',
    ]);
    await expect(page.locator('#following').getByRole('link', { name: 'Statuses and follow-up' })).toHaveAttribute('href', '/ledger#statuses');
  });

  test('answers five common questions in a definition list', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const list = page.locator('dl.questions');
    expect(await list.locator('dt').allInnerTexts()).toEqual([
      'Is this site against AI?',
      'Is a case a judgement of the organisation?',
      'Why are there so few cases?',
      'Can I use the cases?',
      'Who pays for this?',
    ]);
    expect(await list.locator('dd').allInnerTexts()).toEqual([
      'Its view is that AI should do the work it does well, and that the people deciding should count everything a role did before replacing it. Cuts that held up are recorded alongside those that were reversed.',
      'A case records what sources reported, with quotes. The doorman reading is marked as the site’s own analysis and names the evidence it rests on. Motives are never guessed.',
      'The ledger is new. The desk adds cases every week, and only those that pass every check.',
      'Yes. They are published under CC BY 4.0: reuse them with credit to The Doorman Fallacy. The whole ledger can be downloaded from the ledger page.',
      'Nobody. The site has no advertising and no sponsors, and its code is open.',
    ]);
  });
});

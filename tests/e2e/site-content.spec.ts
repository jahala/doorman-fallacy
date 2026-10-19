import type { Locator, Page } from '@playwright/test';
import { citation, definition } from '../../src/data/definition.ts';
import { hiddenFunctionIds, hiddenFunctions } from '../../src/data/hidden-functions.ts';
import { signs } from '../../src/data/signs.ts';
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
  test('keeps its sections in order, with the definition band and Start here after the hero', async ({ page, siteUrl }) => {
    await page.goto(new URL('/', siteUrl).href);
    expect(await headings(page)).toEqual([
      'The doorman fallacy',
      'Start here',
      'What else was the person doing?',
      'The ledger',
      'Before the decision.',
      'Get updates from the ledger.',
    ]);
    await expect(page.locator('h1')).toHaveText('What does a doorman actually do?');
  });

  test('sets the definition from its data file as a statement in the title style, not italic, with a link to how to cite', async ({
    page,
    siteUrl,
  }) => {
    await page.goto(new URL('/', siteUrl).href);
    const band = page.locator('section.band');
    await expect(band.locator('.band__statement')).toHaveText(definition);
    const statement = await style(band.locator('.band__statement'));
    expect(statement.size).toBe(await sizeOf(page, 't-title'));
    expect(statement.family).toContain('Prata');
    expect(statement.fontStyle).toBe('normal');
    const label = await style(band.locator('.band__label'));
    expect(label.size).toBe(await sizeOf(page, 't-caption'));
    expect(label.colour).toBe(await colourOf(page, 'ink-2'));
    await expect(band.getByRole('link', { name: 'How to cite' })).toHaveAttribute('href', '/idea#cite');
    await expect(band.locator('.band__label')).toHaveText('The doorman fallacy');
  });

  test('is ruled above and below the definition band', async ({ page, siteUrl }) => {
    await page.goto(new URL('/', siteUrl).href);
    const widths = await page.locator('section.band').evaluate((element) => {
      const bandRule = getComputedStyle(element).borderBottomWidth;
      const above = element.previousElementSibling === null ? '0px' : getComputedStyle(element.previousElementSibling).borderBottomWidth;
      return { bandRule, above };
    });
    expect(widths).toEqual({ bandRule: '1px', above: '1px' });
  });

  test('offers three starting points on the grid, each with a hairline above and its own link', async ({ page, siteUrl }) => {
    await page.goto(new URL('/', siteUrl).href);
    const section = page.locator('section', { has: page.getByRole('heading', { name: 'Start here', level: 2 }) });
    expect(await style(section.getByRole('heading', { name: 'Start here' }))).toMatchObject({ size: await sizeOf(page, 't-title') });
    const items = section.locator('li');
    await expect(items).toHaveCount(3);
    const expected = [
      ['If you manage a team', 'Before automating a role, answer seven questions with the people who do it.', 'Before you cut', '/checks/before-you-cut'],
      ['If your role is changing', 'Write down the work your job description leaves out, before the conversation.', 'Your hidden job', '/checks/your-hidden-job'],
      ['If you report or research', 'Every case is sourced, archived and free to reuse, with the data to download.', 'The ledger and its data', '/ledger'],
    ] as const;
    for (const [index, [who, text, link, href]] of expected.entries()) {
      const item = items.nth(index);
      await expect(item.getByRole('heading', { level: 3 })).toHaveText(who);
      await expect(item).toContainText(text);
      await expect(item.getByRole('link', { name: link })).toHaveAttribute('href', href);
      expect((await style(item)).top).toBe('1px');
    }
    const columns = await items.evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().left)));
    expect(new Set(columns).size).toBe(3);
  });

  test('links the six signs from the "What else" section, beside the link to the ledger', async ({ page, siteUrl }) => {
    await page.goto(new URL('/', siteUrl).href);
    const section = page.locator('section', { has: page.getByRole('heading', { name: 'What else was the person doing?' }) });
    await expect(section.getByRole('link', { name: 'See what happened in practice' })).toHaveAttribute('href', '/ledger');
    await expect(section.getByRole('link', { name: 'Six signs of the mistake' })).toHaveAttribute('href', '/idea#signs');
  });

  test('puts the ledger summary above the preview table', async ({ page, siteUrl }) => {
    await page.goto(new URL('/', siteUrl).href);
    const section = page.locator('section', { has: page.getByRole('heading', { name: 'The ledger', level: 2, exact: true }) });
    const order = await section.evaluate((element) => {
      const summary = element.querySelector('.ledger-summary');
      const table = element.querySelector('table');
      if (summary === null || table === null) return 'missing';
      return summary.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING ? 'summary first' : 'table first';
    });
    expect(order).toBe('summary first');
  });
});

test.describe('the ledger summary', () => {
  const counted = statusIds
    .map((id) => ({ id, count: dataset.cases.filter((item) => item.status === id).length }))
    .filter(({ count }) => count > 0);
  const sentence = `${caseCount === 1 ? '1 case' : `${String(caseCount)} cases`}: ${counted
    .map(({ id, count }) => `${String(count)} ${statuses[id].label.toLowerCase()}`)
    .join(', ')}.`;

  for (const route of ['/', '/ledger/']) {
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
        await expect(item.getByRole('link', { name: hiddenFunctions[id].label })).toHaveAttribute('href', `/idea/${id}`);
        await expect(item).toContainText(String(count));
      }
    });
  }
});

test.describe('/ledger', () => {
  test('has the summary above the table, and under it a line to download the ledger', async ({ page, siteUrl }) => {
    await page.goto(new URL('/ledger/', siteUrl).href);
    const order = await page.locator('main').evaluate((element) => {
      const summary = element.querySelector('.ledger-summary');
      const table = element.querySelector('table');
      if (summary === null || table === null) return 'missing';
      return summary.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING ? 'summary first' : 'table first';
    });
    expect(order).toBe('summary first');
    const line = page.locator('.ledger-download');
    await expect(line).toHaveText(
      'Download the ledger: CSV · JSON. Free to reuse under CC BY 4.0, with credit to The Doorman Fallacy.',
    );
    await expect(line.getByRole('link', { name: 'CSV' })).toHaveAttribute('href', '/ledger.csv');
    await expect(line.getByRole('link', { name: 'JSON' })).toHaveAttribute('href', '/ledger.json');
  });

  for (const width of [1440, 390]) {
    test(`sets company names in the display face at the title size, and the status in the small size and ink-2, at ${String(width)}px`, async ({
      page,
      siteUrl,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(new URL('/ledger/', siteUrl).href);
      const company = await style(page.locator('.ledger__company').first());
      expect(company.family).toContain('Prata');
      expect(company.size).toBe(await sizeOf(page, 't-title'));
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
});

test.describe('/idea', () => {
  const route = '/idea/';

  test('opens with the definition as its lead, and a block on how to cite it', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    await expect(page.locator('h1')).toHaveText('The doorman fallacy');
    await expect(page.locator('.page-head > .t-lead')).toHaveText(definition);
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
      'Why it matters now',
      'Six signs of the mistake',
      'The hidden work',
      'What is known so far',
      'When automation is the right call',
      'Further reading',
    ]);
  });

  test('lists the six signs from their data file, numbered, with the detail in ink-2', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const section = page.locator('#signs');
    await expect(section.getByRole('heading', { name: 'Six signs of the mistake' })).toBeVisible();
    const items = section.locator('ol.signs > li');
    await expect(items).toHaveCount(signs.length);
    for (const [index, { title, detail }] of signs.entries()) {
      const item = items.nth(index);
      await expect(item.locator('.signs__title')).toHaveText(title);
      await expect(item.locator('p').nth(1)).toHaveText(detail);
      expect((await style(item.locator('p').nth(1))).colour).toBe(await colourOf(page, 'ink-2'));
      await expect(item.locator('.signs__number')).toHaveText(String(index + 1));
    }
  });

  for (const [width, columns] of [
    [1440, 2],
    [390, 1],
  ] as const) {
    test(`lays the signs out in ${String(columns)} column(s) with a hairline above each, at ${String(width)}px`, async ({ page, siteUrl }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(new URL(route, siteUrl).href);
      const items = page.locator('ol.signs > li');
      const lefts = await items.evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().left)));
      expect(new Set(lefts).size).toBe(columns);
      for (const item of await items.all()) expect((await style(item)).top).toBe('1px');
    });
  }

  test('links each hidden function to its own page, and keeps the portrait beside that section', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const section = page.locator('section', { has: page.getByRole('heading', { name: 'The hidden work', level: 2 }) });
    for (const id of hiddenFunctionIds) {
      const link = section.locator(`a[href="/idea/${id}"]`);
      await expect(link).toHaveCount(1);
      await expect(link).toContainText('At the hotel, today, and in the ledger');
      await expect(link).toContainText(hiddenFunctions[id].label);
    }
    await expect(section.locator('figure.photo')).toHaveCount(1);
  });

  test('gives every link its own accessible name, so six "At the hotel" links are told apart', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const names = await page.locator('.hidden-work__link a').evaluateAll((anchors) => anchors.map((anchor) => anchor.textContent.trim()));
    expect(new Set(names).size).toBe(hiddenFunctionIds.length);
  });

  test('reports what is known so far with each source as an external link after its paragraph', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const section = page.locator('section', { has: page.getByRole('heading', { name: 'What is known so far' }) });
    await expect(section).toContainText(
      'The ledger records named cases with sources. Around it, a few facts and forecasts are widely quoted. Here is what they say, and where they come from.',
    );
    const sources = [
      ['Commonwealth Bank of Australia cut 45 customer-service roles in July 2025', 'ACS Information Age, 21 August 2025', 'https://ia.acs.org.au/article/2025/cba-reverses-ai-driven-job-cuts--admits--error-.html'],
      ['In 2024 Klarna reported', 'Tech.co, 20 May 2025', 'https://tech.co/news/klarna-reverses-ai-overhaul'],
      ['Forrester’s Predictions 2026: The Future of Work', 'Resultsense, 30 October 2025', 'https://www.resultsense.com/news/2025-10-30-forrester-predicts-ai-layoff-reversals-lower-pay/'],
      ['A 2025 survey by Orgvue', 'HR Dive, 29 April 2025', 'https://www.hrdive.com/news/leaders-who-laid-off-workers-due-to-ai-regretted-it/746643/'],
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

  test('ends with the two closing links', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    await expect(page.locator('.idea-close').getByRole('link', { name: 'See what happened in practice' })).toHaveAttribute('href', '/ledger');
    await expect(page.locator('.idea-close').getByRole('link', { name: 'Before the decision: two printable guides' })).toHaveAttribute('href', '/checks/your-hidden-job');
  });
});

test.describe('the page for each hidden function', () => {
  for (const [at, id] of hiddenFunctionIds.entries()) {
    const entry = hiddenFunctions[id];

    test(`/idea/${id}/ shows the label, its sections in order and the text from the data file`, async ({ page, siteUrl }) => {
      await page.goto(new URL(`/idea/${id}/`, siteUrl).href);
      await expect(page.getByRole('link', { name: 'The hidden work', exact: true }).first()).toHaveAttribute('href', '/idea');
      await expect(page.locator('h1')).toHaveText(entry.label);
      await expect(page.locator('h1 + p')).toHaveText(entry.meaning);
      expect(await headings(page)).toEqual(['At the hotel', 'Today', 'When it goes missing', 'The question to ask', 'In the ledger']);
      const section = (name: string): Locator => page.locator('section', { has: page.getByRole('heading', { name, level: 2 }) });
      await expect(section('At the hotel')).toContainText(entry.atTheHotel);
      await expect(section('Today')).toContainText(entry.today);
      await expect(section('Today')).toContainText('An illustration, not a reported case.');
      await expect(section('When it goes missing')).toContainText(entry.whenMissing);
      const ask = section('The question to ask');
      await expect(ask).toContainText(entry.ask);
      await expect(ask.getByRole('link', { name: 'Before you cut, the full set of questions' })).toHaveAttribute('href', '/checks/before-you-cut');
    });

    test(`/idea/${id}/ sets the question to ask larger than the running text, and the illustration note as a caption`, async ({ page, siteUrl }) => {
      await page.goto(new URL(`/idea/${id}/`, siteUrl).href);
      const ask = await style(page.locator('.fn-ask'));
      expect(Number.parseFloat(ask.size)).toBeGreaterThan(Number.parseFloat(await sizeOf(page, 't-body')));
      expect(ask.size).toBe(await sizeOf(page, 't-title'));
      expect((await style(page.getByText('An illustration, not a reported case.'))).size).toBe(await sizeOf(page, 't-caption'));
    });

    test(`/idea/${id}/ lists the cases that recorded this work missing, or says that none has`, async ({ page, siteUrl }) => {
      await page.goto(new URL(`/idea/${id}/`, siteUrl).href);
      const section = page.locator('section', { has: page.getByRole('heading', { name: 'In the ledger', level: 2 }) });
      const wanted = dataset.cases.filter((item) => item.missed.includes(id));
      if (wanted.length === 0) {
        await expect(section).toContainText('No case in the ledger records this kind of work going missing yet.');
        await expect(section.locator('li')).toHaveCount(0);
        return;
      }
      await expect(section).not.toContainText('No case in the ledger records');
      const items = section.locator('li');
      await expect(items).toHaveCount(wanted.length);
      for (const item of wanted) {
        await expect(section.getByRole('link', { name: /./ }).and(section.locator(`a[href="/ledger/${item.slug}"]`))).toHaveCount(1);
      }
    });

    test(`/idea/${id}/ links to the kinds either side of it, and none past the ends`, async ({ page, siteUrl }) => {
      await page.goto(new URL(`/idea/${id}/`, siteUrl).href);
      const pager = page.getByRole('navigation', { name: 'The six kinds of hidden work' });
      const previous = hiddenFunctionIds[at - 1];
      const next = hiddenFunctionIds[at + 1];
      const hrefs = await pager.locator('a').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
      expect(hrefs).toEqual([...(previous === undefined ? [] : [`/idea/${previous}`]), ...(next === undefined ? [] : [`/idea/${next}`])]);
    });
  }

  test('the case pages the "In the ledger" list links to exist', async ({ page, siteUrl }) => {
    const slugs = dataset.cases.map((item) => item.slug);
    for (const slug of slugs) {
      const response = await page.goto(new URL(`/ledger/${slug}/`, siteUrl).href);
      expect(response?.status()).toBe(200);
    }
  });
});

test.describe('/approach', () => {
  const route = '/approach/';

  test('ends with reuse and citation, then common questions', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const all = await headings(page);
    expect(all.slice(-2)).toEqual(['Reuse and citation', 'Common questions']);
  });

  test('says how to reuse and cite the cases, links the dataset and gives the press address', async ({ page, siteUrl }) => {
    await page.goto(new URL(route, siteUrl).href);
    const section = page.locator('#reuse');
    await expect(section.getByRole('heading', { name: 'Reuse and citation' })).toBeVisible();
    await expect(section).toContainText('The cases and the text of this site are published under CC BY 4.0 ↗. Reuse them with credit to The Doorman Fallacy.');
    await expect(section.getByRole('link', { name: /CC BY 4\.0/ })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
    await expect(section).toContainText('Cite the idea as:');
    await expect(section).toContainText(citation);
    await expect(section.getByRole('link', { name: 'CSV' })).toHaveAttribute('href', '/ledger.csv');
    await expect(section.getByRole('link', { name: 'JSON' })).toHaveAttribute('href', '/ledger.json');
    await expect(section).toContainText('For press and research questions, write to hello@thedoormanfallacy.com.');
    await expect(section.getByRole('link', { name: 'hello@thedoormanfallacy.com' })).toHaveAttribute('href', 'mailto:hello@thedoormanfallacy.com');
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
      'Nobody. The site has no advertising and no sponsors. It is run by Jan Hallvard Larsen, and its code is open.',
    ]);
  });
});

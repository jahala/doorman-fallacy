import { describe, expect, it } from 'vitest';
import { createBudget } from '../../desk/budget.ts';
import { createDeepseekDoor, deepseekLeads, deepseekQuery, usdPerRequest, type Post } from '../../desk/deepseek.ts';

describe('deepseekQuery', () => {
  it('adds the language of the edition and the start of the window', () => {
    expect(deepseekQuery('Telenor kunstig intelligens', 'no', 30, '2026-10-21')).toBe('Telenor kunstig intelligens lang:no after:2026-09-21');
    expect(deepseekQuery('Klarna AI', 'en', 1100, '2026-10-21')).toBe('Klarna AI lang:en after:2023-10-17');
  });

  it('searches the Taiwanese edition as Chinese, the one Chinese code DeepSeek knows', () => {
    expect(deepseekQuery('人工智慧 裁員', 'tw', 30, '2026-10-21')).toBe('人工智慧 裁員 lang:zh after:2026-09-21');
    expect(deepseekQuery('人工智能 裁员', 'zh', 30, '2026-10-21')).toBe('人工智能 裁员 lang:zh after:2026-09-21');
  });
});

describe('deepseekLeads', () => {
  it('turns results into leads with the publisher and the day of publication', () => {
    const leads = deepseekLeads(
      {
        results: [
          { title: 'AI-robot fikk terningkast 6', url: 'https://www.t-a.no/a/', site_name: 'Trønder-Avisa', date: '2024-04-15T16:00:00+00:00', summary: 'Telenor kutter.' },
          { title: 'Endringer i Telenor Norge', url: 'https://www.mynewsdesk.com/no/telenor/x.pdf', site_name: null, date: null, summary: '' },
          { title: '', url: 'https://example.com/no-title' },
          { title: 'No address' },
        ],
      },
      'Telenor',
    );
    expect(leads).toEqual([
      { title: 'AI-robot fikk terningkast 6', url: 'https://www.t-a.no/a/', outlet: 'Trønder-Avisa', published: '2024-04-15', snippet: 'Telenor kutter.', feed: 'deepseek', query: 'Telenor' },
      { title: 'Endringer i Telenor Norge', url: 'https://www.mynewsdesk.com/no/telenor/x.pdf', outlet: 'www.mynewsdesk.com', published: '', snippet: '', feed: 'deepseek', query: 'Telenor' },
    ]);
  });

  it('reads an answer with no results array as no leads', () => {
    expect(deepseekLeads({ error: { message: 'bad' } }, 'q')).toEqual([]);
    expect(deepseekLeads(null, 'q')).toEqual([]);
  });
});

describe('the DeepSeek door', () => {
  const answer = (status: number, body: unknown): Post => () => Promise.resolve({ status, body });

  it('charges a search that returns results, at the price per request', async () => {
    const budget = createBudget(1);
    const door = createDeepseekDoor({ budget, key: 'k', post: answer(200, { results: [{ title: 't', url: 'https://a.b/' }] }) });
    const result = await door.search('q', { count: 5, content: false });
    expect(result.ok).toBe(true);
    expect(budget.spent()).toBeCloseTo(usdPerRequest, 10);
  });

  it('charges nothing for an empty result or a refusal, which DeepSeek does not bill', async () => {
    const budget = createBudget(1);
    await createDeepseekDoor({ budget, key: 'k', post: answer(200, { results: [] }) }).search('q', { count: 5, content: false });
    const refused = await createDeepseekDoor({ budget, key: 'k', post: answer(401, { error: { message: 'no key' } }) }).search('q', { count: 5, content: false });
    expect(refused).toMatchObject({ ok: false, reason: 'http', message: 'HTTP 401: no key' });
    expect(budget.spent()).toBe(0);
    expect(budget.calls().settled).toBe(2);
  });

  it('counts a call that got no answer as possibly charged, and does not send it again', async () => {
    const budget = createBudget(1);
    let sent = 0;
    const lost: Post = () => {
      sent += 1;
      return Promise.reject(new Error('socket hang up'));
    };
    const result = await createDeepseekDoor({ budget, key: 'k', post: lost }).fetchPage('https://a.b/');
    expect(result).toMatchObject({ ok: false, reason: 'no-answer' });
    expect(sent).toBe(1);
    expect(budget.calls().possiblyCharged).toBe(1);
  });

  it('refuses a call that would pass the budget, without sending it', async () => {
    const budget = createBudget(usdPerRequest / 2);
    let sent = 0;
    const post: Post = () => {
      sent += 1;
      return Promise.resolve({ status: 200, body: { results: [] } });
    };
    const result = await createDeepseekDoor({ budget, key: 'k', post }).search('q', { count: 5, content: false });
    expect(result).toMatchObject({ ok: false, reason: 'over-budget' });
    expect(sent).toBe(0);
  });

  it('returns a fetched page as its title and Markdown', async () => {
    const budget = createBudget(1);
    const door = createDeepseekDoor({ budget, key: 'k', post: answer(200, { title: 'T', content: '# T\n\nText.' }) });
    expect(await door.fetchPage('https://a.b/')).toEqual({ ok: true, title: 'T', content: '# T\n\nText.' });
    expect(budget.spent()).toBeCloseTo(usdPerRequest, 10);
  });
});

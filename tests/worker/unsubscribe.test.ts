import { beforeEach, describe, expect, it } from 'vitest';
import { clearTables, location, noon, rows, run, tokenNumber, world } from './helpers.ts';

const ada = { email: 'ada@example.com', token: tokenNumber(10) };
const grace = { email: 'grace@example.com', token: tokenNumber(11) };

async function seed(): Promise<void> {
  for (const person of [ada, grace]) {
    await run(
      `INSERT INTO subscribers (email, token, created_at, token_sent_at, confirmed_at) VALUES (?1, ?2, ?3, ?3, ?3)`,
      person.email,
      person.token,
      noon.toISOString(),
    );
  }
}

const emails = async (): Promise<string[]> => (await rows<{ email: string }>('SELECT email FROM subscribers ORDER BY id')).map((row) => row.email);

beforeEach(async () => {
  await clearTables();
  await seed();
});

describe('GET /unsubscribe', () => {
  it('serves the built one-button page at this address and unsubscribes nobody', async () => {
    const { request } = world();
    const response = await request(`/unsubscribe?token=${ada.token}`);
    expect(response.status).toBe(200);
    const page = await response.text();
    expect(page).toContain('<title>Unsubscribe</title>');
    // The page's form has no action, so the browser posts back to /unsubscribe?token=...
    expect(page).toContain('<form method="post">');
    expect(await emails()).toEqual([ada.email, grace.email]);
  });

  it('keeps the address out of caches, search results and the Referer header', async () => {
    const { request } = world();
    const response = await request(`/unsubscribe?token=${ada.token}`);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    await response.text();
  });

  it('sends a missing or malformed token to the problem page', async () => {
    const { request } = world();
    for (const query of ['', '?token=', '?token=abc']) {
      const response = await request(`/unsubscribe${query}`);
      expect(response.status).toBe(303);
      expect(location(response)).toBe('/subscribe/problem');
    }
  });

  it('sends a direct visit to the page itself to the problem page, since it has no token', async () => {
    const { request } = world();
    for (const path of ['/subscribe/unsubscribe', '/subscribe/unsubscribe/']) {
      expect(location(await request(path))).toBe('/subscribe/problem');
    }
  });
});

describe('POST /unsubscribe', () => {
  it('deletes that subscriber and no other, when the token is in the query (what the page posts)', async () => {
    const { post } = world();
    const response = await post(`/unsubscribe?token=${ada.token}`, {});
    expect(response.status).toBe(303);
    expect(location(response)).toBe('/subscribe/unsubscribed');
    expect(await emails()).toEqual([grace.email]);
  });

  it('takes the token from a form field too', async () => {
    const { post } = world();
    const response = await post('/unsubscribe', { token: grace.token });
    expect(location(response)).toBe('/subscribe/unsubscribed');
    expect(await emails()).toEqual([ada.email]);
  });

  it('answers a mail program\'s one-click request (RFC 8058) with a 200, not a redirect', async () => {
    const { post } = world();
    const response = await post(`/unsubscribe?token=${ada.token}`, { 'List-Unsubscribe': 'One-Click' });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Unsubscribed');
    expect(await emails()).toEqual([grace.email]);
  });

  it('says unsubscribed again for an address already gone, and touches nobody else', async () => {
    const { post } = world();
    await post(`/unsubscribe?token=${ada.token}`, {});
    const again = await post(`/unsubscribe?token=${ada.token}`, {});
    expect(location(again)).toBe('/subscribe/unsubscribed');
    expect(await emails()).toEqual([grace.email]);
  });

  it('sends a missing or malformed token to the problem page and deletes nothing', async () => {
    const { post } = world();
    expect(location(await post('/unsubscribe', {}))).toBe('/subscribe/problem');
    expect(location(await post('/unsubscribe?token=abc', {}))).toBe('/subscribe/problem');
    expect(await emails()).toEqual([ada.email, grace.email]);
  });

  it('answers a one-click request with a malformed token with a 400', async () => {
    const { post } = world();
    const response = await post('/unsubscribe?token=abc', { 'List-Unsubscribe': 'One-Click' });
    expect(response.status).toBe(400);
    await response.text();
    expect(await emails()).toEqual([ada.email, grace.email]);
  });

  it('works with no body at all', async () => {
    const { request } = world();
    const response = await request(`/unsubscribe?token=${ada.token}`, { method: 'POST' });
    expect(location(response)).toBe('/subscribe/unsubscribed');
    expect(await emails()).toEqual([grace.email]);
  });
});

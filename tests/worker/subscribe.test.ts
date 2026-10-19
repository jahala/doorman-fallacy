import { beforeEach, describe, expect, it } from 'vitest';
import { clearTables, location, noon, rows, run, tokenNumber, world } from './helpers.ts';

interface Subscriber {
  email: string;
  token: string;
  created_at: string;
  token_sent_at: string;
  confirmed_at: string | null;
}

const all = (): Promise<Subscriber[]> =>
  rows<Subscriber>('SELECT email, token, created_at, token_sent_at, confirmed_at FROM subscribers ORDER BY id');

const minutes = (count: number): Date => new Date(noon.getTime() + count * 60_000);

async function seed(subscriber: Subscriber): Promise<void> {
  await run(
    'INSERT INTO subscribers (email, token, created_at, token_sent_at, confirmed_at) VALUES (?1, ?2, ?3, ?4, ?5)',
    subscriber.email,
    subscriber.token,
    subscriber.created_at,
    subscriber.token_sent_at,
    subscriber.confirmed_at,
  );
}

beforeEach(clearTables);

describe('POST /api/subscribe: a new address', () => {
  it('stores it unconfirmed with a 64-character token, emails the confirmation link and shows the check-email page', async () => {
    const { post, mail } = world();
    const response = await post('/api/subscribe', { email: ' Ada@Example.COM ', website: '' });
    expect(response.status).toBe(303);
    expect(location(response)).toBe('/subscribe/check-email');
    expect(await all()).toEqual([
      {
        email: 'ada@example.com',
        token: tokenNumber(1),
        created_at: noon.toISOString(),
        token_sent_at: noon.toISOString(),
        confirmed_at: null,
      },
    ]);
    expect(mail.sent).toEqual([
      {
        to: 'ada@example.com',
        subject: 'Confirm your subscription to The Doorman Fallacy',
        text: `Hello,

Someone, hopefully you, asked to get updates from the ledger at thedoormanfallacy.com.

Confirm with this link:
https://thedoormanfallacy.com/confirm?token=${tokenNumber(1)}

If it was not you, ignore this email. The address is deleted in 7 days unless it is confirmed.

The Doorman Fallacy
https://thedoormanfallacy.com
`,
      },
    ]);
  });

  it('sends a bot that fills the honeypot to the same page, with nothing stored, sent or counted', async () => {
    const { post, mail } = world();
    const response = await post('/api/subscribe', { email: 'bot@example.com', website: 'https://spam.example' });
    expect(location(response)).toBe('/subscribe/check-email');
    expect(await all()).toEqual([]);
    expect(mail.sent).toEqual([]);
    expect(await rows('SELECT * FROM rate_hits')).toEqual([]);
  });

  it.each([['nothing', ''], ['a word', 'ada'], ['two addresses', 'a@example.com,b@example.com']])(
    'sends %s to the failed page and stores and sends nothing',
    async (_label, email) => {
      const { post, mail } = world();
      const response = await post('/api/subscribe', { email });
      expect(location(response)).toBe('/subscribe/failed');
      expect(await all()).toEqual([]);
      expect(mail.sent).toEqual([]);
    },
  );

  it('refuses a body that is not a urlencoded form', async () => {
    const { request, mail } = world();
    const response = await request('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com' }),
    });
    expect(location(response)).toBe('/subscribe/failed');
    expect(mail.sent).toEqual([]);
  });
});

describe('POST /api/subscribe: an address that is already known', () => {
  const confirmed: Subscriber = {
    email: 'ada@example.com',
    token: tokenNumber(200),
    created_at: '2026-09-01T08:00:00.000Z',
    token_sent_at: '2026-09-01T08:00:00.000Z',
    confirmed_at: '2026-09-01T09:00:00.000Z',
  };

  it('sends nothing to a confirmed address, changes nothing, and answers as for a new one', async () => {
    await seed(confirmed);
    const { post, mail } = world();
    const response = await post('/api/subscribe', { email: 'ADA@example.com' });
    expect(location(response)).toBe('/subscribe/check-email');
    expect(mail.sent).toEqual([]);
    expect(await all()).toEqual([confirmed]);
  });

  const unconfirmed: Subscriber = {
    email: 'ada@example.com',
    token: tokenNumber(201),
    created_at: noon.toISOString(),
    token_sent_at: noon.toISOString(),
    confirmed_at: null,
  };

  it('does not send again within 10 minutes, and keeps the first link working', async () => {
    await seed(unconfirmed);
    const { post, mail } = world();
    const response = await post('/api/subscribe', { email: 'ada@example.com' }, { at: minutes(9) });
    expect(location(response)).toBe('/subscribe/check-email');
    expect(mail.sent).toEqual([]);
    expect(await all()).toEqual([unconfirmed]);
  });

  it('sends a fresh link after 10 minutes: a new token, the first date kept', async () => {
    await seed(unconfirmed);
    const { post, mail } = world();
    const response = await post('/api/subscribe', { email: 'ada@example.com' }, { at: minutes(10) });
    expect(location(response)).toBe('/subscribe/check-email');
    expect(await all()).toEqual([
      { ...unconfirmed, token: tokenNumber(1), token_sent_at: minutes(10).toISOString() },
    ]);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.text).toContain(`https://thedoormanfallacy.com/confirm?token=${tokenNumber(1)}`);
    expect(mail.sent[0]?.text).not.toContain(tokenNumber(201));
  });

  it('sends one email when two requests for the same address arrive together', async () => {
    const { post, mail } = world();
    const responses = await Promise.all([
      post('/api/subscribe', { email: 'ada@example.com' }),
      post('/api/subscribe', { email: 'ada@example.com' }),
    ]);
    expect(responses.map(location)).toEqual(['/subscribe/check-email', '/subscribe/check-email']);
    expect(mail.sent).toHaveLength(1);
    expect(await all()).toHaveLength(1);
    expect(mail.sent[0]?.text).toContain((await all())[0]?.token ?? 'no row');
  });
});

describe('POST /api/subscribe: the mail service refuses', () => {
  it('removes the new row, so the person can try again at once, and shows the failed page', async () => {
    const { post, mail } = world('refused');
    const response = await post('/api/subscribe', { email: 'ada@example.com' });
    expect(location(response)).toBe('/subscribe/failed');
    expect(mail.sent).toHaveLength(1);
    expect(await all()).toEqual([]);
  });

  it('puts an existing unconfirmed row back as it was, so its first link still works', async () => {
    const first: Subscriber = {
      email: 'ada@example.com',
      token: tokenNumber(201),
      created_at: noon.toISOString(),
      token_sent_at: noon.toISOString(),
      confirmed_at: null,
    };
    await seed(first);
    const { post } = world('refused');
    const response = await post('/api/subscribe', { email: 'ada@example.com' }, { at: minutes(30) });
    expect(location(response)).toBe('/subscribe/failed');
    expect(await all()).toEqual([first]);
  });
});

describe('the subscribe rate limit', () => {
  it('allows 5 attempts an hour from one address and sends the 6th to the failed page', async () => {
    const { post, mail } = world();
    for (let count = 1; count <= 5; count += 1) {
      const response = await post('/api/subscribe', { email: `person${String(count)}@example.com` }, { ip: '198.51.100.4' });
      expect(location(response)).toBe('/subscribe/check-email');
    }
    const sixth = await post('/api/subscribe', { email: 'person6@example.com' }, { ip: '198.51.100.4' });
    expect(location(sixth)).toBe('/subscribe/failed');
    expect(mail.sent).toHaveLength(5);
    expect(await all()).toHaveLength(5);
  });

  it('counts every attempt, so an address cannot be probed past the limit', async () => {
    const { post } = world();
    for (let count = 1; count <= 5; count += 1) await post('/api/subscribe', { email: 'bad' }, { ip: '198.51.100.5' });
    const response = await post('/api/subscribe', { email: 'ada@example.com' }, { ip: '198.51.100.5' });
    expect(location(response)).toBe('/subscribe/failed');
  });

  it('lets the address back in an hour later', async () => {
    const { post } = world();
    for (let count = 1; count <= 5; count += 1) await post('/api/subscribe', { email: `p${String(count)}@example.com` }, { ip: '198.51.100.6' });
    const later = await post('/api/subscribe', { email: 'late@example.com' }, { ip: '198.51.100.6', at: minutes(60) });
    expect(location(later)).toBe('/subscribe/check-email');
  });
});

describe('GET /confirm', () => {
  const sent = (daysAgo: number): string => new Date(noon.getTime() - daysAgo * 86_400_000).toISOString();
  const row = (overrides: Partial<Subscriber> = {}): Subscriber => ({
    email: 'ada@example.com',
    token: tokenNumber(50),
    created_at: sent(1),
    token_sent_at: sent(1),
    confirmed_at: null,
    ...overrides,
  });

  it('confirms the address and shows the confirmed page', async () => {
    await seed(row());
    const { request } = world();
    const response = await request(`/confirm?token=${tokenNumber(50)}`);
    expect(response.status).toBe(303);
    expect(location(response)).toBe('/subscribe/confirmed');
    expect(await all()).toEqual([row({ confirmed_at: noon.toISOString() })]);
  });

  it('is fine to follow twice: it keeps the first confirmation time', async () => {
    await seed(row());
    const { request } = world();
    await request(`/confirm?token=${tokenNumber(50)}`);
    const later = await request(`/confirm?token=${tokenNumber(50)}`, { at: minutes(5) });
    expect(location(later)).toBe('/subscribe/confirmed');
    expect((await all())[0]?.confirmed_at).toBe(noon.toISOString());
  });

  it('still works on the last moment of the 7 days, and not after', async () => {
    await seed(row({ token_sent_at: sent(7) }));
    const { request } = world();
    expect(location(await request(`/confirm?token=${tokenNumber(50)}`))).toBe('/subscribe/confirmed');
    await clearTables();
    await seed(row({ token_sent_at: new Date(noon.getTime() - 7 * 86_400_000 - 1).toISOString() }));
    expect(location(await request(`/confirm?token=${tokenNumber(50)}`))).toBe('/subscribe/problem');
    expect((await all())[0]?.confirmed_at).toBeNull();
  });

  it('shows the problem page for a token nobody holds, a malformed one, and none', async () => {
    await seed(row());
    const { request } = world();
    for (const query of [`?token=${tokenNumber(99)}`, '?token=abc', '?token=', '']) {
      const response = await request(`/confirm${query}`);
      expect(location(response)).toBe('/subscribe/problem');
    }
    expect((await all())[0]?.confirmed_at).toBeNull();
  });
});

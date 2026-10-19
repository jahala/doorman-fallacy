import { beforeEach, describe, expect, it } from 'vitest';
import { clearTables, location, noon, rows, world } from './helpers.ts';

interface Stored {
  created_at: string;
  kind: string;
  case_slug: string | null;
  links: string;
  note: string;
  name: string | null;
  email: string | null;
  credit: number;
  triage_label: string | null;
  resolved_at: string | null;
}

const all = (): Promise<Stored[]> => rows<Stored>(
    'SELECT created_at, kind, case_slug, links, note, name, email, credit, triage_label, resolved_at FROM suggestions ORDER BY id',
  );

beforeEach(clearTables);

describe('POST /api/suggest', () => {
  it('stores a suggested case and thanks the sender', async () => {
    const { post } = world();
    const response = await post('/api/suggest', {
      link: ['https://news.example/bank-cuts', '', 'https://union.example/statement'],
      note: 'The bank cut 45 roles, then reversed.',
      name: 'Ada Lovelace',
      email: 'Ada@Example.com',
      credit: 'on',
      website: '',
    });
    expect(response.status).toBe(303);
    expect(location(response)).toBe('/suggest/thanks');
    expect(await all()).toEqual([
      {
        created_at: noon.toISOString(),
        kind: 'case',
        case_slug: null,
        links: '["https://news.example/bank-cuts","https://union.example/statement"]',
        note: 'The bank cut 45 roles, then reversed.',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        credit: 1,
        triage_label: null,
        resolved_at: null,
      },
    ]);
  });

  it('stores only the link when nothing else is sent, with no credit wish', async () => {
    const { post } = world();
    await post('/api/suggest', { link: 'https://news.example/a' });
    expect(await all()).toMatchObject([{ note: '', name: null, email: null, credit: 0 }]);
  });

  it('reads one URL a line from a links field', async () => {
    const { post } = world();
    await post('/api/suggest', { links: 'https://a.example/1\r\nhttps://b.example/2' });
    expect(await all()).toMatchObject([{ links: '["https://a.example/1","https://b.example/2"]' }]);
  });

  it('stores an error report against its case', async () => {
    const { post } = world();
    const response = await post('/api/suggest', { kind: 'error', case: 'dnb-2026', note: 'The date is wrong.' });
    expect(location(response)).toBe('/suggest/thanks');
    expect(await all()).toMatchObject([{ kind: 'error', case_slug: 'dnb-2026', links: '[]', note: 'The date is wrong.' }]);
  });

  it('thanks a bot that fills the honeypot and keeps nothing, not even a count against its address', async () => {
    const { post } = world();
    const response = await post('/api/suggest', { link: 'https://spam.example/', website: 'https://spam.example/' });
    expect(location(response)).toBe('/suggest/thanks');
    expect(await all()).toEqual([]);
    expect(await rows('SELECT * FROM rate_hits')).toEqual([]);
  });

  it.each([
    ['no link', { note: 'x' }],
    ['a link that is not http', { link: 'javascript:alert(1)' }],
    ['six links', { link: Array.from({ length: 6 }, (_unused, index) => `https://a.example/${String(index)}`) }],
    ['a note over 2000 characters', { link: 'https://a.example/', note: 'x'.repeat(2001) }],
    ['an email that is not one', { link: 'https://a.example/', email: 'nope' }],
    ['an error report with no note', { kind: 'error', case: 'dnb-2026' }],
    ['an error report with no case', { kind: 'error', note: 'x' }],
  ])('sends %s to the problem page and keeps nothing', async (_label, fields) => {
    const { post } = world();
    const response = await post('/api/suggest', fields);
    expect(response.status).toBe(303);
    expect(location(response)).toBe('/suggest/problem');
    expect(await all()).toEqual([]);
  });

  it('refuses a body that is not a urlencoded form', async () => {
    const { request } = world();
    const response = await request('/api/suggest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ link: 'https://a.example/' }),
    });
    expect(location(response)).toBe('/suggest/problem');
    expect(await all()).toEqual([]);
  });

  it('refuses a body over 64 KB, whether or not it says how big it is', async () => {
    const { request } = world();
    const big = `link=https://a.example/&note=${'x'.repeat(70_000)}`;
    const declared = await request('/api/suggest', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(big.length) },
      body: big,
    });
    expect(location(declared)).toBe('/suggest/problem');
    const streamed = await request('/api/suggest', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(big));
          controller.close();
        },
      }),
      // @ts-expect-error duplex is required for a streamed body and missing from the DOM-free types
      duplex: 'half',
    });
    expect(location(streamed)).toBe('/suggest/problem');
    expect(await all()).toEqual([]);
  });

  it('answers a GET with 405 and the method it allows', async () => {
    const { request } = world();
    const response = await request('/api/suggest');
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });
});

describe('the suggestion rate limit', () => {
  const send = (post: ReturnType<typeof world>['post'], ip: string, at: Date): Promise<Response> =>
    post('/api/suggest', { link: 'https://a.example/' }, { ip, at });

  it('allows 5 an hour from one address and sends the 6th to the problem page', async () => {
    const { post } = world();
    for (let count = 1; count <= 5; count += 1) {
      expect(location(await send(post, '198.51.100.1', noon))).toBe('/suggest/thanks');
    }
    expect(location(await send(post, '198.51.100.1', noon))).toBe('/suggest/problem');
    expect(await all()).toHaveLength(5);
  });

  it('counts each address on its own', async () => {
    const { post } = world();
    for (let count = 1; count <= 5; count += 1) await send(post, '198.51.100.1', noon);
    expect(location(await send(post, '198.51.100.2', noon))).toBe('/suggest/thanks');
  });

  it('counts suggestions apart from sign-ups', async () => {
    const { post } = world();
    for (let count = 1; count <= 5; count += 1) await send(post, '198.51.100.1', noon);
    await post('/api/subscribe', { email: 'a@example.com' }, { ip: '198.51.100.1' });
    expect(await rows('SELECT id FROM subscribers')).toHaveLength(1);
  });

  it('lets the address back in once its first attempt is an hour old', async () => {
    const { post } = world();
    for (let count = 1; count <= 5; count += 1) await send(post, '198.51.100.1', noon);
    const justBefore = new Date(noon.getTime() + 3_600_000 - 1);
    expect(location(await send(post, '198.51.100.1', justBefore))).toBe('/suggest/problem');
    const hourLater = new Date(noon.getTime() + 3_600_000);
    expect(location(await send(post, '198.51.100.1', hourLater))).toBe('/suggest/thanks');
  });

  it('counts a request that fails validation, so probing costs places too', async () => {
    const { post } = world();
    for (let count = 1; count <= 5; count += 1) await post('/api/suggest', { note: 'no link' }, { ip: '198.51.100.1' });
    expect(location(await send(post, '198.51.100.1', noon))).toBe('/suggest/problem');
  });

  it('does not keep the address itself', async () => {
    const { post } = world();
    await send(post, '198.51.100.1', noon);
    const [hit] = await rows<{ key: string }>('SELECT key FROM rate_hits');
    expect(hit?.key).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(await rows('SELECT * FROM rate_hits'))).not.toContain('198.51.100.1');
  });

  it('holds when five requests arrive at the same moment', async () => {
    const { post } = world();
    const responses = await Promise.all(Array.from({ length: 12 }, () => send(post, '198.51.100.9', noon)));
    expect(responses.filter((response) => location(response) === '/suggest/thanks')).toHaveLength(5);
    expect(await all()).toHaveLength(5);
  });
});

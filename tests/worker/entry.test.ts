import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import worker from '../../src/worker/index.ts';
import { clearTables, rows } from './helpers.ts';

beforeEach(clearTables);

// A request typed as one that arrived from the network, which is what a handler is given.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const form = (body: string) => ({
  method: 'POST' as const,
  redirect: 'manual' as const,
  headers: { 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': '203.0.113.50' },
  body,
});

// The real entry point, with the real clock and no mail service reached: these paths send no mail.
describe('the Worker entry point', () => {
  it('handles a suggestion end to end with the real clock', async () => {
    const before = Date.now();
    const response = await exports.default.fetch(
      'https://thedoormanfallacy.com/api/suggest',
      form('link=https%3A%2F%2Fnews.example%2Fa&note=Hello'),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/suggest/thanks');
    const [stored] = await rows<{ created_at: string; note: string }>('SELECT created_at, note FROM suggestions');
    expect(stored?.note).toBe('Hello');
    expect(Date.parse(stored?.created_at ?? '')).toBeGreaterThanOrEqual(before);
    expect(Date.parse(stored?.created_at ?? '')).toBeLessThanOrEqual(Date.now());
  });

  it('shows the check-email page to a bot and stores nothing', async () => {
    const response = await exports.default.fetch(
      'https://thedoormanfallacy.com/api/subscribe',
      form('email=bot%40example.com&website=http%3A%2F%2Fspam.example'),
    );
    expect(response.headers.get('location')).toBe('/subscribe/check-email');
    expect(await rows('SELECT * FROM subscribers')).toEqual([]);
  });

  it('answers 500 and keeps the details to itself when the database fails', async () => {
    const broken = { ...env, DB: {
        prepare: () => {
          throw new Error('D1 is down');
        },
      },
    } as unknown as Env;
    const response = await worker.fetch(
      new IncomingRequest('https://thedoormanfallacy.com/api/suggest', form('link=https%3A%2F%2Fnews.example%2Fa')),
      broken,
    );
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Something went wrong. Please try again in a moment.');
  });
});

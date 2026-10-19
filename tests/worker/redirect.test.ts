import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

// These go through the Worker's default export, so they check that the real entry point is wired.
// The built site is not in play here: a redirect is decided before the assets are asked.
describe('the host redirect', () => {
  it.each([
    ['https://www.thedoormanfallacy.com/ledger/dnb-2026/?a=1', 'https://thedoormanfallacy.com/ledger/dnb-2026/?a=1'],
    ['https://doormanfallacy.com/', 'https://thedoormanfallacy.com/'],
    ['https://www.doormanfallacy.com/idea', 'https://thedoormanfallacy.com/idea'],
    ['http://thedoormanfallacy.com/idea', 'https://thedoormanfallacy.com/idea'],
  ])('sends %s to %s with a 301', async (from, to) => {
    const response = await exports.default.fetch(from, { redirect: 'manual' });
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(to);
  });

  it('redirects a form post on another host rather than handling it', async () => {
    const response = await exports.default.fetch('https://doormanfallacy.com/api/subscribe', {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'email=ada%40example.com',
    });
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://thedoormanfallacy.com/api/subscribe');
  });
});

import { describe, expect, it } from 'vitest';
import { location, world } from './helpers.ts';

describe('routing', () => {
  it('hands every path that is not a form route to the built site, with the request unchanged', async () => {
    const { request } = world();
    const response = await request('/ledger/');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>Ledger</title>');
  });

  it('answers on a local host without redirecting', async () => {
    const { request } = world();
    const response = await request('/idea/', { host: 'http://localhost:8787' });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>Idea</title>');
  });

  it('gives a path with no page the site\'s own 404 page and status', async () => {
    const { request } = world();
    const response = await request('/nothing-here');
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('<title>Not found</title>');
  });

  it('redirects the other hostnames before any route runs', async () => {
    const { request } = world();
    const response = await request('/api/suggest?x=1', { host: 'https://www.doormanfallacy.com', method: 'POST' });
    expect(response.status).toBe(301);
    expect(location(response)).toBe('https://thedoormanfallacy.com/api/suggest?x=1');
  });

  it.each([
    ['/api/suggest', 'POST'],
    ['/api/subscribe', 'POST'],
    ['/confirm', 'GET'],
    ['/unsubscribe', 'GET, POST'],
  ])('refuses the wrong method on %s and says which it takes', async (path, allow) => {
    const { request } = world();
    const response = await request(path, { method: 'DELETE' });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe(allow);
  });
});

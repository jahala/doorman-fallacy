import { describe, expect, it } from 'vitest';
import { captureAddress } from '../../desk/archive.ts';

const article = 'https://ca.news.yahoo.com/e-commerce-ceo-getting-absolutely-084613420.html';

describe('captureAddress', () => {
  it('gives the archived address of the page that was asked for', () => {
    expect(captureAddress(article, { timestamp: '20261021200410', original_url: article })).toEqual({
      ok: true,
      archive: `https://web.archive.org/web/20261021200410/${article}`,
    });
  });

  it('accepts the same page on the same site, such as one reached over a trailing slash or www', () => {
    expect(captureAddress('https://example.com/a', { timestamp: '1', original_url: 'https://www.example.com/a/' }).ok).toBe(true);
  });

  it('refuses a capture of another site, such as an analytics frame inside the page (Dukaan, 2026-10-21)', () => {
    const frame = `https://opus.analytics.yahoo.com/tag/opus-frame.html?referrer=${article}`;
    const result = captureAddress(article, { timestamp: '20261021200410', original_url: frame });
    expect(result).toEqual({ ok: false, message: 'Save Page Now captured another page (opus.analytics.yahoo.com), not the source' });
  });

  it('uses the address asked for when Save Page Now does not say which page it saved', () => {
    expect(captureAddress(article, { timestamp: '2' })).toEqual({ ok: true, archive: `https://web.archive.org/web/2/${article}` });
  });
});

describe('captureAddress and fragments', () => {
  it('leaves the fragment a page reported off the archive address', () => {
    expect(captureAddress('https://www.eltiempo.example/nota', { timestamp: '20261021120000', original_url: 'https://www.eltiempo.example/nota#google_vignette' })).toEqual({
      ok: true,
      archive: 'https://web.archive.org/web/20261021120000/https://www.eltiempo.example/nota',
    });
  });
});

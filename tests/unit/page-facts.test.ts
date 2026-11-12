import { describe, expect, it } from 'vitest';
import { pageFacts } from '../../src/lib/page-facts.ts';

describe('pageFacts', () => {
  it('reads the Open Graph title, the site name and the article date', () => {
    const html = `<html><head><title>CBA reverses cuts | Information Age</title>
      <meta property="og:title" content="CBA reverses AI-driven job cuts">
      <meta property="og:site_name" content="Information Age">
      <meta property="article:published_time" content="2025-08-21T03:10:00+00:00"></head></html>`;
    expect(pageFacts(html)).toEqual({ title: 'CBA reverses AI-driven job cuts', publisher: 'Information Age', published: '2025-08-21' });
  });

  it('falls back on structured data and the title element, with attributes in either order', () => {
    const html = `<title>Union warns on queues</title>
      <meta content="Finance Sector Union" property="og:site_name" />
      <script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-11-02"}</script>`;
    expect(pageFacts(html)).toEqual({ title: 'Union warns on queues', publisher: 'Finance Sector Union', published: '2026-11-02' });
  });

  it('decodes entities and gives null for what the page does not say', () => {
    expect(pageFacts('<title>Jobs &amp; AI</title>')).toEqual({ title: 'Jobs & AI', publisher: null, published: null });
  });

  it('refuses a date that is not a calendar date', () => {
    expect(pageFacts('<meta property="article:published_time" content="yesterday">').published).toBeNull();
  });
});

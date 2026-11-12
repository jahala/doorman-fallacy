import { describe, expect, it } from 'vitest';
import type { Triaged } from '../../desk/clusters.ts';
import { resolveAssessed, resolveReviewed, routeSuggestions } from '../../desk/suggestion-routing.ts';
import type { Suggestion } from '../../desk/suggestion-sql.ts';
import type { Triage } from '../../desk/triage.ts';

const cases = [{ slug: 'cba-2025', company: 'Commonwealth Bank of Australia', short: 'CBA' }];

const triage = (company: string | null): Triage =>
  ({ company, kind: 'announcement', isCase: 0.8, mechanism: 'ai-does-work', roles: 'customer service', headcount: null }) as unknown as Triage;

function lead(url: string, company: string | null, feeds: string[] = ['suggestion'], failed = false): Triaged {
  return { title: url, url, outlet: 'x', published: '2026-11-01', snippet: '', feed: feeds[0] ?? '', query: '', feeds, queries: [''], triage: failed ? null : triage(company) };
}

const suggested = (id: number, links: string[]): Suggestion => ({ id, kind: 'case', caseSlug: null, links, note: '', creditName: null });
const report = (id: number, slug: string): Suggestion => ({ id, kind: 'error', caseSlug: slug, links: ['https://x.example/r'], note: 'The headcount is wrong.', creditName: null });

describe('routeSuggestions', () => {
  it('sends an error report to its case, and resolves one about a case the ledger does not hold', () => {
    const routed = routeSuggestions([report(1, 'cba-2025'), report(2, 'gone-2020')], [], cases);
    expect(routed.reportsForCase.get('cba-2025')).toEqual([{ id: 1, note: 'The headcount is wrong.', links: ['https://x.example/r'] }]);
    expect(routed.resolved).toEqual([{ id: 2, label: 'error:unknown-case' }]);
  });

  it('sends a suggested link about an organisation in the ledger to that case, and another to the assessor', () => {
    const routed = routeSuggestions([suggested(3, ['https://a.example/cba']), suggested(4, ['https://b.example/acme'])], [lead('https://a.example/cba', 'CBA'), lead('https://b.example/acme', 'Acme Bank')], cases);
    expect(routed.linksForCase.get('cba-2025')).toEqual(['https://a.example/cba']);
    expect(routed.toCase.get('cba-2025')).toEqual([3]);
    expect(routed.toAssess.get('Acme Bank')).toEqual([4]);
    expect(routed.resolved).toEqual([]);
  });

  it('resolves a suggestion with no readable page as not a lead, and leaves one whose triage failed open', () => {
    const routed = routeSuggestions([suggested(5, ['https://gone.example/']), suggested(6, ['https://c.example/x'])], [lead('https://c.example/x', null, ['suggestion'], true)], cases);
    expect(routed.resolved).toEqual([{ id: 5, label: 'case:not-a-lead' }]);
    expect([...routed.toAssess.values()].flat()).not.toContain(6);
  });

  it('finds a suggested link that the sweep had found too', () => {
    const routed = routeSuggestions([suggested(7, ['https://b.example/acme'])], [lead('https://b.example/acme', 'Acme Bank', ['suggestion', 'gnews'])], cases);
    expect(routed.toAssess.get('Acme Bank')).toEqual([7]);
  });
});

describe('resolveAssessed', () => {
  it('labels each suggestion by what the assessor and drafter found, and leaves a failed assessment open', () => {
    const toAssess = new Map([
      ['Acme Bank', [1]],
      ['Beta', [2]],
      ['Gamma', [3]],
      ['Delta', [4]],
    ]);
    const assessed = [
      { cluster: 'Acme Bank', ok: true, recommendation: 'draft' },
      { cluster: 'Beta', ok: true, recommendation: 'watch' },
      { cluster: 'Gamma', ok: false, recommendation: null },
      { cluster: 'Delta', ok: true, recommendation: 'draft' },
    ];
    expect(resolveAssessed(toAssess, assessed, new Map([['Acme Bank', { published: true }]]))).toEqual([
      { id: 1, label: 'case:published' },
      { id: 2, label: 'case:watch' },
    ]);
  });
});

describe('resolveReviewed', () => {
  it('resolves what a finished review read, and leaves a review with problems open', () => {
    const toCase = new Map([
      ['cba-2025', [1, 2]],
      ['dnb-2026', [3]],
    ]);
    const reports = new Map([['cba-2025', [{ id: 2, note: '', links: [] }]]]);
    const reviews = new Map([
      ['cba-2025', { reviewed: true, problems: [], reports: [{ id: 2, outcome: 'corrected' as const }] }],
      ['dnb-2026', { reviewed: true, problems: ['agent: no JSON answer'], reports: [] }],
    ]);
    expect(resolveReviewed(toCase, reports, reviews)).toEqual([
      { id: 1, label: 'case:in-ledger' },
      { id: 2, label: 'error:corrected' },
    ]);
  });
});

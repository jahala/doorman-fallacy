import { describe, expect, it } from 'vitest';
import { casesMissing, missingCounts } from '../../src/lib/hidden-work.ts';
import { caseEntry } from './fixture-case.ts';

const entries = [
  caseEntry('alpha-2025', { short: 'Alpha', announced: '2025-03-01', missed: ['signal', 'judgment'] }),
  caseEntry('beta-2026', { short: 'Beta', announced: '2026-06-10', change: 'Support moved to a bot.', missed: ['judgment'] }),
  caseEntry('gamma-2025', { short: 'Gamma', announced: '2025-11-20', missed: ['memory'] }),
];

describe('casesMissing', () => {
  it('lists every case whose doorman reading names the function, newest announcement first', () => {
    expect(casesMissing(entries, 'judgment').map((item) => item.slug)).toEqual(['beta-2026', 'alpha-2025']);
  });

  it('gives the short name, the page, the change and the evidence of each case', () => {
    expect(casesMissing(entries, 'judgment')[0]).toEqual({
      slug: 'beta-2026',
      short: 'Beta',
      href: '/ledger/beta-2026',
      change: 'Support moved to a bot.',
      evidence: ['Evidence for judgment.'],
    });
  });

  it('is empty when no case records the function', () => {
    expect(casesMissing(entries, 'slack')).toEqual([]);
    expect(casesMissing([], 'signal')).toEqual([]);
  });

  it('lists a case once when it names the function twice, and keeps both pieces of evidence', () => {
    const twice = caseEntry('delta-2026', { missed: ['slack', 'slack'] });
    const found = casesMissing([twice], 'slack');
    expect(found).toHaveLength(1);
    expect(found[0]?.evidence).toEqual(['Evidence for slack.', 'Evidence for slack.']);
  });

  it('does not change its input', () => {
    const before = entries.map((item) => item.id);
    casesMissing(entries, 'signal');
    expect(entries.map((item) => item.id)).toEqual(before);
  });
});

describe('missingCounts', () => {
  it('counts the cases for each hidden function, in the vocabulary order, zero included', () => {
    expect(missingCounts(entries)).toEqual([
      { id: 'signal', count: 1 },
      { id: 'deterrence', count: 0 },
      { id: 'judgment', count: 2 },
      { id: 'memory', count: 1 },
      { id: 'absorption', count: 0 },
      { id: 'slack', count: 0 },
    ]);
  });

  it('counts a case once for a function it names twice', () => {
    const twice = caseEntry('delta-2026', { missed: ['slack', 'slack'] });
    expect(missingCounts([twice]).find((item) => item.id === 'slack')?.count).toBe(1);
  });

  it('agrees with casesMissing for every function', () => {
    for (const { id, count } of missingCounts(entries)) expect(casesMissing(entries, id)).toHaveLength(count);
  });
});


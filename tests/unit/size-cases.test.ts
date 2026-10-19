import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { caseSchema } from '../../src/data/case-schema.ts';
import { statusIds } from '../../src/data/statuses.ts';
import { checkCaseText } from '../../scripts/check-cases.ts';
import { syntheticCase } from '../../scripts/size-cases.ts';

function front(text: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  return parse(match?.[1] ?? '') as Record<string, unknown>;
}

describe('syntheticCase', () => {
  const sample = [1, 2, 3, 250, 500].map(syntheticCase);

  it('writes a case that passes every mechanical case check', () => {
    for (const { fileName, text } of sample) expect(checkCaseText(fileName, text)).toEqual([]);
  });

  it('names the organisation Example Organisation and its number, and the file after it', () => {
    const { fileName, text } = syntheticCase(42);
    expect(fileName).toBe('example-organisation-42.md');
    expect(front(text)['company']).toBe('Example Organisation 42');
  });

  it('is clearly fictional: every link is on example.com or the archive of an example.com page', () => {
    for (const { text } of sample) {
      const parsed = caseSchema.parse(front(text));
      for (const source of parsed.sources) {
        expect(source.url).toMatch(/^https:\/\/example\.com\//);
        expect(source.archive).toMatch(/^https:\/\/web\.archive\.org\/web\/\d+\/https:\/\/example\.com\//);
      }
    }
  });

  it('gives each number its own file, and spreads the cases over every status', () => {
    const cases = Array.from({ length: 500 }, (_, index) => syntheticCase(index + 1));
    expect(new Set(cases.map((item) => item.fileName)).size).toBe(500);
    const statuses = new Set(cases.map((item) => caseSchema.parse(front(item.text)).updates.at(-1)?.status));
    expect([...statuses].sort()).toEqual([...statusIds].sort());
  });

  it('keeps the ledger text near its limits, so the page weight measured is not flattered', () => {
    const parsed = caseSchema.parse(front(syntheticCase(500).text));
    expect(parsed.change.length).toBeGreaterThanOrEqual(45);
    expect(parsed.change.length).toBeLessThanOrEqual(60);
    expect((parsed.updates.at(-1)?.summary ?? '').length).toBeGreaterThanOrEqual(60);
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const casesDir = path.resolve(import.meta.dirname, '../fixtures/cases');

/** The front matter of a case fixture, read the way a case file is read: as YAML. */
export function readCaseFixture(name: string): Record<string, unknown> {
  const text = readFileSync(path.join(casesDir, `${name}.md`), 'utf8');
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (match?.[1] === undefined) throw new Error(`${name}.md has no front matter`);
  return parse(match[1]) as Record<string, unknown>;
}

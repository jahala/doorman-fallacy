import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const casesDir = path.resolve(import.meta.dirname, '../fixtures/cases');

/** The whole text of a case fixture, front matter and body. */
export function readCaseFixtureText(name: string): string {
  return readFileSync(path.join(casesDir, `${name}.md`), 'utf8');
}

/** The front matter of a case fixture, read the way a case file is read: as YAML. */
export function readCaseFixture(name: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---/.exec(readCaseFixtureText(name));
  if (match?.[1] === undefined) throw new Error(`${name}.md has no front matter`);
  return parse(match[1]) as Record<string, unknown>;
}

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { caseSchema, type Case, type IsoDate } from '../../src/data/case-schema.ts';
import type { HiddenFunctionId } from '../../src/data/hidden-functions.ts';
import type { StatusId } from '../../src/data/statuses.ts';
import type { CaseEntry } from '../../src/lib/ledger.ts';

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

/** The parts of a case the fixtures vary. */
export interface EntryOptions {
  readonly announced?: IsoDate;
  readonly short?: string;
  readonly change?: string;
  /** Hidden function ids this case misses, in order. */
  readonly missed?: readonly HiddenFunctionId[];
  /** The one update the case has: its status and date. */
  readonly status?: StatusId;
  readonly updated?: IsoDate;
  readonly lastChecked?: IsoDate;
  readonly headcount?: number | null;
  readonly door?: string;
}

/** A parsed case entry built from the valid fixture, with the given parts replaced. */
export function caseEntry(id: string, options: EntryOptions = {}): CaseEntry {
  const base = caseSchema.parse(readCaseFixture('valid'));
  const [firstSource] = base.sources;
  if (firstSource === undefined) throw new Error('the valid fixture has no source');
  const [head, ...tail] = (options.missed ?? []).map((fn) => ({
    function: fn,
    evidence: `Evidence for ${fn}.`,
    sources: [firstSource.id],
  }));
  const missed: Case['missed'] | undefined = head === undefined ? undefined : [head, ...tail];
  const updated = options.updated ?? base.updates[0].date;
  const data: Case = {
    ...base,
    short: options.short ?? base.short,
    change: options.change ?? base.change,
    announced: options.announced ?? base.announced,
    headcount: options.headcount === undefined ? base.headcount : options.headcount,
    door: options.door ?? base.door,
    lastChecked: options.lastChecked ?? base.lastChecked,
    missed: missed ?? base.missed,
    updates: [{ ...base.updates[0], status: options.status ?? 'too-early', date: updated }],
  };
  return { id, data };
}

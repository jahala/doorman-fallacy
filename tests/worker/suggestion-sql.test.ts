import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { openSuggestionsSql, readSuggestionRows, resolveSql } from '../../desk/suggestion-sql.ts';
import { clearTables } from './helpers.ts';

// The desk's SQL, run on the real local D1 with the real migrations, so it cannot drift from the schema.
async function insert(values: { kind: 'case' | 'error'; slug?: string; links: string[]; name?: string; email?: string; credit?: 0 | 1; resolved?: string }): Promise<number> {
  const result = await env.DB.prepare('INSERT INTO suggestions (created_at, kind, case_slug, links, note, name, email, credit, resolved_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) RETURNING id')
    .bind('2026-11-10T09:00:00.000Z', values.kind, values.slug ?? null, JSON.stringify(values.links), 'a note', values.name ?? null, values.email ?? null, values.credit ?? 0, values.resolved ?? null)
    .first<{ id: number }>();
  return result?.id ?? 0;
}

async function open(): Promise<ReturnType<typeof readSuggestionRows>> {
  const rows = await env.DB.prepare(openSuggestionsSql).all();
  return readSuggestionRows(rows.results);
}

describe('the desk reads open suggestions', () => {
  beforeEach(async () => {
    await clearTables();
  });

  it('gives unresolved suggestions oldest first, with their links, and never an email address', async () => {
    const first = await insert({ kind: 'case', links: ['https://example.com/a'], name: 'Ada', email: 'ada@example.com', credit: 1 });
    const second = await insert({ kind: 'error', slug: 'cba-2025', links: [], name: 'Bo', email: 'bo@example.com', credit: 0 });
    await insert({ kind: 'case', links: ['https://example.com/old'], resolved: '2026-11-01T00:00:00.000Z' });
    const read = await open();
    expect(read.problems).toEqual([]);
    expect(read.suggestions).toEqual([
      { id: first, kind: 'case', caseSlug: null, links: ['https://example.com/a'], note: 'a note', creditName: 'Ada' },
      { id: second, kind: 'error', caseSlug: 'cba-2025', links: [], note: 'a note', creditName: null },
    ]);
    expect(JSON.stringify(read)).not.toContain('@example.com');
  });

  it('marks suggestions resolved with their labels, and leaves one already resolved as it was', async () => {
    const a = await insert({ kind: 'case', links: ['https://example.com/a'] });
    const b = await insert({ kind: 'error', slug: 'cba-2025', links: [] });
    const done = await insert({ kind: 'case', links: ['https://example.com/c'], resolved: '2026-11-01T00:00:00.000Z' });
    const built = resolveSql(
      [
        { id: a, label: 'case:watch' },
        { id: b, label: 'error:no-change' },
        { id: done, label: 'case:published' },
      ],
      '2026-11-16T07:30:00.000Z',
    );
    if (!built.ok || built.sql === null) throw new Error('no statement');
    await env.DB.prepare(built.sql).run();
    const rows = await env.DB.prepare('SELECT id, resolved_at, triage_label FROM suggestions ORDER BY id').all();
    expect(rows.results).toEqual([
      { id: a, resolved_at: '2026-11-16T07:30:00.000Z', triage_label: 'case:watch' },
      { id: b, resolved_at: '2026-11-16T07:30:00.000Z', triage_label: 'error:no-change' },
      { id: done, resolved_at: '2026-11-01T00:00:00.000Z', triage_label: null },
    ]);
    expect((await open()).suggestions).toEqual([]);
  });
});

describe('resolveSql', () => {
  it('refuses an id, a label or a time that is not one, so nothing else can reach the statement', () => {
    expect(resolveSql([{ id: 1.5, label: 'case:watch' }], '2026-11-16T07:30:00.000Z').ok).toBe(false);
    expect(resolveSql([{ id: 1, label: "case:watch'; DROP TABLE suggestions; --" as 'case:watch' }], '2026-11-16T07:30:00.000Z').ok).toBe(false);
    expect(resolveSql([{ id: 1, label: 'case:watch' }], "2026-11-16'").ok).toBe(false);
  });

  it('builds no statement when there is nothing to resolve', () => {
    expect(resolveSql([], '2026-11-16T07:30:00.000Z')).toEqual({ ok: true, sql: null });
  });
});

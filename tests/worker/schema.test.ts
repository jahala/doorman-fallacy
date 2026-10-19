import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import dataModel from '../../docs/data-model.md?raw';
import { clearTables, run } from './helpers.ts';

interface Column {
  name: string;
}

async function tables(): Promise<string[]> {
  const result = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name`,
  ).all<{ name: string }>();
  return result.results.map((row) => row.name);
}

describe('the migrated schema', () => {
  it('has exactly the five tables of the data model, plus the rate-limit table', async () => {
    expect(await tables()).toEqual(['leads', 'rate_hits', 'runs', 'seen', 'subscribers', 'suggestions']);
  });

  it('is described, table by table and column by column, in docs/data-model.md', async () => {
    const section = dataModel.slice(dataModel.indexOf('\n## D1'));
    const missing: string[] = [];
    for (const table of await tables()) {
      const heading = `### \`${table}\``;
      if (!section.includes(heading)) {
        missing.push(table);
        continue;
      }
      const described = section.slice(section.indexOf(heading) + heading.length).split(/\n#{2,3} /)[0] ?? '';
      const columns = await env.DB.prepare(`SELECT name FROM pragma_table_info(?1)`).bind(table).all<Column>();
      const documented = [...described.matchAll(/^\| `([a-z_]+)` \|/gm)].map((match) => match[1]);
      expect(documented.toSorted(), `columns documented for ${table}`).toEqual(columns.results.map((column) => column.name).toSorted());
    }
    expect(missing).toEqual([]);
  });

  it('refuses an error report with no case, and a kind that is neither case nor error', async () => {
    await clearTables();
    await expect(run(`INSERT INTO suggestions (created_at, kind, links) VALUES ('2026-10-19T00:00:00.000Z', 'error', '[]')`)).rejects.toThrow();
    await expect(run(`INSERT INTO suggestions (created_at, kind, links) VALUES ('2026-10-19T00:00:00.000Z', 'spam', '[]')`)).rejects.toThrow();
  });

  it('keeps one row for an address and one for a token', async () => {
    await clearTables();
    const insert = (email: string, token: string): Promise<void> =>
      run(`INSERT INTO subscribers (email, token, created_at, token_sent_at) VALUES (?1, ?2, 'x', 'x')`, email, token);
    await insert('a@example.com', 't1');
    await expect(insert('a@example.com', 't2')).rejects.toThrow();
    await expect(insert('b@example.com', 't1')).rejects.toThrow();
  });
});

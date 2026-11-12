/**
 * The desk's door to readers' suggestions in the live D1, through Wrangler, and the leads a
 * suggested case becomes. The SQL lives in desk/suggestion-sql.ts.
 */
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { RawLead } from '../src/lib/leads.ts';
import { pageFacts } from '../src/lib/page-facts.ts';
import type { Page } from './archive.ts';
import type { Suggestion } from './suggestion-sql.ts';

export type D1Result = { ok: true; rows: unknown[] } | { ok: false; message: string };

/** Runs one SQL statement on a D1 database. */
export type D1Run = (sql: string) => Promise<D1Result>;

/**
 * The live database, through `wrangler d1 execute --remote`. Wrangler's login reaches more than one
 * account, so the account in wrangler.jsonc is passed on, as scripts/release.sh does.
 */
export async function wranglerD1(configPath = 'wrangler.jsonc'): Promise<D1Run> {
  const account = /"account_id":\s*"([0-9a-f]+)"/.exec(await readFile(configPath, 'utf8'))?.[1];
  return async (sql) => {
    if (account === undefined) return { ok: false, message: `no account_id in ${configPath}` };
    try {
      const { stdout } = await promisify(execFile)('npx', ['wrangler', 'd1', 'execute', 'doorman-fallacy', '--remote', '--json', '--command', sql], {
        env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: account },
        maxBuffer: 16 * 1024 * 1024,
        timeout: 120_000,
      });
      const parsed = JSON.parse(stdout) as { results?: unknown[]; success?: boolean }[];
      const first = parsed[0];
      if (first?.success !== true) return { ok: false, message: 'D1 answered without success' };
      return { ok: true, rows: first.results ?? [] };
    } catch (error) {
      return { ok: false, message: (error instanceof Error ? error.message : String(error)).slice(0, 300) };
    }
  };
}

/**
 * The leads a suggested case's links become, read from each page's own title, publisher and date.
 * A link whose page cannot be read, or names no title, becomes no lead.
 */
export async function suggestionLeads(suggestions: readonly Suggestion[], fetchPage: (url: string) => Promise<Page>): Promise<RawLead[]> {
  const leads: RawLead[] = [];
  for (const suggestion of suggestions.filter((item) => item.kind === 'case')) {
    for (const url of suggestion.links) {
      const page = await fetchPage(url);
      if (!page.ok) continue;
      const facts = pageFacts(page.html);
      if (facts.title === null) continue;
      leads.push({
        title: facts.title,
        url,
        outlet: facts.publisher ?? new URL(url).hostname.replace(/^www\./, ''),
        published: facts.published ?? '',
        snippet: '',
        feed: 'suggestion',
        query: `suggestion ${String(suggestion.id)}`,
      });
    }
  }
  return leads;
}

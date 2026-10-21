/**
 * The door for DeepSeek's Search and Fetch APIs (https://api-docs.deepseek.com/guides/search/).
 * Search finds pages with their real addresses, publisher and date; Fetch returns a page as
 * Markdown. Each request reserves its price against the run's shared budget (desk/budget.ts)
 * before it is sent. DeepSeek bills only a request that returns HTTP 200 with a result, so that
 * one is settled at the price and any other answer at nothing. A request that got no answer may
 * still have been charged: it is counted in full and never sent again.
 *
 * The key comes from the environment (DEEPSEEK_API_KEY) or the Keychain, read at the moment of
 * use and never printed. The transport is a parameter, so tests pass their own.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { RawLead } from '../src/lib/leads.ts';
import type { Budget } from './budget.ts';
import type { Edition } from './queries.ts';

/** $0.75 per 1,000 successful requests, for Search and Fetch alike (checked 2026-10-21). */
export const usdPerRequest = 0.75 / 1000;

const baseUrl = 'https://api.deepseek.com/v1/tools';

/** The query with the edition's language and the start of the window, in DeepSeek's operators. */
export function deepseekQuery(query: string, edition: Edition, days: number, today: string): string {
  const start = new Date(Date.parse(today) - days * 86_400_000).toISOString().slice(0, 10);
  return `${query} lang:${edition} after:${start}`;
}

interface Result {
  readonly title?: string;
  readonly url?: string;
  readonly site_name?: string | null;
  readonly date?: string | null;
  readonly summary?: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** Search results as sweep leads. Results without a title or an address are left out. */
export function deepseekLeads(body: unknown, query: string): RawLead[] {
  const results = (body as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  return (results as Result[]).flatMap((result) => {
    const title = result.title?.trim() ?? '';
    const url = result.url ?? '';
    if (title === '' || url === '') return [];
    return [
      {
        title,
        url,
        outlet: result.site_name ?? hostOf(url),
        published: result.date?.slice(0, 10) ?? '',
        snippet: result.summary ?? '',
        feed: 'deepseek',
        query,
      },
    ];
  });
}

/** Sends one JSON request. Rejects only when no answer came back. */
export type Post = (url: string, body: unknown, key: string) => Promise<{ status: number; body: unknown }>;

export const httpPost: Post = async (url, body, key) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  return { status: response.status, body: parseJson(await response.text()) };
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

type Failure = { ok: false; reason: 'over-budget' | 'http' | 'no-answer'; message: string };
export type SearchResult = { ok: true; leads: RawLead[]; raw: unknown } | Failure;
export type FetchResult = { ok: true; title: string; content: string } | Failure;

export interface DeepseekDoor {
  search(query: string, options: { count: number; content: boolean }): Promise<SearchResult>;
  fetchPage(url: string): Promise<FetchResult>;
}

export function createDeepseekDoor(options: { budget: Budget; key: string; post?: Post }): DeepseekDoor {
  const post = options.post ?? httpPost;

  /** One request through the budget. `billed` says whether a 200 answer produced a result. */
  async function call(path: string, body: unknown, billed: (answer: unknown) => boolean): Promise<{ ok: true; body: unknown } | Failure> {
    const reservation = options.budget.reserve(usdPerRequest);
    if (reservation === null) return { ok: false, reason: 'over-budget', message: `would pass the $${options.budget.limitUsd.toFixed(2)} budget` };
    let answer: { status: number; body: unknown };
    try {
      answer = await post(`${baseUrl}/${path}`, body, options.key);
    } catch (error) {
      options.budget.possiblyCharged(reservation);
      return { ok: false, reason: 'no-answer', message: error instanceof Error ? error.message : String(error) };
    }
    if (answer.status !== 200) {
      options.budget.settle(reservation, 0);
      const message = (answer.body as { error?: { message?: string } } | null)?.error?.message ?? '';
      return { ok: false, reason: 'http', message: `HTTP ${String(answer.status)}${message === '' ? '' : `: ${message}`}` };
    }
    options.budget.settle(reservation, billed(answer.body) ? usdPerRequest : 0);
    return { ok: true, body: answer.body };
  }

  return {
    async search(query, { count, content }) {
      const result = await call('search', { query, count, need_content: content }, (answer) => deepseekLeads(answer, query).length > 0);
      return result.ok ? { ok: true, leads: deepseekLeads(result.body, query), raw: result.body } : result;
    },
    async fetchPage(url) {
      const page = (answer: unknown): { title: string; content: string } => {
        const { title, content } = (answer ?? {}) as { title?: string; content?: string };
        return { title: title ?? '', content: content ?? '' };
      };
      const result = await call('fetch', { url }, (answer) => page(answer).content !== '');
      return result.ok ? { ok: true, ...page(result.body) } : result;
    },
  };
}

/** The key from the environment, or from the Keychain item Conductor keeps it in. Never printed. */
export async function deepseekKey(): Promise<string | null> {
  const fromEnv = process.env['DEEPSEEK_API_KEY'];
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  try {
    const { stdout } = await promisify(execFile)('security', [
      'find-generic-password',
      '-s',
      'com.conductor.app.production.settings',
      '-a',
      'env:local:shared:DEEPSEEK_API_KEY',
      '-w',
    ]);
    const value = stdout.trim();
    return value === '' ? null : value;
  } catch {
    return null;
  }
}

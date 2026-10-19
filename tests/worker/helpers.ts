import { env } from 'cloudflare:workers';
import type { MailMessage, SendMail } from '../../src/lib/mail.ts';
import type { Deps } from '../../src/worker/deps.ts';
import { handle } from '../../src/worker/routes.ts';

export const origin = 'https://thedoormanfallacy.com';
export const noon = new Date('2026-10-19T12:00:00.000Z');

/** A mail service that keeps what it was asked to send, and says whether it sent it. */
export function recordingMail(result: 'sent' | 'refused' = 'sent'): { readonly send: SendMail; readonly sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    sent,
    send: (message) => {
      sent.push(message);
      return Promise.resolve(result === 'sent' ? { ok: true } : { ok: false });
    },
  };
}

/** The token that `sequentialBytes` makes for its nth call, counting from 1: byte n written 32 times. */
export function tokenNumber(n: number): string {
  return n.toString(16).padStart(2, '0').repeat(32);
}

/** Random bytes that are not random: the nth call returns 32 bytes that all equal n. */
export function sequentialBytes(): (length: number) => Uint8Array {
  let calls = 0;
  return (length) => {
    calls += 1;
    return new Uint8Array(length).fill(calls);
  };
}

export interface World {
  /** Sends a request through the Worker's routes at `at`, as the given visitor. */
  readonly request: (path: string, init?: RequestInit & { at?: Date; ip?: string; host?: string }) => Promise<Response>;
  /** POSTs a urlencoded form. */
  readonly post: (path: string, fields: Record<string, string | string[]>, extra?: { at?: Date; ip?: string }) => Promise<Response>;
  readonly mail: ReturnType<typeof recordingMail>;
}

/** One visit's worth of dependencies: a recording mailer and counted tokens, shared by its requests. */
export function world(mailResult: 'sent' | 'refused' = 'sent'): World {
  const mail = recordingMail(mailResult);
  const randomBytes = sequentialBytes();
  const request: World['request'] = (path, init = {}) => {
    const { at = noon, ip = '203.0.113.7', host = origin, headers, ...rest } = init;
    const deps: Deps = { now: at, randomBytes, sendMail: mail.send };
    const merged = new Headers(headers);
    merged.set('cf-connecting-ip', ip);
    return handle(new Request(new URL(path, host), { redirect: 'manual', ...rest, headers: merged }), env, deps);
  };
  const post: World['post'] = (path, fields, extra = {}) => {
    const body = new URLSearchParams();
    for (const [name, value] of Object.entries(fields)) {
      for (const each of Array.isArray(value) ? value : [value]) body.append(name, each);
    }
    return request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      ...extra,
    });
  };
  return { request, post, mail };
}

export async function clearTables(): Promise<void> {
  await env.DB.batch(
    ['suggestions', 'subscribers', 'rate_hits', 'leads', 'seen', 'runs'].map((table) => env.DB.prepare(`DELETE FROM ${table}`)),
  );
}

export async function rows<Row>(sql: string, ...bindings: unknown[]): Promise<Row[]> {
  const result = await env.DB.prepare(sql).bind(...bindings).all<Row>();
  return result.results;
}

export async function run(sql: string, ...bindings: unknown[]): Promise<void> {
  await env.DB.prepare(sql).bind(...bindings).run();
}

export function location(response: Response): string | null {
  return response.headers.get('location');
}

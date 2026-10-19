/**
 * Fetching pages and archiving them on the Wayback Machine. Every source in a case needs an
 * archived copy. Archiving uses Save Page Now 2 with Jan's archive.org keys when they are in
 * the Keychain (service archive.org, accounts s3-access and s3-secret); anonymous saving is
 * tried otherwise and is unreliable. Keys are read at the moment of use and never printed.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { articleSentences } from '../src/lib/sentences.ts';

const run = promisify(execFile);
const browser = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

export type Archived = { ok: true; archive: string } | { ok: false; message: string };
export type Page = { ok: true; html: string; via: 'direct' | 'wayback' } | { ok: false; message: string };

async function get(url: string, timeoutMs = 30_000): Promise<{ ok: true; body: string } | { ok: false; message: string }> {
  try {
    const response = await fetch(url, { headers: { 'user-agent': browser }, signal: AbortSignal.timeout(timeoutMs) });
    return response.ok ? { ok: true, body: await response.text() } : { ok: false, message: `HTTP ${String(response.status)}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

async function keychain(account: string): Promise<string | null> {
  try {
    const { stdout } = await run('security', ['find-generic-password', '-s', 'archive.org', '-a', account, '-w']);
    const value = stdout.trim();
    return value === '' ? null : value;
  } catch {
    return null;
  }
}

/** "ACCESS:SECRET" for Save Page Now 2, from two Keychain items (service archive.org, accounts s3-access and s3-secret). */
async function archiveKeys(): Promise<string | null> {
  const [access, secret] = await Promise.all([keychain('s3-access'), keychain('s3-secret')]);
  return access === null || secret === null ? null : `${access}:${secret}`;
}

/** The newest successful capture of a URL, or null. */
export async function latestCapture(url: string): Promise<string | null> {
  const query = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=-1&filter=statuscode:200&fl=timestamp,original`;
  const result = await get(query);
  if (!result.ok) return null;
  try {
    const rows = JSON.parse(result.body) as string[][];
    const last = rows.at(-1);
    if (rows.length < 2 || last === undefined) return null;
    const [timestamp, original] = last;
    return timestamp === undefined || original === undefined ? null : `https://web.archive.org/web/${timestamp}/${original}`;
  } catch {
    return null;
  }
}

/** An archived copy of the URL: the newest capture if there is one, otherwise a new one. */
export async function archive(url: string, sleep: (ms: number) => Promise<void>): Promise<Archived> {
  const existing = await latestCapture(url);
  if (existing !== null) return { ok: true, archive: existing };
  const keys = await archiveKeys();
  if (keys === null) {
    await get(`https://web.archive.org/save/${url}`, 90_000);
    const captured = await latestCapture(url);
    return captured === null
      ? { ok: false, message: 'no capture yet; anonymous Save Page Now is unreliable, and no archive.org keys are in the Keychain' }
      : { ok: true, archive: captured };
  }
  let job: string;
  try {
    const response = await fetch('https://web.archive.org/save', {
      method: 'POST',
      headers: { accept: 'application/json', authorization: `LOW ${keys}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}`,
      signal: AbortSignal.timeout(60_000),
    });
    const body = (await response.json()) as { job_id?: string; message?: string };
    if (body.job_id === undefined) return { ok: false, message: body.message ?? `HTTP ${String(response.status)}` };
    job = body.job_id;
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
  for (let attempt = 0; attempt < 36; attempt += 1) {
    await sleep(5000);
    const status = await get(`https://web.archive.org/save/status/${job}`);
    if (!status.ok) continue;
    const parsed = JSON.parse(status.body) as { status?: string; timestamp?: string; original_url?: string; message?: string };
    if (parsed.status === 'success' && parsed.timestamp !== undefined) {
      return { ok: true, archive: `https://web.archive.org/web/${parsed.timestamp}/${parsed.original_url ?? url}` };
    }
    if (parsed.status === 'error') return { ok: false, message: parsed.message ?? 'Save Page Now failed' };
  }
  return { ok: false, message: 'Save Page Now did not finish within three minutes' };
}

/** The page's HTML, from the publisher, or from the newest Wayback capture when the publisher refuses or the page has no article text. */
export async function fetchPage(url: string): Promise<Page> {
  const direct = await get(url);
  if (direct.ok && articleSentences(direct.body).length >= 3) return { ok: true, html: direct.body, via: 'direct' };
  const capture = await latestCapture(url);
  if (capture === null) return { ok: false, message: direct.ok ? 'no article text on the page, and no archived copy' : `${direct.message}, and no archived copy` };
  // "id_" asks the Wayback Machine for the page as captured, without its toolbar.
  const raw = await get(capture.replace(/\/web\/(\d+)\//, '/web/$1id_/'));
  return raw.ok ? { ok: true, html: raw.body, via: 'wayback' } : { ok: false, message: `archived copy: ${raw.message}` };
}

import { fieldsFrom, type Fields } from '../lib/form.ts';

/** The largest form body the Worker reads. The forms hold a few kilobytes at most. */
export const maxBodyBytes = 64 * 1024;

/** Sends the browser to another page after a form, as a GET. */
export function see(location: string): Response {
  return new Response(null, { status: 303, headers: { location, 'cache-control': 'no-store' } });
}

export function methodNotAllowed(allow: string): Response {
  return new Response('Method not allowed', { status: 405, headers: { allow, 'content-type': 'text/plain; charset=utf-8' } });
}

/** The visitor's address as Cloudflare reports it. Absent only outside Cloudflare, such as a local run. */
export function clientAddress(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? 'unknown';
}

/**
 * The fields of a submitted form, or null when the body is not a urlencoded form or is larger than
 * the limit. Reads at most the limit, so a huge body is never held in memory.
 */
export async function readForm(request: Request): Promise<Fields | null> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/x-www-form-urlencoded')) return null;
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBodyBytes) return null;
  if (request.body === null) return {};
  const reader = request.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBodyBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return fieldsFrom(new URLSearchParams(text));
}

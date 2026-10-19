import { describe, expect, it } from 'vitest';
import { cfmailSender } from '../../src/worker/cfmail.ts';

const message = { to: 'ada@example.com', subject: 'Hi', text: 'Body' };

interface Seen {
  url: string;
  method: string | undefined;
  authorization: string | null;
  contentType: string | null;
  body: unknown;
}

/** A fetch that answers with the given status and records what it was asked. This is the network edge only. */
function answering(status: number): { readonly fetcher: typeof fetch; readonly seen: Seen[] } {
  const seen: Seen[] = [];
  const fetcher: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    seen.push({
      url: input instanceof Request ? input.url : String(input),
      method: init?.method,
      authorization: headers.get('authorization'),
      contentType: headers.get('content-type'),
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    });
    return Promise.resolve(new Response('{}', { status }));
  };
  return { fetcher, seen };
}

describe('cfmailSender', () => {
  it('posts the message to the service mailbox send call, with the key as a bearer token only', async () => {
    const { fetcher, seen } = answering(201);
    const result = await cfmailSender('secret-key', fetcher)(message);
    expect(result).toEqual({ ok: true });
    expect(seen).toEqual([
      {
        url: 'https://mail.surraura.com/api/svc/send',
        method: 'POST',
        authorization: 'Bearer secret-key',
        contentType: 'application/json',
        body: { to: [{ address: 'ada@example.com' }], subject: 'Hi', text: 'Body' },
      },
    ]);
    expect(JSON.stringify(seen[0]?.body)).not.toContain('secret-key');
  });

  it.each([400, 401, 429, 500, 200])('treats status %i as not sent: only 201 means sent', async (status) => {
    const { fetcher } = answering(status);
    expect(await cfmailSender('k', fetcher)(message)).toEqual({ ok: false });
  });

  it('treats an unreachable service as not sent', async () => {
    const down: typeof fetch = () => Promise.reject(new TypeError('network down'));
    expect(await cfmailSender('k', down)(message)).toEqual({ ok: false });
  });
});

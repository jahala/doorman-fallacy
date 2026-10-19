import { cfmailPayload, type SendMail } from '../lib/mail.ts';

const sendUrl = 'https://mail.surraura.com/api/svc/send';

/**
 * Sends through cfmail's service mailbox. A 201 means sent; anything else, including a network
 * failure, is a failure the caller can act on. Logs the status only, never the key or the message.
 */
export function cfmailSender(key: string, fetcher: typeof fetch = fetch): SendMail {
  return async (message) => {
    try {
      const response = await fetcher(sendUrl, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify(cfmailPayload(message)),
      });
      await response.body?.cancel();
      if (response.status === 201) return { ok: true };
      console.error(`cfmail refused the message: status ${String(response.status)}`);
    } catch {
      console.error('cfmail could not be reached');
    }
    return { ok: false };
  };
}

import { siteOrigin } from './site.ts';

/** One plain-text message to one person. The sender is the mail service's own mailbox. */
export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export type MailResult = { readonly ok: true } | { readonly ok: false };

/** Sends a message. Production passes the cfmail sender; tests pass one that records. */
export type SendMail = (message: MailMessage) => Promise<MailResult>;

export function confirmationMessage(to: string, token: string): MailMessage {
  return {
    to,
    subject: 'Confirm your subscription to The Doorman Fallacy',
    text: `Hello,

Someone, hopefully you, asked to get updates from the ledger at thedoormanfallacy.com.

Confirm with this link:
${siteOrigin}/confirm?token=${token}

If it was not you, ignore this email. The address is deleted in 7 days unless it is confirmed.

To unsubscribe at any time, open this link and press the button:
${siteOrigin}/unsubscribe?token=${token}

The Doorman Fallacy
${siteOrigin}
`,
  };
}

/** Where the site's own mail goes: the group mailbox the site lists for writing to it. */
export const siteInbox = 'hello@thedoormanfallacy.com';

/**
 * The note to the site when someone confirms a subscription: the total, never the address, so a
 * subscriber's address stays in the database (the privacy page says so).
 */
export function newSubscriberMessage(confirmed: number): MailMessage {
  return {
    to: siteInbox,
    subject: 'New subscriber to The Doorman Fallacy',
    text: `Someone confirmed a subscription to the ledger's updates.

Confirmed subscribers: ${String(confirmed)}.

Their address stays in the site's database and is not in this email.
`,
  };
}

/** The JSON body of cfmail's send call. */
export function cfmailPayload(message: MailMessage): {
  readonly to: readonly [{ readonly address: string }];
  readonly subject: string;
  readonly text: string;
} {
  return { to: [{ address: message.to }], subject: message.subject, text: message.text };
}

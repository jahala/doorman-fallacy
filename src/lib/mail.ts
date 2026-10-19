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

The Doorman Fallacy
${siteOrigin}
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

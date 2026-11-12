import { describe, expect, it } from 'vitest';
import { cfmailPayload, confirmationMessage, newSubscriberMessage } from '../../src/lib/mail.ts';

const token = 'ab'.repeat(32);

describe('confirmationMessage', () => {
  it('has the agreed subject and body, with the token in the link', () => {
    expect(confirmationMessage('ada@example.com', token)).toEqual({
      to: 'ada@example.com',
      subject: 'Confirm your subscription to The Doorman Fallacy',
      text: `Hello,

Someone, hopefully you, asked to get updates from the ledger at thedoormanfallacy.com.

Confirm with this link:
https://thedoormanfallacy.com/confirm?token=${token}

If it was not you, ignore this email. The address is deleted in 7 days unless it is confirmed.

To unsubscribe at any time, open this link and press the button:
https://thedoormanfallacy.com/unsubscribe?token=${token}

The Doorman Fallacy
https://thedoormanfallacy.com
`,
    });
  });

  it('has no em dash', () => {
    expect(confirmationMessage('ada@example.com', token).text).not.toContain('\u2014');
  });
});

describe('newSubscriberMessage', () => {
  it('tells the site that someone confirmed, with the total and no address', () => {
    expect(newSubscriberMessage(3)).toEqual({
      to: 'hello@thedoormanfallacy.com',
      subject: 'New subscriber to The Doorman Fallacy',
      text: `Someone confirmed a subscription to the ledger's updates.

Confirmed subscribers: 3.

Their address stays in the site's database and is not in this email.
`,
    });
  });
});

describe('cfmailPayload', () => {
  it('has the shape of the cfmail send API', () => {
    expect(cfmailPayload({ to: 'ada@example.com', subject: 'Hi', text: 'Body' })).toEqual({
      to: [{ address: 'ada@example.com' }],
      subject: 'Hi',
      text: 'Body',
    });
  });
});

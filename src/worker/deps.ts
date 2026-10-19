import type { SendMail } from '../lib/mail.ts';

/**
 * What a request needs from the outside world besides its bindings. Handlers take these as
 * arguments, so the clock, the random bytes and the mail service are the caller's to give.
 */
export interface Deps {
  /** When this request arrived. */
  readonly now: Date;
  /** Cryptographically random bytes. */
  readonly randomBytes: (length: number) => Uint8Array;
  readonly sendMail: SendMail;
}

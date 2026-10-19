import { valuesOf, type Fields } from './form.ts';
import { hexFromBytes } from './hex.ts';

/** A subscriber's token is this many random bytes. */
export const tokenBytes = 32;

/** The token for these random bytes: lower-case hex, two characters a byte. */
export function tokenFromBytes(bytes: Uint8Array): string {
  return hexFromBytes(bytes);
}

const tokenShape = new RegExp(`^[0-9a-f]{${String(tokenBytes * 2)}}$`);

/** Whether a string could be a token, so a lookup is never made for anything else. */
export function isToken(value: string): boolean {
  return tokenShape.test(value);
}

/** The body of a one-click unsubscribe, which mail programs POST under RFC 8058. */
export function isOneClickBody(fields: Fields): boolean {
  return valuesOf(fields, 'List-Unsubscribe').includes('One-Click');
}

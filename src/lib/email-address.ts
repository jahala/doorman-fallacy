export const emailMaxLength = 254;
const localMaxLength = 64;

// The shape a browser's type="email" field accepts: a local part, then a dotted ASCII domain.
const shape = /^[^\s@<>()[\]\\,;:"]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

/** The address in lower case, or null when it is not an address. Surrounding whitespace is dropped. */
export function parseEmail(raw: string): string | null {
  const address = raw.trim().toLowerCase();
  if (address.length > emailMaxLength || !shape.test(address)) return null;
  const local = address.slice(0, address.indexOf('@'));
  return local.length > localMaxLength ? null : address;
}

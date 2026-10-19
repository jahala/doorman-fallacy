import { describe, expect, it } from 'vitest';
import { parseEmail } from '../../src/lib/email-address.ts';

describe('parseEmail', () => {
  it('accepts an ordinary address and lower-cases it', () => {
    expect(parseEmail('Jan.Larsen+news@Example.co.uk')).toBe('jan.larsen+news@example.co.uk');
  });

  it('trims surrounding whitespace', () => {
    expect(parseEmail('  a@b.no \n')).toBe('a@b.no');
  });

  it.each([
    ['empty', ''],
    ['no at sign', 'jan.example.com'],
    ['two at signs', 'a@b@example.com'],
    ['no dot in the domain', 'a@localhost'],
    ['a space inside', 'a b@example.com'],
    ['an angle bracket', '<a@example.com>'],
    ['a comma', 'a@example.com,b@example.com'],
    ['an empty local part', '@example.com'],
    ['a domain label that starts with a dot', 'a@.example.com'],
    ['a domain that ends with a dot', 'a@example.com.'],
    ['a local part over 64 characters', `${'a'.repeat(65)}@example.com`],
    ['an address over 254 characters', `a@${'b'.repeat(250)}.com`],
  ])('rejects %s', (_label, value) => {
    expect(parseEmail(value)).toBeNull();
  });
});

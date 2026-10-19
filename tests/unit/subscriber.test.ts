import { describe, expect, it } from 'vitest';
import { isOneClickBody, isToken, tokenBytes, tokenFromBytes } from '../../src/lib/subscriber.ts';

describe('tokenFromBytes', () => {
  it('writes 32 bytes as 64 lower-case hex characters', () => {
    const bytes = Uint8Array.from({ length: tokenBytes }, (_unused, index) => index * 8);
    expect(tokenFromBytes(bytes)).toBe('0008101820283038404850586068707880889098a0a8b0b8c0c8d0d8e0e8f0f8');
  });

  it('keeps leading zeros', () => {
    expect(tokenFromBytes(new Uint8Array(tokenBytes))).toBe('0'.repeat(64));
  });

  it('makes a token that isToken accepts', () => {
    expect(isToken(tokenFromBytes(Uint8Array.from({ length: tokenBytes }, (_unused, index) => 255 - index)))).toBe(true);
  });
});

describe('isToken', () => {
  it.each([
    ['empty', ''],
    ['too short', 'abc'],
    ['upper case', 'A'.repeat(64)],
    ['not hex', 'g'.repeat(64)],
    ['65 characters', '0'.repeat(65)],
    ['padded with a space', ` ${'0'.repeat(64)}`],
  ])('rejects %s', (_label, value) => {
    expect(isToken(value)).toBe(false);
  });
});

describe('isOneClickBody', () => {
  it('is true for the RFC 8058 body', () => {
    expect(isOneClickBody({ 'List-Unsubscribe': ['One-Click'] })).toBe(true);
  });

  it('is false for anything else', () => {
    expect(isOneClickBody({})).toBe(false);
    expect(isOneClickBody({ 'List-Unsubscribe': ['Yes'] })).toBe(false);
    expect(isOneClickBody({ token: ['x'] })).toBe(false);
  });
});

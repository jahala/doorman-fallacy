import { describe, expect, it } from 'vitest';
import { fieldsFrom, firstValue, isHoneypotFilled, valuesOf } from '../../src/lib/form.ts';

describe('fieldsFrom', () => {
  it('groups values by name and keeps their order', () => {
    expect(
      fieldsFrom([
        ['link', 'a'],
        ['note', 'n'],
        ['link', 'b'],
      ]),
    ).toEqual({ link: ['a', 'b'], note: ['n'] });
  });

  it('is empty for no pairs', () => {
    expect(fieldsFrom([])).toEqual({});
  });

  it('keeps a field named like an object property as a plain field', () => {
    const fields = fieldsFrom([['constructor', 'x']]);
    expect(fields['constructor']).toEqual(['x']);
  });
});

describe('firstValue', () => {
  it('is the first value, or an empty string', () => {
    expect(firstValue({ a: ['1', '2'] }, 'a')).toBe('1');
    expect(firstValue({}, 'a')).toBe('');
  });
});

describe('isHoneypotFilled', () => {
  it('is false when the website field is absent or empty', () => {
    expect(isHoneypotFilled({})).toBe(false);
    expect(isHoneypotFilled({ website: [''] })).toBe(false);
  });

  it('is true when anything is in it, even spaces', () => {
    expect(isHoneypotFilled({ website: ['https://spam.example'] })).toBe(true);
    expect(isHoneypotFilled({ website: [' '] })).toBe(true);
  });
});

describe('valuesOf', () => {
  it('does not mistake an inherited property for a field', () => {
    expect(valuesOf({}, 'constructor')).toEqual([]);
    expect(valuesOf({}, 'toString')).toEqual([]);
  });
});

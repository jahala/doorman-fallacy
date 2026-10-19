import { describe, expect, it } from 'vitest';
import { contrastRatio, parseHex, relativeLuminance } from '../../src/lib/contrast.ts';

describe('contrastRatio', () => {
  it('is 21 for black on white, the most there is', () => {
    expect(contrastRatio('#000', '#FFF')).toBe(21);
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
  });

  it('is 1 for a colour on itself', () => {
    expect(contrastRatio('#8C8B86', '#8C8B86')).toBe(1);
  });

  it('does not care which colour is the foreground', () => {
    expect(contrastRatio('#55544F', '#FAF9F7')).toBe(contrastRatio('#FAF9F7', '#55544F'));
  });

  it('matches the published value for #777777 on white, 4.48', () => {
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  it('is undefined when a colour is not a hex value', () => {
    expect(contrastRatio('red', '#FFF')).toBeUndefined();
    expect(contrastRatio('#12345', '#FFF')).toBeUndefined();
  });
});

describe('parseHex', () => {
  it('reads short and long forms in either case', () => {
    expect(parseHex('#fa0')).toEqual({ r: 255, g: 170, b: 0 });
    expect(parseHex('#FAF9F7')).toEqual({ r: 250, g: 249, b: 247 });
  });
});

describe('relativeLuminance', () => {
  it('runs from 0 for black to 1 for white', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 10);
  });
});

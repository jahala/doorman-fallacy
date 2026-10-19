/** WCAG 2.x relative luminance and contrast ratio for hex colours. */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Reads #rgb or #rrggbb. Returns undefined for anything else. */
export function parseHex(hex: string): Rgb | undefined {
  const digits = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())?.[1];
  if (digits === undefined) return undefined;
  const full = digits.length === 3 ? digits.replace(/./g, (digit) => digit + digit) : digits;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function linear(channel: number): number {
  const unit = channel / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(colour: Rgb): number {
  return 0.2126 * linear(colour.r) + 0.7152 * linear(colour.g) + 0.0722 * linear(colour.b);
}

/** The ratio between two hex colours, from 1 to 21. Undefined when either is not a hex colour. */
export function contrastRatio(foreground: string, background: string): number | undefined {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (fg === undefined || bg === undefined) return undefined;
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

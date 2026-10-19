import { contrastRatio } from './contrast.ts';

/** Reads the design tokens out of the text of tokens.css. Pure: the caller supplies the text. */

export interface ColourToken {
  readonly name: string;
  readonly light: string;
  readonly dark: string;
}

export interface TypeToken {
  readonly name: string;
  readonly size: string;
  readonly weight: string;
  readonly leading: string;
  readonly tracking: string;
}

export interface SpaceToken {
  readonly name: string;
  readonly value: string;
  readonly px: number;
}

export interface CustomProperty {
  readonly name: string;
  readonly value: string;
}

export const typeTokenNames = ['hero', 'display', 'title', 'subhead', 'lead', 'body', 'small', 'caption'] as const;

/**
 * The lowest WCAG contrast each colour token must reach against `paper`, in light and dark.
 * Text and the focus ring need 4.5, input borders need 3, and `rule` is decorative.
 */
export const contrastMinimum: Readonly<Record<string, number | null>> = {
  paper: null,
  surface: null,
  ink: 4.5,
  'ink-2': 4.5,
  'ink-3': 4.5,
  rule: null,
  field: 3,
  accent: 4.5,
};

/** Every `--name: value;` in the text, comments removed, names without the leading dashes. */
export function customProperties(css: string): CustomProperty[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...withoutComments.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)].flatMap((match) => {
    const [, name, value] = match;
    return name === undefined || value === undefined ? [] : [{ name, value: value.trim() }];
  });
}

export function colourTokens(css: string): ColourToken[] {
  const pattern = /^light-dark\(\s*(#[0-9a-f]{3,6})\s*,\s*(#[0-9a-f]{3,6})\s*\)$/i;
  return customProperties(css).flatMap(({ name, value }) => {
    const match = pattern.exec(value);
    const [, light, dark] = match ?? [];
    return light === undefined || dark === undefined ? [] : [{ name, light, dark }];
  });
}

export function typeTokens(css: string): TypeToken[] {
  const all = customProperties(css);
  const find = (name: string): string | undefined => all.find((d) => d.name === name)?.value;
  return typeTokenNames.flatMap((name) => {
    const size = find(`${name}-size`);
    const weight = find(`${name}-weight`);
    const leading = find(`${name}-leading`);
    const tracking = find(`${name}-tracking`);
    return size === undefined ||
      weight === undefined ||
      leading === undefined ||
      tracking === undefined
      ? []
      : [{ name, size, weight, leading, tracking }];
  });
}

export function spaceTokens(css: string): SpaceToken[] {
  return customProperties(css).flatMap(({ name, value }) => {
    const match = /^space-\d+$/.exec(name) !== null ? /^([\d.]+)rem$/.exec(value) : null;
    const rem = match?.[1];
    return rem === undefined ? [] : [{ name, value, px: Number.parseFloat(rem) * 16 }];
  });
}

/** The colours text sits on: the page, and the bands that set an illustration apart. */
const backgrounds = ['paper', 'surface'] as const;

export interface ContrastFailure {
  readonly token: string;
  readonly mode: 'light' | 'dark';
  /** The background it was measured on. */
  readonly background: (typeof backgrounds)[number];
  /** The measured ratio against that background, or undefined when a colour is not a hex value. */
  readonly ratio: number | undefined;
  readonly minimum: number;
}

/**
 * Every colour token that falls short of its minimum on each background, in light and in dark.
 * A token with a minimum that is missing from the css counts as a failure, so a rename cannot hide one.
 */
export function contrastFailures(css: string): ContrastFailure[] {
  const tokens = colourTokens(css);
  const failures: ContrastFailure[] = [];
  for (const background of backgrounds) {
    const ground = tokens.find((token) => token.name === background);
    for (const [name, minimum] of Object.entries(contrastMinimum)) {
      if (minimum === null) continue;
      const token = tokens.find((candidate) => candidate.name === name);
      for (const mode of ['light', 'dark'] as const) {
        const ratio =
          token === undefined || ground === undefined ? undefined : contrastRatio(token[mode], ground[mode]);
        if (ratio === undefined || ratio < minimum) failures.push({ token: name, mode, background, ratio, minimum });
      }
    }
  }
  return failures;
}

export type Palette = Readonly<Record<'paper' | 'ink' | 'ink-2' | 'ink-3' | 'rule' | 'field' | 'accent', string>>;

const paletteNames = ['paper', 'surface', 'ink', 'ink-2', 'ink-3', 'rule', 'field', 'accent'] as const;

/**
 * The colours of one scheme as plain hex values, for places that cannot use CSS variables: the
 * theme-color tags and the share cards. Undefined when a colour token is missing, so a rename
 * cannot pass quietly.
 */
export function schemePalette(css: string, mode: 'light' | 'dark'): Palette | undefined {
  const tokens = colourTokens(css);
  const entries = paletteNames.map((name) => [name, tokens.find((token) => token.name === name)?.[mode]] as const);
  if (entries.some(([, value]) => value === undefined)) return undefined;
  return Object.fromEntries(entries) as Palette;
}

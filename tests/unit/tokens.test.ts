import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../src/lib/contrast.ts';
import {
  colourTokens,
  contrastFailures,
  contrastMinimum,
  schemePalette,
  spaceTokens,
  typeTokenNames,
  typeTokens,
} from '../../src/lib/tokens.ts';
import { tableAfter } from './markdown-table.ts';

const root = path.resolve(import.meta.dirname, '../..');
const tokensCss = readFileSync(path.join(root, 'src/styles/tokens.css'), 'utf8');
const designDoc = readFileSync(path.join(root, 'docs/design.md'), 'utf8');

describe('tokens.css contrast', () => {
  it('has every colour token the contrast rules name, and no other', () => {
    expect(colourTokens(tokensCss).map((token) => token.name).sort()).toEqual(
      Object.keys(contrastMinimum).sort(),
    );
  });

  it('gives ink, ink-2, ink-3 and accent at least 4.5 : 1 and field at least 3 : 1 on paper and on surface, in light and dark', () => {
    expect(contrastFailures(tokensCss)).toEqual([]);
  });

  it('flags a text colour that is too pale, so the guard can fail', () => {
    const pale = tokensCss.replace(/--ink-2:\s*light-dark\([^)]*\)/, '--ink-2: light-dark(#bbbbbb, #444444)');
    expect(contrastFailures(pale).map(({ token, mode, background }) => `${token} ${mode} on ${background}`)).toEqual([
      'ink-2 light on paper',
      'ink-2 dark on paper',
      'ink-2 light on surface',
      'ink-2 dark on surface',
    ]);
  });

  it('flags a text colour that passes on paper but not on surface', () => {
    const dim = tokensCss.replace(/--surface:\s*light-dark\([^)]*\)/, '--surface: light-dark(#ffffff, #5a5a5a)');
    expect(contrastFailures(dim).map(({ token, mode, background }) => `${token} ${mode} on ${background}`)).toContain('ink-3 dark on surface');
  });

  it('flags a token that was renamed away', () => {
    const renamed = tokensCss.replace('--accent:', '--highlight:');
    expect(contrastFailures(renamed).map(({ token }) => token)).toEqual(['accent', 'accent', 'accent', 'accent']);
  });
});

describe('docs/design.md matches tokens.css', () => {
  const rows = tableAfter(designDoc, 'Colour:');

  it('lists the same colours in light and dark', () => {
    const fromDoc = rows.map(([token, light, dark]) => ({ name: token, light: light?.toLowerCase(), dark: dark?.toLowerCase() }));
    const fromCss = colourTokens(tokensCss).map((token) => ({ name: token.name, light: token.light, dark: token.dark }));
    expect(fromCss).toEqual(fromDoc);
  });

  it('states the contrast that the colours measure', () => {
    for (const [name = '', light = '', dark = '', , stated = ''] of rows) {
      if (stated === '') continue;
      const token = colourTokens(tokensCss).find((candidate) => candidate.name === name);
      const paper = colourTokens(tokensCss).find((candidate) => candidate.name === 'paper');
      if (token === undefined || paper === undefined) throw new Error(`missing token ${name}`);
      const measured = [contrastRatio(light, paper.light), contrastRatio(dark, paper.dark)].map((ratio) => ratio?.toFixed(1));
      expect(stated.replaceAll(' ', '')).toBe(measured.join('/'));
    }
  });

  it('lists the same type scale', () => {
    const fromDoc = tableAfter(designDoc, 'Type: two families').map(([name, size, weight, leading, tracking]) => ({ name, size, weight, leading, tracking }));
    expect(typeTokens(tokensCss)).toEqual(fromDoc);
  });
});

describe('type and space tokens', () => {
  it('defines size, weight, line height and tracking for every type token', () => {
    expect(typeTokens(tokensCss).map((token) => token.name)).toEqual([...typeTokenNames]);
  });

  it('steps space by the 4px base: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128', () => {
    expect(spaceTokens(tokensCss).map((token) => token.px)).toEqual([4, 8, 12, 16, 24, 32, 48, 64, 96, 128]);
  });
});

describe('schemePalette', () => {
  it('reads the colours of one scheme as plain hex values', () => {
    expect(schemePalette(tokensCss, 'light')).toMatchObject({ paper: '#faf9f7', ink: '#0b0b0a' });
    expect(schemePalette(tokensCss, 'dark')).toMatchObject({ paper: '#121211', ink: '#f3f2ee' });
  });

  it('holds every colour token, so a card or a meta tag never reads a name that is not there', () => {
    expect(Object.keys(schemePalette(tokensCss, 'light') ?? {}).sort()).toEqual(Object.keys(contrastMinimum).sort());
  });

  it('is undefined when a colour token is missing', () => {
    expect(schemePalette(tokensCss.replace('--rule:', '--line:'), 'light')).toBeUndefined();
  });
});

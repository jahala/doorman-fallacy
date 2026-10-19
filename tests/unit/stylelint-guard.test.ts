import path from 'node:path';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');

async function warningsFor(file: string): Promise<{ rule: string; text: string }[]> {
  const { results } = await stylelint.lint({
    cwd: root,
    files: [path.join(root, file)],
    configFile: path.join(root, 'stylelint.config.mjs'),
  });
  return results.flatMap((result) => result.warnings.map(({ rule, text }) => ({ rule, text })));
}

describe('the colour guard', () => {
  it('flags hex, rgb, hsl and named colours outside tokens.css', async () => {
    const warnings = await warningsFor('tests/fixtures/css/raw-colour.css');
    const rules = warnings.map((w) => w.rule);
    expect(rules).toContain('color-no-hex');
    expect(rules).toContain('color-named');
    expect(warnings.filter((w) => w.rule === 'function-disallowed-list').map((w) => w.text.match(/"(\w+)"/)?.[1])).toEqual(
      expect.arrayContaining(['rgb', 'hsl']),
    );
  });

  it('flags a colour written in a style block of an .astro file', async () => {
    const warnings = await warningsFor('tests/fixtures/css/raw-colour.astro');
    expect(warnings.map((w) => w.rule)).toContain('color-no-hex');
  });

  it('lets colours come from tokens with var()', async () => {
    expect(await warningsFor('tests/fixtures/css/token-only.css')).toEqual([]);
  });

  it('allows the colour values in tokens.css itself', async () => {
    expect(await warningsFor('src/styles/tokens.css')).toEqual([]);
  });
});

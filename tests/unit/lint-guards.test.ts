import path from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { libPurity } from '../../eslint/lib-purity.ts';

const root = path.resolve(import.meta.dirname, '../..');

/**
 * The project's own ESLint config with its ignore list switched off, since it ignores fixtures,
 * plus the purity rules pointed at the lint fixtures instead of src/lib.
 */
const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: path.join(root, 'eslint.config.ts'),
  ignore: false,
  overrideConfig: [libPurity(['tests/fixtures/lint/*-lib.ts'])],
});

async function messagesFor(fixture: string): Promise<{ ruleId: string | null; line: number; message: string }[]> {
  const [result] = await eslint.lintFiles([path.join(root, 'tests/fixtures/lint', fixture)]);
  return (result?.messages ?? []).map(({ ruleId, line, message }) => ({ ruleId, line, message }));
}

describe('lib purity rules', () => {
  it('flag the clock, files, network and process state in the impure fixture', async () => {
    const messages = await messagesFor('impure-lib.ts');
    const seen = (ruleId: string, text: string): boolean =>
      messages.some((m) => m.ruleId === ruleId && m.message.includes(text));
    expect(seen('no-restricted-properties', 'Date.now')).toBe(true);
    expect(seen('no-restricted-syntax', 'take the date as an argument')).toBe(true);
    expect(seen('no-restricted-imports', 'do I/O at the edge')).toBe(true);
    expect(seen('no-restricted-globals', "'fetch'")).toBe(true);
    expect(seen('no-restricted-globals', "'process'")).toBe(true);
  });

  it('flag each impurity on the line that holds it', async () => {
    const lines = (await messagesFor('impure-lib.ts'))
      .filter((m) => m.ruleId?.startsWith('no-restricted') === true)
      .map((m) => m.line);
    expect(new Set(lines).size).toBeGreaterThanOrEqual(5);
  });

  it('leave a pure file alone, including new Date(text), which has an argument', async () => {
    expect(await messagesFor('pure-lib.ts')).toEqual([]);
  });
});

describe('no-floating-promises', () => {
  it('flags a promise that is started and dropped', async () => {
    const messages = await messagesFor('floating-promise.ts');
    expect(messages.map((m) => m.ruleId)).toContain('@typescript-eslint/no-floating-promises');
  });
});

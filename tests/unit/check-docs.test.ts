import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  briefMaxLines,
  checkBriefLength,
  checkDocFile,
  checkPending,
  extractPathReferences,
  repoPathExists,
} from '../../scripts/check-docs.ts';

const root = path.resolve(import.meta.dirname, '../..');
const fixture = (name: string): string => path.join(root, 'tests/fixtures/docs', name);

describe('extractPathReferences', () => {
  it('finds relative links and backticked repo paths, with their lines', () => {
    const refs = extractPathReferences('see [a](docs/x.md#top)\nand `src/lib/y.ts` here');
    expect(refs).toEqual([
      { line: 1, kind: 'link', target: 'docs/x.md' },
      { line: 2, kind: 'code', target: 'src/lib/y.ts' },
    ]);
  });

  it('skips outside links, anchors, placeholders, commands and fenced blocks', () => {
    const markdown = [
      '[web](https://example.com) [here](#top) [mail](mailto:a@b.c)',
      '`src/content/cases/<company>.md` `npm run src/x`',
      '```',
      '`src/in/fence.ts`',
      '```',
    ].join('\n');
    expect(extractPathReferences(markdown)).toEqual([]);
  });
});

describe('repoPathExists', () => {
  it('finds files and folders', async () => {
    expect(await repoPathExists(root, 'src/lib/status.ts')).toBe(true);
    expect(await repoPathExists(root, 'src/lib/')).toBe(true);
  });

  it('finds a script named without its extension', async () => {
    expect(await repoPathExists(root, 'scripts/check-docs')).toBe(true);
  });

  it('checks a wildcard path up to the wildcard', async () => {
    expect(await repoPathExists(root, 'src/content/cases/*.md')).toBe(true);
    expect(await repoPathExists(root, 'src/nowhere/*.md')).toBe(false);
  });

  it('is false for a path that is not there', async () => {
    expect(await repoPathExists(root, 'src/lib/does-not-exist.ts')).toBe(false);
    expect(await repoPathExists(root, 'scripts/nope')).toBe(false);
  });
});

describe('checkDocFile', () => {
  it('flags the dead path and the dead link in the fixture, and nothing else', async () => {
    const findings = await checkDocFile(root, fixture('dead-path.md'), []);
    expect(findings.map((f) => [f.line, f.message])).toEqual([
      [5, 'Path points at src/lib/does-not-exist.ts, which does not exist'],
      [7, 'Link points at tests/fixtures/docs/missing-plan.md, which does not exist'],
    ]);
  });

  it('passes a document whose paths and links all exist', async () => {
    expect(await checkDocFile(root, fixture('good.md'), [])).toEqual([]);
  });

  it('tolerates a dead path that is on the not-yet-built list', async () => {
    const findings = await checkDocFile(root, fixture('dead-path.md'), ['src/lib/does-not-exist.ts']);
    expect(findings).toHaveLength(1);
  });
});

describe('checkPending', () => {
  it('flags a list entry whose file now exists, so the list can only shrink', async () => {
    const findings = await checkPending(root, ['src/lib/status.ts', 'src/lib/future.ts']);
    expect(findings.map((f) => f.message)).toEqual(['src/lib/status.ts now exists; remove it from notYetBuilt']);
  });
});

describe('checkBriefLength', () => {
  const lines = (count: number): string => `${Array.from({ length: count }, (_, i) => `line ${String(i)}`).join('\n')}\n`;

  it(`allows ${String(briefMaxLines)} lines`, () => {
    expect(checkBriefLength(lines(briefMaxLines))).toEqual([]);
  });

  it(`flags ${String(briefMaxLines + 1)} lines`, () => {
    expect(checkBriefLength(lines(briefMaxLines + 1))).toHaveLength(1);
  });
});

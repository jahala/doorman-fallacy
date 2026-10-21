import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkCopy, findEmDashLines } from '../../scripts/check-copy.ts';

const root = path.resolve(import.meta.dirname, '../..');
const script = path.join(root, 'scripts/check-copy.ts');
const emDash = '\u2014';

describe('findEmDashLines', () => {
  it('returns the 1-based lines that hold an em dash', () => {
    expect(findEmDashLines(`one\ntwo ${emDash} three\nfour\nfive${emDash}`)).toEqual([2, 4]);
  });

  it('ignores hyphens and en dashes', () => {
    expect(findEmDashLines('well-known, 2020–2021')).toEqual([]);
  });
});

describe('verbatim quotes', () => {
  const dash = '\u2014';
  it('leaves an em dash inside a quoted source sentence alone: a footnote, or a quote field in front matter', () => {
    const text = [`[^itpro]: "Atlassian is slashing 150 jobs ${dash} and denying it."`, `    quote: The systems removed 178 million ${dash} before review.`].join('\n');
    expect(findEmDashLines(text)).toEqual([]);
  });

  it('still flags one in the site’s own words, even on a case page', () => {
    expect(findEmDashLines(`Atlassian cut 150 roles ${dash} and denied it.[^itpro]`)).toEqual([1]);
    expect(findEmDashLines(`    summary: Cuts ${dash} more cuts.`)).toEqual([1]);
  });
});

describe('checkCopy', () => {
  it('flags the fixture, naming its file and line', async () => {
    const findings = await checkCopy(root, ['tests/fixtures/copy/em-dash.md']);
    expect(findings).toEqual([
      expect.objectContaining({ file: 'tests/fixtures/copy/em-dash.md', line: 3 }),
    ]);
  });

  it('passes a file without one', async () => {
    expect(await checkCopy(root, ['tests/fixtures/copy/clean.md'])).toEqual([]);
  });

  it('reports a folder that is not there instead of skipping it', async () => {
    const findings = await checkCopy(root, ['src/nothing-here']);
    expect(findings).toEqual([expect.objectContaining({ file: 'src/nothing-here', line: 0 })]);
  });

  it('passes the real site copy', async () => {
    const findings = await checkCopy(root, ['src/content', 'src/pages', 'src/layouts', 'src/components', 'src/data']);
    expect(findings).toEqual([]);
  });
});

describe('the command', () => {
  it('exits with failure on the fixture and names the line', () => {
    const run = spawnSync(process.execPath, [script, 'tests/fixtures/copy/em-dash.md'], { cwd: root, encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('tests/fixtures/copy/em-dash.md:3');
  });

  it('exits with success on a clean file', () => {
    const run = spawnSync(process.execPath, [script, 'tests/fixtures/copy/clean.md'], { cwd: root, encoding: 'utf8' });
    expect(run.status).toBe(0);
  });
});

import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startCasesBuild } from '../../scripts/cases-build.ts';

// A build of the real site with no cases at all: the one state the shipped content can never show.
let work: string;
let outDir: string;

beforeAll(async () => {
  work = await mkdtemp(path.join(os.tmpdir(), 'doorman-empty-'));
  const casesDir = path.join(work, 'cases');
  outDir = path.join(work, 'dist');
  await mkdir(casesDir);
  const build = startCasesBuild({
    root: path.resolve(import.meta.dirname, '../..'),
    casesDir,
    outDir,
    cacheDir: path.join(work, 'cache'),
  });
  const code = await build.exited;
  if (code !== 0) throw new Error(`the build with no cases failed:\n${build.output()}`);
});

afterAll(async () => {
  // This test made work, so it may remove it.
  await rm(work, { recursive: true, force: true });
});

describe('a ledger with no cases', () => {
  it('says the ledger opens with its first cases and links to the idea, with no table', async () => {
    const html = await readFile(path.join(outDir, 'ledger', 'index.html'), 'utf8');
    expect(html).toContain('The ledger opens with its first cases.');
    expect(html).toMatch(/<a href="\/idea">/);
    expect(html).not.toContain('<table');
  });

  it('shows the same empty state in the home page preview', async () => {
    const html = await readFile(path.join(outDir, 'index.html'), 'utf8');
    expect(html).toContain('The ledger opens with its first cases.');
    expect(html).not.toContain('<table');
  });

  it('builds an empty feed', async () => {
    const feed = await readFile(path.join(outDir, 'rss.xml'), 'utf8');
    expect(feed).toContain('<channel>');
    expect(feed).not.toContain('<item>');
  });
});

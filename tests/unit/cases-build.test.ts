import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { makeBuildFolder, startCasesBuild } from '../../scripts/cases-build.ts';

// Astro puts a build's intermediate files in .astro/.prerender of the working directory when the
// output folder lies outside it, and deletes that folder when done. Run from the project, two
// test builds at once then delete each other's files. A cases build must leave the project's
// .astro alone; this marker is deleted by Astro's cleanup if it does not.
const root = path.resolve(import.meta.dirname, '../..');
const marker = path.join(root, '.astro', '.prerender', `marker-${String(process.pid)}`);
let work = '';

afterAll(async () => {
  // This test made both, so it may remove them.
  await rm(marker, { force: true });
  if (work !== '') await rm(work, { recursive: true, force: true });
});

it("a cases build leaves the project's .astro folder alone", async () => {
  await mkdir(path.dirname(marker), { recursive: true });
  await writeFile(marker, 'left by tests/unit/cases-build.test.ts');
  work = await makeBuildFolder(root, 'cases-build');
  const casesDir = path.join(work, 'cases');
  await mkdir(casesDir);
  const build = startCasesBuild({ root, casesDir, outDir: path.join(work, 'dist'), cacheDir: path.join(work, 'cache') });
  const code = await build.exited;
  expect(code, build.output()).toBe(0);
  expect(await readFile(marker, 'utf8')).toContain('left by');
});

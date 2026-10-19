import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startInOwnGroup, type GroupRun } from './site-harness.ts';

const astroBin = path.join(path.dirname(fileURLToPath(import.meta.resolve('astro/package.json'))), 'bin', 'astro.mjs');

export interface CasesBuild {
  /** The root of the project to build. */
  readonly root: string;
  /** A folder of case files, read in place of src/content/cases (the DOORMAN_CASES_DIR switch). */
  readonly casesDir: string;
  /** Where the built site goes. Never dist/, which belongs to `npm run build`. */
  readonly outDir: string;
  /** Where Astro keeps its build cache, so the build leaves the project's own cache alone. */
  readonly cacheDir: string;
}

/**
 * Builds the site from another folder of cases, in its own process group, into another folder.
 * Output is captured: read it from the returned run when the build fails.
 */
export function startCasesBuild(build: CasesBuild): GroupRun {
  return startInOwnGroup(process.execPath, [astroBin, 'build', '--outDir', build.outDir], {
    cwd: build.root,
    env: { ...process.env, DOORMAN_CASES_DIR: build.casesDir, DOORMAN_CACHE_DIR: build.cacheDir },
    capture: true,
  });
}

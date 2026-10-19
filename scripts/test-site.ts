import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startInOwnGroup, withSiteHarness, type GroupRun } from './site-harness.ts';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');

try {
  await access(path.join(dist, 'index.html'));
} catch {
  console.error('test-site: dist/ has no build. Run `npm run build` first.');
  process.exit(2);
}

const playwrightCli = fileURLToPath(import.meta.resolve('@playwright/test/cli'));
let run: GroupRun | undefined;

const stop = (signal: NodeJS.Signals): void => {
  run?.stop(signal);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

const { outcome, report } = await withSiteHarness(dist, ({ url, tempDir }) => {
  run = startInOwnGroup(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)], {
    cwd: root,
    env: { ...process.env, SITE_URL: url, SITE_TEST_TMP: tempDir },
  });
  return run.exited;
});

if (outcome.status === 'rejected') {
  console.error('test-site: the test run failed to start:', outcome.reason);
  process.exit(1);
}

if (!report.tempDirRemoved || !report.serverClosed) {
  console.error(
    `test-site: cleanup check failed (temp folder removed: ${String(report.tempDirRemoved)}, server closed: ${String(report.serverClosed)})`,
  );
  process.exit(1);
}

console.log('test-site: temp folder removed, server closed');
process.exit(outcome.value);

import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// scripts/test-site.ts starts the server and makes the temporary folder, then runs this config.
const tempDir = process.env['SITE_TEST_TMP'];
if (tempDir === undefined) {
  throw new Error('Run the site tests with `npm run test:site`, which serves dist/ and sets SITE_TEST_TMP.');
}

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: path.join(tempDir, 'results'),
  reporter: 'list',
  fullyParallel: true,
  forbidOnly: true,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

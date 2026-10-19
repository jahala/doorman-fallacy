import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// The config requires the secret CFMAIL_KEY. A stand-in satisfies it; no test reaches cfmail.
process.env['CFMAIL_KEY'] = 'test-key-not-real';
// Wrangler's notice that it read secrets from the environment would print once per test file.
process.env['WRANGLER_LOG'] = 'warn';

// The Worker's tests run inside workerd with a real local D1. The migrations in migrations/ are
// applied to it by tests/worker/apply-migrations.ts, the way `wrangler d1 migrations apply` does.
export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, 'migrations')),
        },
        // The real asset server, over a few pages in tests/fixtures/assets instead of the built site.
        assets: {
          directory: path.join(import.meta.dirname, 'tests/fixtures/assets'),
          binding: 'ASSETS',
          assetConfig: { not_found_handling: '404-page' },
        },
      },
    })),
  ],
  test: {
    include: ['tests/worker/**/*.test.ts'],
    setupFiles: ['./tests/worker/apply-migrations.ts'],
    testTimeout: 30_000,
  },
});

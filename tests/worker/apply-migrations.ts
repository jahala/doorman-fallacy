import { applyD1Migrations, type D1Migration } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

// The same steps, from the same files, that `wrangler d1 migrations apply` applies in production.
// vitest.worker.config.ts reads the migrations and adds them to the test environment.
const { TEST_MIGRATIONS } = env as Env & { TEST_MIGRATIONS: D1Migration[] };

await applyD1Migrations(env.DB, TEST_MIGRATIONS);

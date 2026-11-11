import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // A timeout catches a hang, never slowness. Some setup steps build the whole site (the empty
    // ledger), which takes several seconds and longer on a busy machine, so setup gets the same
    // limit as a test instead of Vitest's default 10 seconds.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});

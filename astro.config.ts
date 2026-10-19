import { defineConfig } from 'astro/config';

// The size test and the empty-ledger test build into folders of their own and keep their cache
// there too, so they never touch the project's cache. A build for the site sets neither switch.
const cacheDir = process.env['DOORMAN_CACHE_DIR'];

export default defineConfig({
  ...(cacheDir === undefined ? {} : { cacheDir }),
  site: 'https://thedoormanfallacy.com',
  output: 'static',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});

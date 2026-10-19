import { defineConfig } from 'astro/config';

// The size test and the empty-ledger test build into folders of their own and keep their caches
// there too: Astro's, and Vite's dependency cache, which otherwise lives in node_modules/.vite and
// is renamed into place on a cold start, so two builds starting at once fail with ENOTEMPTY.
// A build for the site sets neither switch.
const cacheDir = process.env['DOORMAN_CACHE_DIR'];

export default defineConfig({
  ...(cacheDir === undefined ? {} : { cacheDir, vite: { cacheDir: `${cacheDir}/vite` } }),
  site: 'https://thedoormanfallacy.com',
  output: 'static',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});

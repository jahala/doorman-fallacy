import { satteri } from '@astrojs/markdown-satteri';
import { defineConfig } from 'astro/config';
import { demotedHeadings, lowerHeading } from './src/lib/demote-headings.ts';

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
  // Case bodies are the only Markdown. Their headings, and the footnotes' label, sit one level
  // below the h2 of the section that holds them.
  markdown: {
    processor: satteri({
      hastPlugins: [
        {
          name: 'lower-headings',
          element: { filter: [...demotedHeadings], visit: (node) => ({ ...node, tagName: lowerHeading(node.tagName) }) },
        },
      ],
    }),
  },
});

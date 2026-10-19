import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test as base } from '@playwright/test';

export const distDir = path.resolve(import.meta.dirname, '../../dist');

function requireBuild(): void {
  try {
    statSync(path.join(distDir, 'index.html'));
  } catch {
    throw new Error('dist/ has no build. Run `npm run build` before the site tests.');
  }
}

/** Every file under dist/, as paths relative to dist/ with forward slashes. */
export function distFiles(): string[] {
  requireBuild();
  return readdirSync(distDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(distDir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'));
}

/** URL path of each built page: index.html is its folder, 404.html is itself. */
export function builtRoutes(): string[] {
  return distFiles()
    .filter((file) => file.endsWith('.html'))
    .map((file) => (file === 'index.html' ? '/' : file.endsWith('/index.html') ? `/${file.slice(0, -'index.html'.length)}` : `/${file}`))
    .sort();
}

export function readBuilt(file: string): string {
  return readFileSync(path.join(distDir, file), 'utf8');
}

export function htmlFileForRoute(route: string): string {
  return route.endsWith('/') ? `${route.slice(1)}index.html` : route.slice(1);
}

/** The built file a URL path resolves to, the way static hosting maps it. Undefined when none does. */
export function fileForPath(urlPath: string): string | undefined {
  const files = new Set(distFiles());
  const trimmed = decodeURIComponent(urlPath).replace(/^\//, '');
  const candidates = [trimmed, `${trimmed.replace(/\/$/, '')}/index.html`.replace(/^\//, '')];
  return candidates.find((candidate) => candidate !== '' && files.has(candidate));
}

export const test = base.extend<{ siteUrl: string }>({
  // eslint-disable-next-line no-empty-pattern
  siteUrl: async ({}, use) => {
    const url = process.env['SITE_URL'];
    if (url === undefined) throw new Error('SITE_URL is not set. Run the tests with `npm run test:site`.');
    await use(url);
  },
});

export { expect } from '@playwright/test';

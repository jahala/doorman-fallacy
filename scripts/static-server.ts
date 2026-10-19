import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

export interface StaticServer {
  /** Base URL such as http://127.0.0.1:41234, on a port the OS chose. */
  readonly url: string;
  /** Stops accepting connections, drops open ones, and resolves once the port is free. */
  close(): Promise<void>;
}

const contentTypes: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.json': 'application/json',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

async function isFile(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
}

/** Maps a URL path to a file under root the way static hosting does: the file, or its index.html. */
async function resolveFile(root: string, urlPath: string): Promise<string | undefined> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return undefined;
  }
  const target = path.join(root, decoded);
  if (target !== root && !target.startsWith(root + path.sep)) return undefined;
  for (const candidate of [target, path.join(target, 'index.html')]) {
    if (await isFile(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Serves a built folder over HTTP on a free port. A path with no file gets 404.html with status 404,
 * which is what the Cloudflare "404-page" setting does.
 */
export async function startStaticServer(root: string): Promise<StaticServer> {
  const absoluteRoot = path.resolve(root);

  const server = createServer((request, response) => {
    void (async () => {
      const { pathname } = new URL(request.url ?? '/', 'http://localhost');
      const file = await resolveFile(absoluteRoot, pathname);
      const served = file ?? (await resolveFile(absoluteRoot, '/404.html'));
      if (served === undefined) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      const body = await readFile(served);
      response.writeHead(file === undefined ? 404 : 200, {
        'content-type': contentTypes[path.extname(served)] ?? 'application/octet-stream',
      });
      response.end(body);
    })().catch(() => {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Server error');
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${String(port)}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) resolve();
          else reject(error);
        });
        server.closeAllConnections();
      }),
  };
}

import { access, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startInOwnGroup, withSiteHarness } from '../../scripts/site-harness.ts';
import { startStaticServer } from '../../scripts/static-server.ts';

let distDir: string;

beforeAll(async () => {
  distDir = await mkdtemp(path.join(os.tmpdir(), 'doorman-harness-test-'));
  await writeFile(path.join(distDir, 'index.html'), '<p>home</p>');
  await writeFile(path.join(distDir, '404.html'), '<p>missing</p>');
});

afterAll(async () => {
  // This test made distDir, so it may remove it.
  await rm(distDir, { recursive: true, force: true });
});

describe('the static server', () => {
  it('serves files on a port the OS chose, and 404.html with status 404 for the rest', async () => {
    const server = await startStaticServer(distDir);
    try {
      expect(Number(new URL(server.url).port)).toBeGreaterThan(0);
      const home = await fetch(server.url);
      expect([home.status, await home.text()]).toEqual([200, '<p>home</p>']);
      const missing = await fetch(`${server.url}/nope`);
      expect([missing.status, await missing.text()]).toEqual([404, '<p>missing</p>']);
    } finally {
      await server.close();
    }
  });

  it('does not serve files outside its folder', async () => {
    const server = await startStaticServer(distDir);
    try {
      const escape = await fetch(`${server.url}/..%2f..%2fetc/hosts`);
      expect(escape.status).toBe(404);
    } finally {
      await server.close();
    }
  });
});

describe('withSiteHarness', () => {
  it('leaves no temp folder and no open server after a run that succeeds', async () => {
    let seen: { url: string; tempDir: string } | undefined;
    const { outcome, report } = await withSiteHarness(distDir, async (context) => {
      seen = context;
      await access(context.tempDir);
      return (await fetch(context.url)).status;
    });
    expect(outcome).toEqual({ status: 'fulfilled', value: 200 });
    expect(report).toEqual({ tempDirRemoved: true, serverClosed: true });
    await expect(access(seen?.tempDir ?? '')).rejects.toThrow();
    await expect(fetch(seen?.url ?? '')).rejects.toThrow();
  });

  it('cleans up the same way when the run throws', async () => {
    const { outcome, report } = await withSiteHarness(distDir, () => Promise.reject(new Error('boom')));
    expect(outcome.status).toBe('rejected');
    expect(report).toEqual({ tempDirRemoved: true, serverClosed: true });
  });
});

describe('startInOwnGroup', () => {
  // The child starts a grandchild that would write a file after a minute, then exits at once.
  const parent = `
    const { spawn } = require('node:child_process');
    spawn(process.execPath, ['-e', "setTimeout(() => require('node:fs').writeFileSync(process.env.LATE_FILE, 'late'), 60000)"], { stdio: 'ignore' }).unref();
  `;

  it('resolves only after the whole group is gone, so no straggler outlives the run', async () => {
    const scratch = await mkdtemp(path.join(os.tmpdir(), 'doorman-group-test-'));
    try {
      const run = startInOwnGroup(process.execPath, ['-e', parent], {
        cwd: scratch,
        env: { ...process.env, LATE_FILE: path.join(scratch, 'late.txt') },
        graceMs: 100,
      });
      expect(await run.exited).toBe(0);
      expect(() => process.kill(-(run.pid ?? 0), 0)).toThrow();
      expect(await readdir(scratch)).toEqual([]);
    } finally {
      // This test made scratch, so it may remove it.
      await rm(scratch, { recursive: true, force: true });
    }
  });

  it('passes on the child\'s exit code', async () => {
    const run = startInOwnGroup(process.execPath, ['-e', 'process.exit(3)'], { cwd: os.tmpdir(), env: process.env });
    expect(await run.exited).toBe(3);
  });
});

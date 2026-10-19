import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { connect } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { startStaticServer } from './static-server.ts';

export interface HarnessContext {
  /** Base URL of the server, on a port the OS chose. */
  readonly url: string;
  /** A folder made for this run alone. It is removed when the run ends. */
  readonly tempDir: string;
}

export interface HarnessReport {
  /** The temporary folder is gone. */
  readonly tempDirRemoved: boolean;
  /** Nothing listens on the server's port any more. */
  readonly serverClosed: boolean;
}

export interface HarnessResult<T> {
  readonly outcome: PromiseSettledResult<T>;
  readonly report: HarnessReport;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function portAccepts(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
}

/**
 * Serves `distDir` on a free port and gives the run a private temporary folder.
 * Whatever the run does, including throwing, the server is closed and the folder removed,
 * and the report states whether each really is gone.
 */
export async function withSiteHarness<T>(
  distDir: string,
  run: (context: HarnessContext) => Promise<T>,
): Promise<HarnessResult<T>> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'doorman-site-'));
  let server;
  try {
    server = await startStaticServer(distDir);
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
  const port = Number(new URL(server.url).port);

  const outcome = await run({ url: server.url, tempDir }).then(
    (value): PromiseFulfilledResult<T> => ({ status: 'fulfilled', value }),
    (reason: unknown): PromiseRejectedResult => ({ status: 'rejected', reason }),
  );

  await server.close();
  // This run made tempDir, so removing it recursively is the one deletion a run may do itself.
  await rm(tempDir, { recursive: true, force: true });

  return {
    outcome,
    report: {
      tempDirRemoved: !(await pathExists(tempDir)),
      serverClosed: !(await portAccepts(port)),
    },
  };
}

export interface GroupRun {
  /** The process group's id: the child's pid. Undefined when the child could not start. */
  readonly pid: number | undefined;
  /** Sends a signal to every process in the group. */
  stop(signal: NodeJS.Signals): void;
  /** The child's exit code, resolved only once no process of the group is left. */
  readonly exited: Promise<number>;
}

export interface GroupOptions {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  /** How long stragglers get to exit after the child has, before they are asked to stop, then killed. */
  readonly graceMs?: number;
}

function groupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Runs a command in its own process group, so that the workers and browsers it starts can be
 * found and stopped with it. `exited` resolves after the whole group is gone, which means
 * nothing can write into the run's temporary folder after the harness removes it.
 */
export function startInOwnGroup(file: string, args: readonly string[], options: GroupOptions): GroupRun {
  const child = spawn(file, args, { cwd: options.cwd, env: options.env, stdio: 'inherit', detached: true });
  const { pid } = child;
  const graceMs = options.graceMs ?? 2000;

  const stop = (signal: NodeJS.Signals): void => {
    if (pid === undefined) return;
    try {
      process.kill(-pid, signal);
    } catch {
      // The group is already gone, which is what the caller wants.
    }
  };

  const reap = async (): Promise<void> => {
    if (pid === undefined) return;
    let waited = 0;
    let asked = false;
    while (groupAlive(pid)) {
      if (waited >= graceMs && !asked) {
        stop('SIGTERM');
        asked = true;
      } else if (waited >= graceMs * 3) {
        stop('SIGKILL');
      }
      await pause(25);
      waited += 25;
    }
  };

  const exited = new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => {
      resolve(code ?? (signal === null ? 1 : 128));
    });
  }).then(async (code) => {
    await reap();
    return code;
  });

  return { pid, stop, exited };
}

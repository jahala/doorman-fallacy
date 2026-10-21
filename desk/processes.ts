/**
 * Starts child processes for the desk (Claude Code runs) and makes sure none outlives the
 * desk run. Each child gets its own process group; when the desk run is interrupted or
 * terminated, every group it started is stopped before it exits.
 */
import { spawn } from 'node:child_process';

export type Ran = { ok: true; stdout: string } | { ok: false; code: number | null; stdout: string; stderr: string; message: string };

const running = new Set<number>();
let handlersInstalled = false;

function stopAll(): void {
  for (const pid of running) {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      // The group has already ended.
    }
  }
  running.clear();
}

function installHandlers(): void {
  if (handlersInstalled) return;
  handlersInstalled = true;
  for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]] as const) {
    process.on(signal, () => {
      stopAll();
      process.exit(code);
    });
  }
  process.on('exit', stopAll);
}

export function runTracked(
  command: string,
  args: readonly string[],
  options: { timeoutMs: number; onStart?: (pid: number) => void; env?: NodeJS.ProcessEnv },
): Promise<Ran> {
  installHandlers();
  return new Promise((resolve) => {
    const child = spawn(command, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: options.env ?? process.env });
    const pid = child.pid;
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    if (pid !== undefined) {
      running.add(pid);
      options.onStart?.(pid);
    }
    const timer = setTimeout(() => {
      if (pid !== undefined) {
        try {
          process.kill(-pid, 'SIGTERM');
        } catch {
          // Already ended.
        }
      }
    }, options.timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      if (pid !== undefined) running.delete(pid);
      resolve({ ok: false, code: null, stdout, stderr, message: error.message });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (pid !== undefined) running.delete(pid);
      if (code === 0) resolve({ ok: true, stdout });
      else resolve({ ok: false, code, stdout, stderr, message: signal === null ? `exit ${String(code)}` : `stopped by ${signal}` });
    });
  });
}

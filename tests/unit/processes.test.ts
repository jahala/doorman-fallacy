import { spawn } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runTracked } from '../../desk/processes.ts';

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function until(condition: () => boolean, limitMs: number): Promise<boolean> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > limitMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return true;
}

describe('runTracked', () => {
  it('returns the output of a finished command', async () => {
    const result = await runTracked('node', ['-e', 'process.stdout.write("hello")'], { timeoutMs: 10_000 });
    expect(result).toEqual({ ok: true, stdout: 'hello' });
  });

  it('reports a failing command instead of throwing', async () => {
    const result = await runTracked('node', ['-e', 'process.exit(3)'], { timeoutMs: 10_000 });
    expect(result.ok).toBe(false);
  });

  it('stops the child it started when its own process is killed', async () => {
    const runner = spawn(process.execPath, [path.join(import.meta.dirname, '../fixtures/processes/runner.ts')], { stdio: ['ignore', 'pipe', 'inherit'] });
    const childPid = await new Promise<number>((resolve) => {
      runner.stdout.on('data', (chunk: Buffer) => {
        const match = /child (\d+)/.exec(chunk.toString());
        if (match?.[1] !== undefined) resolve(Number(match[1]));
      });
    });
    expect(alive(childPid)).toBe(true);
    const exited = new Promise((resolve) => runner.on('exit', resolve));
    runner.kill('SIGTERM');
    await exited;
    expect(await until(() => !alive(childPid), 5_000)).toBe(true);
  });
});

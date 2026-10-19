import { spawn, execFileSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const script = path.resolve(import.meta.dirname, '../../scripts/size-test.ts');

interface Finished {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
}

/** Runs the size test on a few cases. When `killAfter` is given, sends SIGTERM once that line has been printed. */
function runSizeTest(cases: number, killAfter?: string): Promise<Finished> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, '--cases', String(cases)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let killed = false;
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (killAfter !== undefined && !killed && stdout.includes(killAfter)) {
        killed = true;
        child.kill('SIGTERM');
      }
    });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      resolve({ code, signal, stdout });
    });
  });
}

function workFolder(stdout: string): string {
  const folder = /working in (\S+)/.exec(stdout)?.[1];
  if (folder === undefined) throw new Error(`the size test never said where it worked:\n${stdout}`);
  return folder;
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function processesMentioning(folder: string): string[] {
  const listing = execFileSync('ps', ['-ax', '-o', 'command='], { encoding: 'utf8' });
  return listing.split('\n').filter((line) => line.includes(folder));
}

describe('the size test', () => {
  it('builds the cases it generated, reports the ledger page, and leaves nothing behind', async () => {
    const result = await runSizeTest(12);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/12 cases built in/);
    expect(result.stdout).toMatch(/\/ledger\/index\.html is \d+ bytes .*, 12 rows/);
    const folder = workFolder(result.stdout);
    expect(await exists(folder)).toBe(false);
  });

  it('removes its folder and stops its build when it is killed mid-build', async () => {
    const result = await runSizeTest(60, 'building');
    expect(result.code).not.toBe(0);
    const folder = workFolder(result.stdout);
    expect(await exists(folder)).toBe(false);
    expect(processesMentioning(folder)).toEqual([]);
  });
});

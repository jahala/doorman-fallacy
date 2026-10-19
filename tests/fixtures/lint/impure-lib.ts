import { readFileSync } from 'node:fs';

// Fixture: every line below breaks the rule that src/lib is pure. The lint test
// runs the purity rules on this file and expects each one to be flagged.

export function clock(): number {
  return Date.now();
}

export function today(): Date {
  return new Date();
}

export function readIt(): string {
  return readFileSync('/etc/hosts', 'utf8');
}

export async function network(): Promise<number> {
  const response = await fetch('https://example.com');
  return response.status;
}

export function environment(): string | undefined {
  return process.env['HOME'];
}

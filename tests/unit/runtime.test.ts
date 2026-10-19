import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

it('runs on the Node major version in .nvmrc', () => {
  const wanted = readFileSync(path.join(import.meta.dirname, '../../.nvmrc'), 'utf8').trim().split('.')[0];
  const actual = process.versions.node.split('.')[0];
  expect(actual, `Node ${process.versions.node} is running, but .nvmrc asks for ${String(wanted)}. Switch with: nvm use`).toBe(wanted);
});

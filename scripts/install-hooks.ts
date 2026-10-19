// Points git at .githooks so the pre-push check runs. Called by `npm install` (the prepare script).
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
} catch {
  console.log('install-hooks: not a git checkout, so no hooks were installed');
  process.exit(0);
}
execFileSync('git', ['config', 'core.hooksPath', '.githooks']);
console.log('install-hooks: git hooks now come from .githooks');

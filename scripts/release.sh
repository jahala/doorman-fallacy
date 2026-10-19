#!/usr/bin/env bash
# One command from checked code to the live site. It stops at the first failing step.
set -euo pipefail

cd "$(dirname "$0")/.."

npm run check
npm run build
npm run test:site

echo
echo "To undo: npx wrangler rollback (the previous Worker and site)."
echo "A migration is undone by a new migration."
echo

# The list is the dry run: it shows what the apply below will change.
npx wrangler d1 migrations list doorman-fallacy --remote
npx wrangler d1 migrations apply doorman-fallacy --remote

npx wrangler deploy --dry-run
npx wrangler deploy

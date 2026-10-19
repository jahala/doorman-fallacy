#!/usr/bin/env bash
# One command from checked code to the live site. It stops at the first failing step.
set -euo pipefail

cd "$(dirname "$0")/.."

npm run check
npm run build
npm run test:site

echo
echo "To undo: npx wrangler rollback"
echo

npx wrangler deploy --dry-run
npx wrangler deploy

#!/usr/bin/env bash
# One command from checked code to the live site. It stops at the first failing step.
set -euo pipefail

cd "$(dirname "$0")/.."

# Wrangler's login reaches two accounts. `d1 migrations` ignores account_id in wrangler.jsonc
# (wrangler 4.151) and stops in a non-interactive run, so the id is read from there and exported.
CLOUDFLARE_ACCOUNT_ID="$(sed -nE 's/^[[:space:]]*"account_id":[[:space:]]*"([0-9a-f]+)".*/\1/p' wrangler.jsonc)"
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  echo "release: no account_id in wrangler.jsonc" >&2
  exit 1
fi
export CLOUDFLARE_ACCOUNT_ID

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

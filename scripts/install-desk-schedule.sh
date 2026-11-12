#!/usr/bin/env bash
# Installs the weekly desk run on this Mac. It runs from its own worktree, detached at
# origin/master, so it never touches a checkout someone is working in and the main checkout can
# keep master. Says how to undo before it acts.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
desk="${DESK_WORKTREE:-$(dirname "$repo")/df-desk}"
label="ai.plotplot.doorman-desk"
plist="$HOME/Library/LaunchAgents/$label.plist"

echo "This installs a weekly job (Mondays 07:00) running $desk/desk/weekly.sh."
echo "To undo: launchctl bootout gui/$(id -u)/$label && trash \"$plist\" && git -C \"$repo\" worktree remove \"$desk\""

git -C "$repo" fetch origin
if [ ! -d "$desk" ]; then
  git -C "$repo" worktree add --detach "$desk" origin/master
fi
(cd "$desk" && git checkout --detach origin/master && npm ci)
# The desk remembers which organisations it assessed, so it does not assess them again within 30
# days. A new worktree starts with this checkout's memory.
if [ -f "$repo/.desk-runs/assessed.json" ] && [ ! -f "$desk/.desk-runs/assessed.json" ]; then
  mkdir -p "$desk/.desk-runs"
  cp "$repo/.desk-runs/assessed.json" "$desk/.desk-runs/assessed.json"
fi
sed "s#__DESK__#$desk#" "$repo/desk/launchd/$label.plist" > "$plist"
launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$plist"
echo "Installed. The next run is on Monday at 07:00; the log is $desk/.desk-runs/last-run.log"

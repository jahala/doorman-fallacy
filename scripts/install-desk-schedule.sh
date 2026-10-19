#!/usr/bin/env bash
# Installs the weekly desk run on this Mac. It runs from its own worktree on master, so it never
# touches a checkout someone is working in. Says how to undo before it acts.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
desk="${DESK_WORKTREE:-$(dirname "$repo")/df-desk}"
label="ai.plotplot.doorman-desk"
plist="$HOME/Library/LaunchAgents/$label.plist"

echo "This installs a weekly job (Mondays 07:00) running $desk/desk/weekly.sh."
echo "To undo: launchctl bootout gui/$(id -u)/$label && trash \"$plist\" && git -C \"$repo\" worktree remove \"$desk\""

if [ ! -d "$desk" ]; then
  git -C "$repo" worktree add "$desk" master
fi
(cd "$desk" && git pull --ff-only && npm ci)
sed "s#__DESK__#$desk#" "$repo/desk/launchd/$label.plist" > "$plist"
launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$plist"
echo "Installed. The next run is on Monday at 07:00; the log is $desk/.desk-runs/last-run.log"

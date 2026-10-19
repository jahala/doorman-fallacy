#!/bin/zsh -l
# Runs the weekly desk from the worktree this script sits in. Each run overwrites the last run's
# log, so the log never grows; the run's own report stays in its .desk-runs/ folder.
set -euo pipefail
cd "${0:A:h}/.."
mkdir -p .desk-runs
exec > .desk-runs/last-run.log 2>&1
echo "weekly desk run, $(date -u +%Y-%m-%dT%H:%M:%SZ)"
node desk/weekly.ts --budget 3 --commit

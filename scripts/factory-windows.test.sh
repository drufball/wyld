#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

WAKE_PORT=8788
PLANNER_MODE=host
# shellcheck disable=SC1091
source scripts/factory-windows.sh

expected_names=$'server\nwake\npak\nops\nwebhook\nplanner'
if [[ "$(uname -s)" == Darwin ]]; then
  expected_names+=$'\ncaffeinate'
fi
[[ "$(factory_window_names)" == "$expected_names" ]]

webhook_command="$(factory_window_command webhook)"
[[ "$webhook_command" == *'http://localhost:8788/gh'* ]]
[[ "$webhook_command" == *'$GH_WEBHOOK_SECRET'* ]]

PLANNER_MODE=cli
[[ "$(factory_window_command planner)" == claude\ --dangerously-load-development-channels* ]]

if factory_window_command unknown; then
  echo 'factory_window_command unexpectedly accepted an unknown window' >&2
  exit 1
fi

if grep -q 'pnpm --filter @wyld/server dev' scripts/factory-up.sh scripts/factory-doctor.sh; then
  echo 'server command is duplicated outside factory-windows.sh' >&2
  exit 1
fi

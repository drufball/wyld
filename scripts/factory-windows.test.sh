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
if [[ "$(factory_window_names)" != "$expected_names" ]]; then
  echo 'factory_window_names returned unexpected names' >&2
  exit 1
fi

webhook_command="$(factory_window_command webhook)"
if [[ "$webhook_command" != *'http://localhost:8788/gh'* ]]; then
  echo 'webhook command has the wrong forwarding URL' >&2
  exit 1
fi
if [[ "$webhook_command" != *'$GH_WEBHOOK_SECRET'* ]]; then
  echo 'webhook command does not pass the webhook secret' >&2
  exit 1
fi

PLANNER_MODE=cli
if [[ "$(factory_window_command planner)" != claude\ --dangerously-load-development-channels* ]]; then
  echo 'CLI planner command does not load the Wake channel' >&2
  exit 1
fi

if factory_window_command unknown; then
  echo 'factory_window_command unexpectedly accepted an unknown window' >&2
  exit 1
fi

if grep -q 'pnpm --filter @wyld/server dev' scripts/factory-up.sh scripts/factory-doctor.sh; then
  echo 'server command is duplicated outside factory-windows.sh' >&2
  exit 1
fi

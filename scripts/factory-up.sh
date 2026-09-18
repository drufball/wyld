#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f .factory/env ]]; then
  echo 'error: .factory/env is missing; run ./scripts/bootstrap.sh' >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .factory/env
set +a

PAK_PORT="${PAK_PORT:-8787}"
WAKE_PORT="${WAKE_PORT:-8788}"
PLANNER_MODE="${PLANNER_MODE:-host}"

# shellcheck disable=SC1091
source ./scripts/factory-windows.sh

if [[ "$PLANNER_MODE" != host && "$PLANNER_MODE" != cli ]]; then
  echo "error: PLANNER_MODE must be either 'host' or 'cli'" >&2
  exit 1
fi

started=()
skipped=()

if ./scripts/ntfy-up.sh; then
  echo 'ntfy container is running.'
else
  echo 'warning: ntfy failed to start; continuing without push notifications.' >&2
  skipped+=('ntfy (container failed to start)')
fi

if ! command -v tmux >/dev/null 2>&1; then
  echo 'error: tmux is not installed' >&2
  exit 1
fi

if tmux has-session -t wyld 2>/dev/null; then
  echo 'The tmux session wyld is already running; no second session was started.'
  echo 'tmux attach -t wyld'
  if [[ -t 1 ]]; then
    exec tmux attach -t wyld
  fi
  exit 0
fi

tmux new-session -d -s wyld -n server -c "$PWD" "$(factory_window_command server)"
started+=(server)
tmux new-window -d -t wyld -n wake -c "$PWD" "$(factory_window_command wake)"
started+=(wake)

tmux new-window -d -t wyld -n pak -c "$PWD" "$(factory_window_command pak)"
started+=(pak)

tmux new-window -d -t wyld -n ops -c "$PWD" "$(factory_window_command ops)"
started+=(ops)

tmux new-window -d -t wyld -n webhook -c "$PWD" "$(factory_window_command webhook)"
started+=(webhook)

if [[ "$PLANNER_MODE" == host ]]; then
  if factory_window_prepare planner; then
    tmux new-window -d -t wyld -n planner -c "$PWD" "$(factory_window_command planner)"
    started+=(planner)
  else
    echo 'Skipping planner: @wyld/wake or @wyld/planner-host failed to build.' >&2
    skipped+=('planner (@wyld/wake or @wyld/planner-host build failed)')
  fi
else
  if factory_window_prepare planner; then
    tmux new-window -d -t wyld -n planner -c "$PWD" "$(factory_window_command planner)"
    started+=(planner)
  else
    echo 'Skipping planner: @wyld/wake failed to build, so its channel cannot register.' >&2
    skipped+=('planner (@wyld/wake build failed)')
  fi
fi

if [[ "$(uname -s)" == Darwin ]]; then
  tmux new-window -d -t wyld -n caffeinate -c "$PWD" "$(factory_window_command caffeinate)"
  started+=(caffeinate)
else
  echo 'Skipping caffeinate: it is only used on macOS.'
  skipped+=('caffeinate (not macOS)')
fi

echo 'Factory session: wyld'
printf 'Planner mode: %s\n' "$PLANNER_MODE"
printf 'Windows started: %s\n' "${started[*]}"
if ((${#skipped[@]})); then
  printf 'Windows skipped: %s\n' "${skipped[*]}"
else
  echo 'Windows skipped: none'
fi
echo 'tmux attach -t wyld'

if command -v tailscale >/dev/null 2>&1; then
  serve_status="$(tailscale serve status 2>/dev/null || true)"
  serve_pak_host="$(printf '%s\n' "$serve_status" | awk -v port="$PAK_PORT" '
    /^https:\/\/[^ ]+ \(tailnet only\)$/ {
      hostport = substr($1, index($1, "://") + 3)
      is443 = (index(hostport, ":") == 0)
      host = hostport
      sub(/:.*$/, "", host)
      next
    }
    is443 && $0 ~ ("proxy[ \t]+http://127\\.0\\.0\\.1:" port "([ \t]|$)") { print host; exit }
  ')"
  if [[ -n "$serve_pak_host" ]]; then
    printf 'Pak: https://%s/\n' "$serve_pak_host"
  fi
fi

if [[ -t 1 ]]; then
  exec tmux attach -t wyld
fi

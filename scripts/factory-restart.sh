#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck disable=SC1091
source ./scripts/factory-windows.sh

valid_names="$(factory_window_names | paste -sd ' ' -)"
usage() {
  printf 'Usage: scripts/factory-restart.sh <window> [--dry-run]\n'
  printf '       scripts/factory-restart.sh --help\n'
  printf 'Valid windows: %s\n' "$valid_names"
}

window=''
dry_run=false
for argument in "$@"; do
  case "$argument" in
    -h | --help)
      usage
      exit 0
      ;;
    -n | --dry-run) dry_run=true ;;
    -*)
      echo "error: unknown flag: $argument" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [[ -n "$window" ]]; then
        echo 'error: more than one window name was provided' >&2
        usage >&2
        exit 2
      fi
      window="$argument"
      ;;
  esac
done

if [[ -z "$window" ]]; then
  echo 'error: a window name is required' >&2
  usage >&2
  exit 2
fi

window_names="$(factory_window_names)"
if ! grep -Fxq "$window" <<<"$window_names"; then
  echo "error: unknown window '$window'; valid windows: $valid_names" >&2
  exit 2
fi

if [[ -f .factory/env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .factory/env
  set +a
elif [[ "$dry_run" == true ]]; then
  echo 'note: .factory/env is missing; using defaults' >&2
else
  echo 'error: .factory/env is missing; run ./scripts/bootstrap.sh' >&2
  exit 1
fi

WAKE_PORT="${WAKE_PORT:-8788}"
PLANNER_MODE="${PLANNER_MODE:-host}"
if [[ "$PLANNER_MODE" != host && "$PLANNER_MODE" != cli ]]; then
  echo "error: PLANNER_MODE must be either 'host' or 'cli'" >&2
  exit 1
fi

if [[ "$window" == planner ]]; then
  echo 'warning: planner hosts Wake as well; restarting it takes down the MCP server the Planner and its leads use. No leads may be running, and the Planner host normally restarts this window itself.' >&2
fi

command="$(factory_window_command "$window")"
if [[ "$dry_run" == true ]]; then
  factory_window_prepare "$window" --dry-run
  printf 'Would run: tmux respawn-window -k -t "wyld:%s" -c "%s" "%s"\n' "$window" "$PWD" "$command"
  exit 0
fi

if ! command -v tmux >/dev/null 2>&1; then
  echo 'error: tmux is not installed' >&2
  exit 1
fi
if ! tmux has-session -t wyld 2>/dev/null; then
  echo 'error: tmux session wyld is not running; run pnpm factory:up' >&2
  exit 1
fi
running_window_names="$(tmux list-windows -t wyld -F '#{window_name}')"
if ! grep -Fxq "$window" <<<"$running_window_names"; then
  echo "error: window '$window' is not running in session wyld; run pnpm factory:doctor" >&2
  exit 1
fi

if ! factory_window_prepare "$window"; then
  echo "error: preparation failed; window '$window' was left running untouched" >&2
  exit 1
fi

tmux respawn-window -k -t "wyld:$window" -c "$PWD" "$command"
printf 'Respawned window %s with command: %s\n' "$window" "$command"

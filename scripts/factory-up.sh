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

WAKE_PORT="${WAKE_PORT:-8788}"

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

started=()
skipped=()

tmux new-session -d -s wyld -n server -c "$PWD" 'pnpm --filter @wyld/server dev'
started+=(server)
tmux new-window -d -t wyld -n wake -c "$PWD" 'pnpm --filter @wyld/wake dev'
started+=(wake)

if [[ -d factory/pak ]]; then
  tmux new-window -d -t wyld -n pak -c "$PWD" 'pnpm --filter @wyld/pak dev'
  started+=(pak)
else
  echo 'Skipping pak: factory/pak does not exist yet.'
  skipped+=('pak (factory/pak does not exist)')
fi

tmux new-window -d -t wyld -n ops -c "$PWD" 'pnpm --filter @wyld/ops dev'
started+=(ops)

tmux new-window -d -t wyld -n webhook -c "$PWD" \
  "until gh webhook forward --repo drufball/wyld --events '*' --url 'http://localhost:${WAKE_PORT}/gh' --secret \"\$GH_WEBHOOK_SECRET\"; do echo 'webhook forward exited; restarting in 5s'; sleep 5; done"
started+=(webhook)

if pnpm --filter @wyld/wake... build; then
  tmux new-window -d -t wyld -n planner -c "$PWD" \
    'claude --dangerously-load-development-channels server:wake'
  started+=(planner)
else
  echo 'Skipping planner: @wyld/wake failed to build, so its channel cannot register.' >&2
  skipped+=('planner (@wyld/wake build failed)')
fi

if [[ "$(uname -s)" == Darwin ]]; then
  tmux new-window -d -t wyld -n caffeinate -c "$PWD" 'caffeinate -s'
  started+=(caffeinate)
else
  echo 'Skipping caffeinate: it is only used on macOS.'
  skipped+=('caffeinate (not macOS)')
fi

echo 'Factory session: wyld'
printf 'Windows started: %s\n' "${started[*]}"
if ((${#skipped[@]})); then
  printf 'Windows skipped: %s\n' "${skipped[*]}"
else
  echo 'Windows skipped: none'
fi
echo 'tmux attach -t wyld'

if [[ -t 1 ]]; then
  exec tmux attach -t wyld
fi

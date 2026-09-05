#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v tmux >/dev/null 2>&1; then
  echo 'Nothing stopped: tmux is not installed, so the wyld session is not running.'
  exit 0
fi

if tmux has-session -t wyld 2>/dev/null; then
  tmux kill-session -t wyld
  echo 'Stopped tmux session wyld and all of its windows.'
else
  echo 'Nothing stopped: tmux session wyld is not running.'
fi

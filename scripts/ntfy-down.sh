#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v docker >/dev/null 2>&1; then
  export PATH="$HOME/.rd/bin:$PATH"
fi
if ! command -v docker >/dev/null 2>&1; then
  echo 'Nothing stopped: docker is unavailable.'
  exit 0
fi

if docker container inspect wyld-ntfy >/dev/null 2>&1; then
  docker rm -f wyld-ntfy >/dev/null
  echo 'Stopped and removed container wyld-ntfy.'
else
  echo 'Nothing stopped: container wyld-ntfy does not exist.'
fi

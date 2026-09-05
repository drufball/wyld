#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! corepack enable; then
  echo 'warning: corepack enable failed; continuing only if the pinned pnpm is already available' >&2
fi

pnpm install --frozen-lockfile
mkdir -p .factory/{logs,demos,worktrees}

if [[ -f .factory/env ]]; then
  echo 'Leaving existing .factory/env unchanged'
else
  if command -v openssl >/dev/null 2>&1; then
    wake_secret="$(openssl rand -hex 32)"
    webhook_secret="$(openssl rand -hex 32)"
  else
    wake_secret="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
    webhook_secret="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  fi
  sed -e "0,/replace-me/s//${wake_secret}/" -e "0,/replace-me/s//${webhook_secret}/" \
    factory/env.example >.factory/env
  chmod 600 .factory/env
  echo 'Created .factory/env'
fi

node_version="$(node --version)"
node_major="${node_version#v}"
node_major="${node_major%%.*}"

echo 'WYLD environment status'
if [[ "$node_major" == '22' ]]; then
  echo "  node: $node_version"
else
  echo "  node: $node_version (warning: Node 22 is required)"
fi
echo "  pnpm: $(pnpm --version)"
echo "  .factory: $([[ -d .factory ]] && echo present || echo missing)"
echo "  .factory/env: $([[ -f .factory/env ]] && echo present || echo missing)"

if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    echo '  gh: installed and authenticated'
  else
    echo '  gh: installed but not authenticated'
  fi
else
  echo '  gh: not installed'
fi

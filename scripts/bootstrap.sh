#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! corepack enable; then
  echo 'warning: corepack enable failed; continuing only if the pinned pnpm is already available' >&2
fi

pnpm install --frozen-lockfile
pnpm build
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
  {
    sed '/^WAKE_SECRET=/d; /^GH_WEBHOOK_SECRET=/d' factory/env.example
    echo "WAKE_SECRET=${wake_secret}"
    echo "GH_WEBHOOK_SECRET=${webhook_secret}"
  } >.factory/env
  chmod 600 .factory/env

  generated_wake_secret="$(sed -n 's/^WAKE_SECRET=//p' .factory/env | tail -n 1)"
  generated_webhook_secret="$(sed -n 's/^GH_WEBHOOK_SECRET=//p' .factory/env | tail -n 1)"
  if [[ -z "$generated_wake_secret" || "$generated_wake_secret" == replace-me || \
    -z "$generated_webhook_secret" || "$generated_webhook_secret" == replace-me ]]; then
    echo 'error: failed to generate secrets in .factory/env' >&2
    exit 1
  fi

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

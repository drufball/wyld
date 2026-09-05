#!/usr/bin/env bash
set -euo pipefail

if ! corepack enable; then
  echo 'warning: corepack enable failed; continuing only if the pinned pnpm is already available' >&2
fi

pnpm install --frozen-lockfile
mkdir -p .factory/{logs,demos,worktrees}

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

if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    echo '  gh: installed and authenticated'
  else
    echo '  gh: installed but not authenticated'
  fi
else
  echo '  gh: not installed'
fi

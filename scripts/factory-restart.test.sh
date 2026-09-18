#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo 'no argument'
if ./scripts/factory-restart.sh >"$tmp_dir/out" 2>"$tmp_dir/err"; then exit 1; fi
grep -q 'Valid windows:.*server.*planner' "$tmp_dir/err"

echo 'unknown window'
if ./scripts/factory-restart.sh nope >"$tmp_dir/out" 2>"$tmp_dir/err"; then exit 1; fi
grep -q 'nope' "$tmp_dir/err"

echo '--help'
./scripts/factory-restart.sh --help >"$tmp_dir/out"
for name in server wake pak ops webhook planner; do grep -q "$name" "$tmp_dir/out"; done

echo 'platform-specific names'
if [[ "$(uname -s)" == Darwin ]]; then
  ./scripts/factory-restart.sh caffeinate --dry-run >/dev/null
elif ./scripts/factory-restart.sh caffeinate --dry-run >/dev/null 2>&1; then
  echo 'caffeinate unexpectedly accepted off macOS' >&2
  exit 1
fi

echo 'ops --dry-run'
./scripts/factory-restart.sh ops --dry-run >"$tmp_dir/out" 2>"$tmp_dir/err"
grep -q 'pnpm --filter @wyld/ops dev' "$tmp_dir/out"
grep -q 'respawn-window' "$tmp_dir/out"
grep -q 'wyld:ops' "$tmp_dir/out"

echo 'repeated dry runs accept a valid window'
for _ in {1..50}; do
  ./scripts/factory-restart.sh ops --dry-run >/dev/null 2>&1
done

echo 'webhook --dry-run'
./scripts/factory-restart.sh webhook --dry-run >"$tmp_dir/out" 2>"$tmp_dir/err"
grep -q 'gh webhook forward' "$tmp_dir/out"
grep -q '/gh' "$tmp_dir/out"

echo 'planner --dry-run'
./scripts/factory-restart.sh planner --dry-run >"$tmp_dir/out" 2>"$tmp_dir/err"
grep -q 'Wake' "$tmp_dir/err"
grep -qi 'leads.*running' "$tmp_dir/err"
grep -q '@wyld/planner-host... build' "$tmp_dir/out"

echo '--dry-run never executes tmux'
mkdir "$tmp_dir/bin"
cat >"$tmp_dir/bin/tmux" <<EOF
#!/usr/bin/env bash
touch "$tmp_dir/tmux-ran"
exit 1
EOF
chmod +x "$tmp_dir/bin/tmux"
PATH="$tmp_dir/bin:$PATH" ./scripts/factory-restart.sh ops --dry-run >/dev/null 2>&1
if [[ -e "$tmp_dir/tmux-ran" ]]; then
  echo 'dry run executed tmux' >&2
  exit 1
fi

echo 'no duplicated window commands'
if grep -q 'pnpm --filter @wyld/ops dev' scripts/factory-restart.sh; then
  echo 'ops command is duplicated outside factory-windows.sh' >&2
  exit 1
fi

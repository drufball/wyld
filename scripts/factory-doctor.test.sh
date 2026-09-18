#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
mkdir -p "$tmp_dir/bin" "$tmp_dir/factory"

echo 'tmux window membership survives an early-closing-reader workload'
cat >"$tmp_dir/bin/tmux" <<'EOF'
#!/usr/bin/env bash
case "$1" in
  has-session) exit 0 ;;
  list-windows)
    printf '%s\n' server wake pak ops webhook planner
    awk 'BEGIN { line = sprintf("%0100d", 0); for (i = 1; i <= 2000; i++) print "filler-" i line }'
    ;;
  list-panes) printf 'wyld:server 0\n' ;;
esac
EOF
chmod +x "$tmp_dir/bin/tmux"
cat >"$tmp_dir/bin/curl" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
chmod +x "$tmp_dir/bin/curl"
cat >"$tmp_dir/bin/node" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == --version ]]; then printf 'v22.0.0\n'; else exit 1; fi
EOF
chmod +x "$tmp_dir/bin/node"
cat >"$tmp_dir/bin/gh" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
cat >"$tmp_dir/bin/tailscale" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
chmod +x "$tmp_dir/bin/gh" "$tmp_dir/bin/tailscale"

PATH="$tmp_dir/bin:$PATH" FACTORY_DIR="$tmp_dir/factory" \
  ./scripts/factory-doctor.sh >"$tmp_dir/out" 2>"$tmp_dir/err" || true
if grep -Fq 'tmux window server is missing' "$tmp_dir/out"; then
  echo 'doctor reported a listed tmux window missing' >&2
  cat "$tmp_dir/out" >&2
  exit 1
fi
grep -Fq 'ok: tmux window server is alive' "$tmp_dir/out"

for _ in {1..50}; do
  running_window_names="$(PATH="$tmp_dir/bin:$PATH" tmux list-windows -t wyld -F '#{window_name}')"
  grep -Fxq server <<<"$running_window_names"
done

echo 'doctor captures the tmux window list once before membership checks'
if ! grep -Fq 'running_window_names="$(tmux list-windows' scripts/factory-doctor.sh \
  || ! grep -Fq 'grep -Fxq "$window_name" <<<"$running_window_names"' scripts/factory-doctor.sh; then
  echo 'doctor does not use the captured tmux window list for membership checks' >&2
  exit 1
fi

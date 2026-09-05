#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ok_count=0
warn_count=0
fail_count=0

ok() { echo "ok: $*"; ok_count=$((ok_count + 1)); }
warn() { echo "warn: $*"; warn_count=$((warn_count + 1)); }
fail() { echo "fail: $*"; fail_count=$((fail_count + 1)); }

if [[ -f .factory/env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .factory/env
  set +a
fi
PAK_PORT="${PAK_PORT:-8787}"
WAKE_PORT="${WAKE_PORT:-8788}"

for tool in tmux gh claude node pnpm; do
  if command -v "$tool" >/dev/null 2>&1; then
    ok "$tool is installed"
  else
    fail "$tool is not installed; install $tool and run pnpm factory:doctor"
  fi
done

if command -v gh >/dev/null 2>&1 && gh extension list 2>/dev/null | grep -Eq '(^|[[:space:]])cli/gh-webhook([[:space:]]|$)'; then
  ok 'gh webhook extension is installed'
else
  fail 'gh webhook extension is not installed; run `gh extension install cli/gh-webhook`'
fi

if command -v node >/dev/null 2>&1; then
  node_version="$(node --version)"
  node_major="${node_version#v}"
  node_major="${node_major%%.*}"
  if [[ "$node_major" == 22 ]]; then
    ok "Node version is $node_version"
  else
    fail "Node version is $node_version, but Node 22 is required; install Node 22 and run pnpm factory:doctor"
  fi
fi

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  ok 'GitHub CLI authentication is valid'
else
  fail 'GitHub CLI authentication is unavailable; run `gh auth login`'
fi

if [[ ! -f .factory/env ]]; then
  fail '.factory/env is missing; run ./scripts/bootstrap.sh'
else
  if [[ "$(uname -s)" == Darwin ]]; then
    env_mode="$(stat -f '%Lp' .factory/env 2>/dev/null || echo unknown)"
  else
    env_mode="$(stat -c '%a' .factory/env 2>/dev/null || echo unknown)"
  fi
  if [[ "$env_mode" == 600 ]]; then
    ok '.factory/env has mode 600'
  else
    fail ".factory/env has mode $env_mode, not 600; run \`chmod 600 .factory/env\`"
  fi
  for key in WAKE_SECRET GH_WEBHOOK_SECRET; do
    value="$(sed -n "s/^${key}=//p" .factory/env | tail -n 1)"
    if [[ -n "$value" && "$value" != replace-me ]]; then
      ok "$key is set"
    else
      fail "$key is unset or still a placeholder; run ./scripts/bootstrap.sh"
    fi
  done
fi

for port in "$PAK_PORT" "$WAKE_PORT"; do
  if command -v lsof >/dev/null 2>&1; then
    listeners="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $1 "(pid " $2 ")"}' | sort -u | paste -sd, - || true)"
    if [[ -n "$listeners" ]]; then
      ok "port $port is listening: $listeners"
    else
      ok "port $port is free"
    fi
  else
    warn "port $port ownership cannot be checked because lsof is unavailable"
  fi
done

check_health() {
  local name="$1" url="$2" detail="$3" output
  if ! command -v node >/dev/null 2>&1; then
    fail "$name health cannot be checked without node; install Node 22 and run pnpm factory:doctor"
    return
  fi
  if output="$(node -e '
    const [url, detail] = process.argv.slice(1);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      const body = await response.json();
      if (!response.ok || body.ok !== true) process.exit(1);
      if (detail === "wake") process.stdout.write(`queueDepth=${body.queueDepth} lastDeliveryAt=${body.lastDeliveryAt ?? "never"}`);
      else process.stdout.write("healthy");
    } catch { process.exit(1); }
  ' "$url" "$detail" 2>/dev/null)"; then
    ok "$name health is $output"
  else
    fail "$name health check failed at $url; run pnpm factory:up"
  fi
}

check_health 'Pak server' "http://localhost:${PAK_PORT}/api/health" pak
check_health 'Wake' "http://localhost:${WAKE_PORT}/health" wake

if command -v tmux >/dev/null 2>&1 && tmux has-session -t wyld 2>/dev/null; then
  windows="$(tmux list-windows -t wyld -F '#{window_name}' | paste -sd, -)"
  dead="$(tmux list-panes -t wyld -a -F '#{session_name}:#{window_name} #{pane_dead}' | awk '$1 ~ /^wyld:/ && $2 == 1 {sub(/^wyld:/, "", $1); print $1}' | paste -sd, -)"
  if [[ -n "$dead" ]]; then
    fail "tmux session wyld has exited windows ($dead); run pnpm factory:down && pnpm factory:up"
  else
    ok "tmux session wyld is running with windows: $windows"
  fi
  webhook_dead="$(tmux list-panes -t wyld:webhook -F '#{pane_dead}' 2>/dev/null || true)"
  if [[ -n "$webhook_dead" && "$webhook_dead" != *1* ]]; then
    ok 'webhook window is alive'
  else
    fail 'webhook window is missing or exited; run pnpm factory:up'
  fi
else
  fail 'tmux session wyld is not running; run pnpm factory:up'
  fail 'webhook window is not running; run pnpm factory:up'
fi

if [[ "$(uname -s)" == Darwin ]]; then
  if pmset -g batt 2>/dev/null | grep -q "AC Power"; then
    ok 'macOS host is on AC power'
  else
    warn 'macOS host is not on AC power; connect it to AC power'
  fi
else
  ok 'AC power check is not applicable outside macOS'
fi

echo "Summary: $ok_count ok, $warn_count warn, $fail_count fail"
((fail_count == 0))

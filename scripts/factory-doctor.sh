#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FACTORY_DIR="${FACTORY_DIR:-$PWD/.factory}"

ok_count=0
warn_count=0
fail_count=0

ok() { echo "ok: $*"; ok_count=$((ok_count + 1)); }
warn() { echo "warn: $*"; warn_count=$((warn_count + 1)); }
fail() { echo "fail: $*"; fail_count=$((fail_count + 1)); }

if [[ -f "$FACTORY_DIR/env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$FACTORY_DIR/env"
  set +a
fi
PAK_PORT="${PAK_PORT:-8787}"
WAKE_PORT="${WAKE_PORT:-8788}"
PLANNER_HOST_PORT="${PLANNER_HOST_PORT:-8789}"
NTFY_PORT="${NTFY_PORT:-8790}"
PLANNER_MODE="${PLANNER_MODE:-host}"

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

if [[ ! -f "$FACTORY_DIR/env" ]]; then
  fail '.factory/env is missing; run ./scripts/bootstrap.sh'
else
  if [[ "$(uname -s)" == Darwin ]]; then
    env_mode="$(stat -f '%Lp' "$FACTORY_DIR/env" 2>/dev/null || echo unknown)"
  else
    env_mode="$(stat -c '%a' "$FACTORY_DIR/env" 2>/dev/null || echo unknown)"
  fi
  if [[ "$env_mode" == 600 ]]; then
    ok '.factory/env has mode 600'
  else
    fail ".factory/env has mode $env_mode, not 600; run \`chmod 600 .factory/env\`"
  fi
  for key in WAKE_SECRET GH_WEBHOOK_SECRET; do
    value="$(sed -n "s/^${key}=//p" "$FACTORY_DIR/env" | tail -n 1)"
    if [[ -n "$value" && "$value" != replace-me ]]; then
      ok "$key is set"
    else
      fail "$key is unset or still a placeholder; run ./scripts/bootstrap.sh"
    fi
  done
  if [[ -n "$(sed -n 's/^NTFY_URL=//p' "$FACTORY_DIR/env" | tail -n 1)" ]]; then
    ok 'push notifications are configured'
  else
    warn 'NTFY_URL is unset; push notifications are disabled'
  fi
fi

if [[ -f "$FACTORY_DIR/pak.sqlite" ]]; then
  ok '.factory/pak.sqlite is present'
else
  fail '.factory/pak.sqlite is missing; this looks like a fresh machine — restore it with ./scripts/factory-import.sh <bundle.tgz> (see NEW-MACHINE.md)'
fi

public_host="${PAK_PUBLIC_URL:-}"
public_host="${public_host#*://}"
public_host="${public_host%%/*}"
public_host="${public_host%%:*}"
machine_tailnet=''
if command -v tailscale >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
  machine_tailnet="$(tailscale status --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write((JSON.parse(s).Self.DNSName||"").replace(/\.$/,""))}catch{process.exit(1)}})' 2>/dev/null || true)"
fi
if [[ "$public_host" == *.ts.net ]]; then
  if command -v tailscale >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
    if [[ -n "$machine_tailnet" && "$public_host" == "$machine_tailnet" ]]; then
      ok "PAK_PUBLIC_URL tailnet hostname matches this machine ($machine_tailnet)"
    elif [[ -n "$machine_tailnet" ]]; then
      warn "PAK_PUBLIC_URL names $public_host but this machine is $machine_tailnet; edit .factory/env"
    else
      warn 'PAK_PUBLIC_URL tailnet hostname could not be checked with tailscale status --json'
    fi
  else
    warn 'PAK_PUBLIC_URL tailnet hostname could not be checked because tailscale or node is unavailable'
  fi
fi

if [[ ! -f "$FACTORY_DIR/ntfy/server.yml" ]]; then
  warn 'ntfy config has not been rendered yet; the next `pnpm factory:up` will render it'
elif [[ -z "$machine_tailnet" ]]; then
  warn "ntfy config tailnet hostname could not be checked because this machine's tailnet name could not be determined with tailscale status --json"
else
  ntfy_base_url="$(sed -n "s/^[[:space:]]*base-url:[[:space:]]*['\"]\{0,1\}\([^'\"]*\)['\"]\{0,1\}[[:space:]]*$/\1/p" "$FACTORY_DIR/ntfy/server.yml" | head -n 1)"
  ntfy_host="${ntfy_base_url#*://}"
  ntfy_host="${ntfy_host%%/*}"
  ntfy_host="${ntfy_host%%:*}"
  if [[ "$ntfy_host" == "$machine_tailnet" ]]; then
    ok "ntfy config tailnet hostname matches this machine ($machine_tailnet)"
  else
    warn "ntfy config names ${ntfy_host:-an unreadable host} but this machine is $machine_tailnet; set NTFY_BASE_URL in .factory/env (or clear it) and run pnpm factory:up"
  fi
fi

for port in "$PAK_PORT" "$WAKE_PORT" "$PLANNER_HOST_PORT" "$NTFY_PORT"; do
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

health_output() {
  local url="$1" detail="$2" field="${3:-ok}"
  node -e '
    const [url, detail, field] = process.argv.slice(1);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      const body = await response.json();
      if (!response.ok || body[field] !== true) process.exit(1);
      if (detail === "wake") process.stdout.write(`queueDepth=${body.queueDepth} lastDeliveryAt=${body.lastDeliveryAt ?? "never"}`);
      else if (detail === "planner") process.stdout.write(`sessionId=${body.sessionId ?? "none"} restarts=${body.restarts}`);
      else process.stdout.write("healthy");
    } catch { process.exit(1); }
  ' "$url" "$detail" "$field" 2>/dev/null
}

check_health() {
  local name="$1" url="$2" detail="$3" field="${4:-ok}" output
  if ! command -v node >/dev/null 2>&1; then
    fail "$name health cannot be checked without node; install Node 22 and run pnpm factory:doctor"
    return
  fi
  if output="$(health_output "$url" "$detail" "$field")"; then
    ok "$name health is $output"
  else
    fail "$name health check failed at $url; run pnpm factory:up"
  fi
}

check_health 'Pak server' "http://localhost:${PAK_PORT}/api/health" pak
check_health 'Wake' "http://localhost:${WAKE_PORT}/health" wake

host_running=false
planner_detail=''
if command -v node >/dev/null 2>&1; then
  if planner_detail="$(health_output "http://127.0.0.1:${PLANNER_HOST_PORT}/health" planner)"; then
    host_running=true
  fi
fi

cli_running=false
if command -v tmux >/dev/null 2>&1; then
  # claude rewrites its process title to its version, so the launch flags are not in any command line.
  if tmux has-session -t wyld 2>/dev/null \
    && tmux list-panes -t wyld:planner -F '#{pane_dead} #{pane_start_command}' 2>/dev/null \
      | awk '$1 == 0' \
      | grep -q 'dangerously-load-development-channels'; then
    cli_running=true
  fi
else
  warn 'CLI Planner session cannot be checked because tmux is unavailable'
fi

if [[ "$host_running" == true && "$cli_running" == false ]]; then
  ok "Planner is running as the host ($planner_detail)"
elif [[ "$host_running" == false && "$cli_running" == true ]]; then
  ok 'Planner is running as the CLI session (PLANNER_MODE=cli fallback)'
elif [[ "$host_running" == true && "$cli_running" == true ]]; then
  fail 'two Planners are running (host and CLI); they will both claim from the Wake queue and split events between them — stop one'
else
  fail 'no Planner is running; run pnpm factory:up'
fi

if ! command -v docker >/dev/null 2>&1; then
  export PATH="$HOME/.rd/bin:$PATH"
fi
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  ok 'the container runtime is answering'
  ntfy_image="$(docker ps --filter name=wyld-ntfy --filter status=running --format '{{.Image}}')"
  if [[ "$ntfy_image" == 'binwiederhier/ntfy:v2.28.0' ]]; then
    ok 'wyld-ntfy is running with binwiederhier/ntfy:v2.28.0'
  else
    fail 'wyld-ntfy is not running with binwiederhier/ntfy:v2.28.0; run ./scripts/ntfy-up.sh'
  fi
else
  fail 'the container runtime is not answering; start your Docker runtime (see NEW-MACHINE.md)'
fi
check_health 'ntfy' "http://localhost:${NTFY_PORT}/v1/health" ntfy healthy

serve_status=''
serve_pak_host=''
if ! command -v tailscale >/dev/null 2>&1; then
  warn 'Tailscale Serve cannot be checked because tailscale is unavailable'
else
  serve_status="$(tailscale serve status 2>/dev/null || true)"
  serve_pak_host="$(printf '%s\n' "$serve_status" | awk -v port="$PAK_PORT" '
    /^https:\/\/[^ ]+ \(tailnet only\)$/ {
      hostport = substr($1, index($1, "://") + 3)
      is443 = (index(hostport, ":") == 0)
      host = hostport
      sub(/:.*$/, "", host)
      next
    }
    is443 && $0 ~ ("proxy[ \t]+http://127\\.0\\.0\\.1:" port "([ \t]|$)") { print host; exit }
  ')"
  if [[ -n "$serve_pak_host" ]]; then
    ok "Tailscale Serve proxies the Pak on 443 -> 127.0.0.1:$PAK_PORT ($serve_pak_host)"
  else
    fail "Tailscale Serve is not proxying the Pak on 443; run \`tailscale serve --bg --https=443 $PAK_PORT\`"
  fi
  if [[ -n "$serve_pak_host" && -n "$public_host" && "$serve_pak_host" != "$public_host" ]]; then
    warn "PAK_PUBLIC_URL names $public_host but Tailscale Serve publishes the Pak as $serve_pak_host; edit .factory/env"
  fi
  if printf '%s\n' "$serve_status" | grep -Eq '(^|[^0-9])8443([^0-9]|$)'; then
    ok 'Tailscale Serve is configured on port 8443'
  else
    fail 'Tailscale Serve is not configured on port 8443; run `tailscale serve --bg --https=8443 8790`'
  fi
fi

if command -v tmux >/dev/null 2>&1 && tmux has-session -t wyld 2>/dev/null; then
  expected_windows=(
    "server|'pnpm --filter @wyld/server dev'"
    "wake|'pnpm --filter @wyld/wake dev'"
    "ops|'pnpm --filter @wyld/ops dev'"
    "webhook|\"until gh webhook forward --repo drufball/wyld --events '*' --url 'http://localhost:${WAKE_PORT}/gh' --secret \\\"\\\$GH_WEBHOOK_SECRET\\\"; do echo 'webhook forward exited; restarting in 5s'; sleep 5; done\""
  )
  if [[ "$PLANNER_MODE" == host ]]; then
    expected_windows+=("planner|\"set -a; . .factory/env; set +a; until node factory/planner-host/dist/main.js; do echo 'planner host exited; restarting in 5s'; sleep 5; done\"")
  else
    expected_windows+=("planner|'claude --dangerously-load-development-channels server:wake'")
  fi
  if [[ -d factory/pak ]]; then
    expected_windows+=("pak|'pnpm --filter @wyld/pak dev'")
  fi
  if [[ "$(uname -s)" == Darwin ]]; then
    expected_windows+=("caffeinate|'caffeinate -s'")
  fi

  windows="$(tmux list-windows -t wyld -F '#{window_name}' | paste -sd, -)"
  dead="$(tmux list-panes -t wyld -a -F '#{session_name}:#{window_name} #{pane_dead}' | awk '$1 ~ /^wyld:/ && $2 == 1 {sub(/^wyld:/, "", $1); print $1}' | paste -sd, -)"
  ok "tmux session wyld is running with windows: $windows"
  if [[ -n "$dead" ]]; then
    fail "tmux session wyld has exited windows ($dead); run pnpm factory:down && pnpm factory:up"
  fi
  for window_spec in "${expected_windows[@]}"; do
    window_name="${window_spec%%|*}"
    window_command="${window_spec#*|}"
    if ! tmux list-windows -t wyld -F '#{window_name}' | grep -Fxq "$window_name"; then
      fail "tmux window $window_name is missing; run \`set -a; . .factory/env; set +a; tmux new-window -d -t wyld -n $window_name -c \"\$PWD\" $window_command\`"
      continue
    fi

    if [[ ",$dead," != *",$window_name,"* ]]; then
      ok "tmux window $window_name is alive"
    fi
  done
else
  fail 'tmux session wyld is not running; run pnpm factory:up'
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

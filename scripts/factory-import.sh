#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FACTORY_DIR="${FACTORY_DIR:-$PWD/.factory}"

usage() { echo 'usage: ./scripts/factory-import.sh <in.tgz> [--force] [--no-bootstrap]' >&2; }
[[ $# -ge 1 ]] || { usage; exit 1; }
bundle="$1"; shift
force=false
bootstrap=true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) force=true ;;
    --no-bootstrap) bootstrap=false ;;
    *) echo "fail: unknown option: $1" >&2; usage; exit 1 ;;
  esac
  shift
done
if [[ ! -f "$bundle" ]]; then echo "fail: bundle does not exist: $bundle" >&2; exit 1; fi
if [[ ! -r "$bundle" ]] || ! tar -tzf "$bundle" >/dev/null 2>&1; then
  echo "fail: $bundle is not a readable gzip tar or WYLD export bundle" >&2; exit 1
fi
manifest_tmp="$(mktemp "${TMPDIR:-/tmp}/wyld-export-manifest.XXXXXX")"
trap 'rm -f "$manifest_tmp"' EXIT
if ! tar -xOzf "$bundle" ./export-manifest.json >"$manifest_tmp" 2>/dev/null; then
  echo "fail: $bundle is not a WYLD export bundle (export-manifest.json is missing)" >&2; exit 1
fi
if ! manifest_summary="$(node - "$manifest_tmp" <<'NODE'
import fs from 'node:fs';
try {
  const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (value.kind !== 'wyld-factory-export') process.exit(1);
  const field = (key) => value[key] ?? 'unknown';
  console.log(`ok: bundle created ${field('createdAt')} on ${field('hostname')} (tailnet ${field('tailnetName')})`);
} catch { process.exit(1); }
NODE
)"; then
  echo "fail: $bundle is not a WYLD export bundle (invalid manifest kind)" >&2; exit 1
fi
printf '%s\n' "$manifest_summary"

mkdir -p "$FACTORY_DIR"
if [[ -f "$FACTORY_DIR/pak.sqlite" && "$force" != true ]]; then
  echo "fail: $FACTORY_DIR/pak.sqlite already exists; rerun with --force to preserve and replace existing state" >&2
  exit 1
fi
if [[ "$force" == true ]]; then
  backup_dir="$FACTORY_DIR/pre-import-$(date +%Y%m%d-%H%M%S)"
  moved=false
  for path in "$FACTORY_DIR"/pak.sqlite* "$FACTORY_DIR"/wake.sqlite* "$FACTORY_DIR"/env; do
    [[ -e "$path" ]] || continue
    [[ "$moved" == true ]] || mkdir -p "$backup_dir"
    moved=true
    mv "$path" "$backup_dir/"
  done
  [[ "$moved" == false ]] || echo "warn: existing factory files moved to $backup_dir"
fi

tar -xzf "$bundle" -C "$FACTORY_DIR"
if [[ ! -f "$FACTORY_DIR/env" ]]; then echo 'fail: imported bundle has no env file' >&2; exit 1; fi
chmod 600 "$FACTORY_DIR/env"
if [[ "$(uname -s)" == Darwin ]]; then env_mode="$(stat -f '%Lp' "$FACTORY_DIR/env")"; else env_mode="$(stat -c '%a' "$FACTORY_DIR/env")"; fi
[[ "$env_mode" == 600 ]] || { echo "fail: imported env has mode $env_mode, not 600" >&2; exit 1; }
bootstrap_ok=true
if [[ "$bootstrap" == true ]]; then
  FACTORY_DIR="$FACTORY_DIR" ./scripts/bootstrap.sh || bootstrap_ok=false
fi

hard_failures=()
record_fail() { echo "fail: $*"; hard_failures+=("$*"); }
node_version='unavailable'
if command -v node >/dev/null 2>&1; then node_version="$(node --version)"; fi
node_major="${node_version#v}"; node_major="${node_major%%.*}"
if [[ "$node_major" == 22 ]]; then echo "ok: Node version is $node_version"; else record_fail "Node version is $node_version, but Node 22 is required; see NEW-MACHINE.md"; fi
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then echo 'ok: GitHub CLI authentication is valid'; else record_fail 'GitHub CLI authentication is unavailable; run `gh auth login`; see NEW-MACHINE.md'; fi
if ! command -v docker >/dev/null 2>&1; then export PATH="$HOME/.rd/bin:$PATH"; fi
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then echo 'ok: the container runtime is answering'; else record_fail 'a Docker-compatible runtime (Colima, Docker Desktop, OrbStack or Rancher Desktop) is required and must answer `docker info`; see NEW-MACHINE.md'; fi
if [[ "$bootstrap_ok" == false ]]; then record_fail './scripts/bootstrap.sh failed; re-run it once the prerequisites above are satisfied'; fi

tailscale_json=''
if command -v tailscale >/dev/null 2>&1; then tailscale_json="$(tailscale status --json 2>/dev/null || true)"; fi
tailscale_state=''
current_tailnet=''
if command -v node >/dev/null 2>&1 && [[ -n "$tailscale_json" ]]; then
  tailscale_state="$(printf '%s' "$tailscale_json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).BackendState||"")}catch{}})')"
  current_tailnet="$(printf '%s' "$tailscale_json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write((JSON.parse(s).Self.DNSName||"").replace(/\.$/,""))}catch{}})')"
fi
if [[ "$tailscale_state" == Running ]]; then echo "ok: Tailscale is logged in ($current_tailnet)"; else record_fail 'Tailscale is not logged in and Running; see NEW-MACHINE.md'; fi
if command -v tmux >/dev/null 2>&1; then echo 'ok: tmux is installed'; else echo 'warn: tmux is not installed; see NEW-MACHINE.md'; fi
if command -v gh >/dev/null 2>&1 && gh extension list 2>/dev/null | grep -Eq '(^|[[:space:]])cli/gh-webhook([[:space:]]|$)'; then echo 'ok: gh webhook extension is installed'; else echo 'warn: gh webhook extension is not installed; run `gh extension install cli/gh-webhook`; see NEW-MACHINE.md'; fi
serve_status=''
command -v tailscale >/dev/null 2>&1 && serve_status="$(tailscale serve status 2>/dev/null || true)"
if printf '%s' "$serve_status" | grep -Eq '(^|[^0-9])8443([^0-9]|$)'; then echo 'ok: Tailscale Serve is configured on port 8443'; else echo 'warn: Tailscale Serve is not configured on port 8443; run `tailscale serve --bg --https=8443 8790`; see NEW-MACHINE.md'; fi
if printf '%s' "$serve_status" | grep -Eq '8787'; then echo 'ok: Tailscale Serve root proxy points to port 8787'; else echo 'warn: Tailscale Serve root proxy to 8787 is not configured; run `tailscale serve --bg 8787`; see NEW-MACHINE.md'; fi
echo 'manual: Codex ChatGPT login cannot be checked here; run `npx -y @openai/codex@latest login status` (and `npx -y @openai/codex@latest login` if logged out); see NEW-MACHINE.md'

pak_public_url="$(sed -n 's/^PAK_PUBLIC_URL=//p' "$FACTORY_DIR/env" | tail -n 1)"
ntfy_url="$(sed -n 's/^NTFY_URL=//p' "$FACTORY_DIR/env" | tail -n 1)"
ntfy_base_url="$(sed -n 's/^NTFY_BASE_URL=//p' "$FACTORY_DIR/env" | tail -n 1)"
ntfy_topic="$(sed -n 's/^NTFY_TOPIC=//p' "$FACTORY_DIR/env" | tail -n 1)"; ntfy_topic="${ntfy_topic:-wyld-pak}"
echo
echo '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
echo '!! HOSTNAME REVIEW — this script will not edit these values'
echo "warn: PAK_PUBLIC_URL=$pak_public_url"
echo "warn: NTFY_URL=$ntfy_url"
if [[ -n "$ntfy_base_url" ]]; then
  echo "warn: NTFY_BASE_URL=$ntfy_base_url"
else
  echo "ok: NTFY_BASE_URL is unset; it will be derived from this machine's tailnet name at pnpm factory:up"
fi
if [[ -z "$current_tailnet" ]]; then
  echo 'warn: this machine tailnet name could not be checked (tailscale or node unavailable); run `tailscale status --json` and inspect Self.DNSName'
  echo "warn: the phone's ntfy subscription address changes with the hostname; re-subscribe it to https://<new tailnet name>:8443/$ntfy_topic"
else
  echo "ok: this machine tailnet name is $current_tailnet"
  for labeled_value in "PAK_PUBLIC_URL|$pak_public_url" "NTFY_URL|$ntfy_url" "NTFY_BASE_URL|$ntfy_base_url"; do
    label="${labeled_value%%|*}"; value="${labeled_value#*|}"
    host="$(node -e 'try{let v=process.argv[1];let m=v.match(/https?:\/\/([^/: '\''"]+)/);process.stdout.write(m?m[1]:"")}catch{}' "$value")"
    if [[ "$host" == *.ts.net && "$host" != "$current_tailnet" ]]; then
      echo "warn: $label still points at the old machine ($host), not $current_tailnet; edit it by hand (this script will not edit it)"
    fi
  done
  echo "warn: re-subscribe the phone's ntfy app to https://$current_tailnet:8443/$ntfy_topic because its subscription address changes with the hostname"
fi
echo 'warn: see NEW-MACHINE.md for the full procedure'
echo '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'

if ((${#hard_failures[@]})); then
  echo 'fail: hard prerequisites missing:'
  for failure in "${hard_failures[@]}"; do echo "fail: $failure"; done
  exit 1
fi
echo 'ready — run `pnpm factory:up`'

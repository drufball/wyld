#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FACTORY_DIR="${FACTORY_DIR:-$PWD/.factory}"
case "$FACTORY_DIR" in
  /*) ;;
  *) FACTORY_DIR="$PWD/$FACTORY_DIR" ;;
esac

if [[ -f "$FACTORY_DIR/env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$FACTORY_DIR/env"
  set +a
fi
NTFY_PORT="${NTFY_PORT:-8790}"

if [[ $# -gt 1 || ($# -eq 1 && "$1" != --render-only) ]]; then
  echo 'usage: ./scripts/ntfy-up.sh [--render-only]' >&2
  exit 1
fi
render_only=false
[[ $# -eq 0 ]] || render_only=true

mkdir -p "$FACTORY_DIR/ntfy"

if [[ -n "${NTFY_BASE_URL:-}" ]]; then
  echo "ok: ntfy base-url is $NTFY_BASE_URL (from NTFY_BASE_URL)"
else
  machine_tailnet=''
  if command -v tailscale >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
    machine_tailnet="$(tailscale status --self --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write((JSON.parse(s).Self.DNSName||"").replace(/\.$/,""))}catch{process.exit(1)}})' 2>/dev/null || true)"
  fi
  if [[ -z "$machine_tailnet" ]]; then
    echo "error: NTFY_BASE_URL is unset and this machine's tailnet name could not be read from tailscale status --self --json; set NTFY_BASE_URL=https://<tailnet-name>:8443 in .factory/env" >&2
    exit 1
  fi
  NTFY_BASE_URL="https://${machine_tailnet}:8443"
  echo "ok: ntfy base-url is $NTFY_BASE_URL (derived from this machine's tailnet name)"
fi

rendered="$FACTORY_DIR/ntfy/server.yml"
tmp="$FACTORY_DIR/ntfy/server.yml.tmp.$$"
trap 'rm -f "$tmp"' EXIT
while IFS= read -r line || [[ -n "$line" ]]; do
  printf '%s\n' "${line//\$\{NTFY_BASE_URL\}/$NTFY_BASE_URL}"
done <factory/ntfy/server.yml.tmpl >"$tmp"
if grep -q '\${' "$tmp"; then
  echo 'error: rendered ntfy config still contains an unresolved ${ placeholder' >&2
  exit 1
fi
mv "$tmp" "$rendered"
chmod 644 "$rendered"
config_sha="$(node -e 'const fs=require("node:fs"),crypto=require("node:crypto");process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"))' "$rendered")"

[[ "$render_only" == false ]] || exit 0

if ! command -v docker >/dev/null 2>&1; then
  export PATH="$HOME/.rd/bin:$PATH"
fi
if ! command -v docker >/dev/null 2>&1; then
  echo 'error: docker was not found; install and start your Docker runtime (see NEW-MACHINE.md)' >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo 'error: the container runtime is not answering; start your Docker runtime (see NEW-MACHINE.md)' >&2
  exit 1
fi

image='binwiederhier/ntfy:v2.28.0'
running_image="$(docker ps --filter name=^/wyld-ntfy$ --filter status=running --format '{{.Image}}')"
running_sha="$(docker inspect --format '{{ index .Config.Labels "wyld.config-sha" }}' wyld-ntfy 2>/dev/null || true)"
if [[ "$running_image" == "$image" && "$running_sha" == "$config_sha" ]]; then
  echo "ok: wyld-ntfy is already running with $image"
  exit 0
fi

if docker container inspect wyld-ntfy >/dev/null 2>&1; then
  docker rm -f wyld-ntfy >/dev/null
fi

docker run -d \
  --name wyld-ntfy \
  --restart unless-stopped \
  --label "wyld.config-sha=$config_sha" \
  -p "127.0.0.1:${NTFY_PORT}:80" \
  -v "$rendered:/etc/ntfy/server.yml:ro" \
  -v "$FACTORY_DIR/ntfy:/var/lib/ntfy" \
  binwiederhier/ntfy:v2.28.0 \
  serve

for ((attempt = 1; attempt <= 15; attempt++)); do
  if [[ "$(curl -fsS "http://localhost:${NTFY_PORT}/v1/health" 2>/dev/null || true)" == '{"healthy":true}' ]]; then
    echo 'ok: wyld-ntfy is healthy'
    exit 0
  fi
  sleep 1
done

echo "error: wyld-ntfy did not become healthy at http://localhost:${NTFY_PORT}/v1/health within 15 seconds" >&2
exit 1

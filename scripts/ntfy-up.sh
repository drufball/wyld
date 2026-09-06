#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f .factory/env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .factory/env
  set +a
fi
NTFY_PORT="${NTFY_PORT:-8790}"

mkdir -p .factory/ntfy

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
if [[ "$running_image" == "$image" ]]; then
  echo "ok: wyld-ntfy is already running with $image"
  exit 0
fi

if docker container inspect wyld-ntfy >/dev/null 2>&1; then
  docker rm -f wyld-ntfy >/dev/null
fi

docker run -d \
  --name wyld-ntfy \
  --restart unless-stopped \
  -p "127.0.0.1:${NTFY_PORT}:80" \
  -v "$PWD/factory/ntfy/server.yml:/etc/ntfy/server.yml:ro" \
  -v "$PWD/.factory/ntfy:/var/lib/ntfy" \
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

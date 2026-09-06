#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FACTORY_DIR="${FACTORY_DIR:-$PWD/.factory}"

if [[ ! -d "$FACTORY_DIR" ]]; then
  echo "fail: factory directory is missing: $FACTORY_DIR" >&2
  exit 1
fi
if [[ ! -f "$FACTORY_DIR/pak.sqlite" ]]; then
  echo "fail: $FACTORY_DIR/pak.sqlite is missing; there is no factory state to export" >&2
  exit 1
fi

out="${1:-$HOME/Desktop/wyld-factory-$(date +%Y%m%d-%H%M).tgz}"
case "$out" in
  /*) ;;
  *) out="$PWD/$out" ;;
esac
mkdir -p "$(dirname "$out")"
if [[ -e "$out" ]]; then
  echo "warn: overwriting existing export: $out"
fi

stage="$(mktemp -d "${TMPDIR:-/tmp}/wyld-factory-export.XXXXXX")"
trap 'rm -rf "$stage"' EXIT
methods_file="$stage/.database-methods"
: >"$methods_file"

for database in pak.sqlite wake.sqlite; do
  [[ -f "$FACTORY_DIR/$database" ]] || continue
  if command -v sqlite3 >/dev/null 2>&1 && sqlite3 "$FACTORY_DIR/$database" ".backup '$stage/$database'"; then
    echo "ok: $database snapshot created with sqlite3 .backup"
    printf '%s backup\n' "$database" >>"$methods_file"
  else
    reason='sqlite3 .backup failed'
    command -v sqlite3 >/dev/null 2>&1 || reason='sqlite3 is not on PATH'
    echo "warn: $database used the copy fallback because $reason; this copy is not guaranteed consistent if the factory is running" >&2
    for suffix in '' -wal -shm; do
      [[ -f "$FACTORY_DIR/$database$suffix" ]] && cp -p "$FACTORY_DIR/$database$suffix" "$stage/$database$suffix"
    done
    echo "ok: $database snapshot created with the copy fallback"
    printf '%s copy\n' "$database" >>"$methods_file"
  fi
done

if [[ -f "$FACTORY_DIR/env" ]]; then
  cp -p "$FACTORY_DIR/env" "$stage/env"
  chmod 600 "$stage/env"
fi
for directory in feedback ntfy; do
  [[ -d "$FACTORY_DIR/$directory" ]] && cp -R -p "$FACTORY_DIR/$directory" "$stage/$directory"
done

tailnet_name=null
if command -v tailscale >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
  tailnet_name="$(tailscale status --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).Self.DNSName.replace(/\.$/,""))}catch{process.exit(1)}})' 2>/dev/null || echo null)"
fi
created_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
host_name="$(hostname)"
git_commit="$(git rev-parse HEAD)"
files="$(printf '%s\n' export-manifest.json; find "$stage" -mindepth 1 ! -name '.database-methods' -print | sed "s|^$stage/||" | sort)"
node - "$stage/export-manifest.json" "$created_at" "$host_name" "$tailnet_name" "$git_commit" "$methods_file" "$files" <<'NODE'
import fs from 'node:fs';
const [, , output, createdAt, hostname, rawTailnetName, gitCommit, methodsPath, rawFiles] = process.argv;
const databaseMethod = {};
for (const line of fs.readFileSync(methodsPath, 'utf8').trim().split('\n').filter(Boolean)) {
  const [database, method] = line.split(' ');
  databaseMethod[database] = method;
}
const manifest = {kind: 'wyld-factory-export', version: 1, createdAt, hostname,
  tailnetName: rawTailnetName === 'null' ? null : rawTailnetName, gitCommit,
  files: rawFiles.split('\n').filter(Boolean), databaseMethod};
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
NODE
rm "$methods_file"

tar -czf "$out" -C "$stage" .
chmod 600 "$out"
if command -v du >/dev/null 2>&1; then size="$(du -h "$out" | awk '{print $1}')"; else size='unknown size'; fi
echo "ok: export written to $out ($size)"
echo 'ok: included databases, env, feedback/, ntfy/, and manifest when present; left out demos/, worktrees/, planner-session.json, and logs/'
echo 'warn: this file contains secrets — move it over Tailscale or AirDrop and delete it afterwards'

#!/usr/bin/env bash
# Backup PostgreSQL pg_dump (required). Optional SQLite archive via --with-sqlite-archive.
#
# Usage:
#   ./scripts/backup_ptt_data.sh
#   ./scripts/backup_ptt_data.sh --with-sqlite-archive   # legacy local ptt.db copy
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${PTT_BACKUP_DIR:-/var/backups/ptt}"
RETENTION_DAYS="${PTT_BACKUP_RETENTION_DAYS:-14}"
TS="$(date +%Y%m%d-%H%M)"
WITH_SQLITE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-sqlite-archive) WITH_SQLITE=1 ;;
    -h|--help)
      echo "Usage: backup_ptt_data.sh [--with-sqlite-archive]"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

mkdir -p "$BACKUP_DIR"

DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
SQLITE_SRC="${PTT_SQLITE_PATH:-${PTT_APP_DIR:-$ROOT}/ptt.db}"

PG_OUT="$BACKUP_DIR/rnosaidb-${TS}.dump"
SQLITE_OUT="$BACKUP_DIR/ptt-${TS}.db"

echo "==> pg_dump → $PG_OUT"
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$DATABASE_URL" -Fc -f "$PG_OUT"
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -qx rnosai-postgres; then
  docker exec rnosai-postgres pg_dump -U ptt -d rnosaidb -Fc > "$PG_OUT"
else
  echo "FAIL: pg_dump not found and rnosai-postgres container not running" >&2
  exit 1
fi
test -s "$PG_OUT"

if [[ "$WITH_SQLITE" == "1" ]]; then
  echo "==> sqlite copy → $SQLITE_OUT"
  if [[ -f "$SQLITE_SRC" ]]; then
    cp -a "$SQLITE_SRC" "$SQLITE_OUT"
    test -s "$SQLITE_OUT"
  else
    echo "WARN: --with-sqlite-archive but sqlite not found at $SQLITE_SRC" >&2
  fi
fi

if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && [[ "$RETENTION_DAYS" -gt 0 ]]; then
  find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'rnosaidb-*.dump' -o -name 'ptt_agency-*.dump' -o -name 'ptt-*.db' \) -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
fi

if [[ "$WITH_SQLITE" == "1" && -f "$SQLITE_OUT" ]]; then
  echo "OK backup complete: $PG_OUT $SQLITE_OUT"
else
  echo "OK backup complete: $PG_OUT (PG-only; pass --with-sqlite-archive for legacy ptt.db)"
fi

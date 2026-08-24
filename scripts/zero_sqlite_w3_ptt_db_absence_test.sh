#!/usr/bin/env bash
# Zero SQLite W3 P6 — acceptance: API healthy without ptt.db on disk
#
# Renames ptt.db aside, smoke-checks API, restores (or archives). Dry-run by default.
#
# Usage (VPS):
#   HEALTH_URL=http://127.0.0.1:3010/health PTT_APP_DIR=/var/www/realosai \
#     ./scripts/zero_sqlite_w3_ptt_db_absence_test.sh
#
#   APPLY=1 WITH_BACKUP=1 HEALTH_URL=http://127.0.0.1:3010/health PTT_APP_DIR=/var/www/realosai \
#     ./scripts/zero_sqlite_w3_ptt_db_absence_test.sh
#
#   APPLY=1 ARCHIVE=1 ...   # move to backup dir; do not restore on exit
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${PTT_APP_DIR:-$ROOT}"
SQLITE="${PTT_SQLITE_PATH:-$APP_DIR/ptt.db}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
APPLY="${APPLY:-0}"
ARCHIVE="${ARCHIVE:-0}"
WITH_BACKUP="${WITH_BACKUP:-0}"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${PTT_BACKUP_DIR:-/var/backups/ptt}"
REPORT="${PTT_ARTIFACTS_DIR:-$ROOT/.local-dev}/zero-sqlite-w3-p6-absence-report.json"

SMOKE_PATHS=(
  "/health"
  "/api/crm/deal-room/1/snapshot"
  "/api/crm/ai/forecast/current"
  "/api/v1/leads/1/status-options"
)

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      echo "Usage: zero_sqlite_w3_ptt_db_absence_test.sh [--help]"
      echo "  APPLY=1           execute rename + smoke (default dry-run)"
      echo "  ARCHIVE=1         move ptt.db to backup dir (no restore)"
      echo "  WITH_BACKUP=1     pg_dump before rename"
      echo "  HEALTH_URL=...    API health endpoint"
      echo "  PTT_APP_DIR=...   app root (default repo root)"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

BASE="${HEALTH_URL%/health}"
BASE="${BASE%/}"

_write_report() {
  local ok="$1"
  local note="$2"
  mkdir -p "$(dirname "$REPORT")"
  REPORT="$REPORT" REPORT_OK="$ok" REPORT_NOTE="$note" REPORT_TS="$TS" \
    REPORT_SQLITE="$SQLITE" REPORT_HEALTH="$HEALTH_URL" \
    python3 - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

out = Path(os.environ["REPORT"])
report = {
    "phase": "zero-sqlite-w3-p6",
    "ok": os.environ.get("REPORT_OK") == "1",
    "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "sqlite_path": os.environ.get("REPORT_SQLITE"),
    "health_url": os.environ.get("REPORT_HEALTH"),
    "notes": os.environ.get("REPORT_NOTE", ""),
}
out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(f"Report → {out}")
PY
}

echo "==> Zero SQLite W3 P6 ptt.db absence acceptance"
echo "    sqlite:  $SQLITE"
echo "    health:  $HEALTH_URL"
echo "    APPLY:   $APPLY"
echo "    ARCHIVE: $ARCHIVE"
echo "    backup:  $WITH_BACKUP"

if [[ ! -f "$SQLITE" ]]; then
  echo "SKIP no sqlite file at $SQLITE — already absent"
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    _write_report 1 "sqlite already absent; health OK"
    echo "OK  health reachable without ptt.db"
    exit 0
  fi
  _write_report 0 "sqlite absent but health failed"
  echo "FAIL health not reachable: $HEALTH_URL" >&2
  exit 1
fi

if [[ "$APPLY" != "1" ]]; then
  BAK_HINT="${SQLITE}.bak.${TS}"
  [[ "$ARCHIVE" == "1" ]] && BAK_HINT="${BACKUP_DIR}/ptt-archived-${TS}.db"
  echo ""
  echo "Dry-run: would mv $SQLITE → $BAK_HINT"
  echo "         smoke ${#SMOKE_PATHS[@]} routes on $BASE"
  echo "Re-run with APPLY=1 to execute"
  _write_report 1 "dry-run only"
  exit 0
fi

if [[ "$WITH_BACKUP" == "1" ]] && [[ -x "$ROOT/scripts/backup_ptt_data.sh" ]]; then
  echo "==> Pre-backup (PG)"
  "$ROOT/scripts/backup_ptt_data.sh" || {
    echo "FAIL pre-backup" >&2
    _write_report 0 "pre-backup failed"
    exit 1
  }
fi

if [[ "$ARCHIVE" == "1" ]]; then
  mkdir -p "$BACKUP_DIR"
  BAK="${BACKUP_DIR}/ptt-archived-${TS}.db"
else
  BAK="${SQLITE}.bak.${TS}"
fi

cleanup() {
  if [[ "$ARCHIVE" == "1" ]]; then
    return 0
  fi
  if [[ -f "$BAK" ]] && [[ ! -f "$SQLITE" ]]; then
    mv "$BAK" "$SQLITE"
    echo "==> Restored $SQLITE"
  fi
}
trap cleanup EXIT

echo "==> Rename aside: $BAK"
mv "$SQLITE" "$BAK"

echo "==> Smoke routes (401/404 OK; 503 sqlite_disabled = FAIL)"
fail_smoke=0
for path in "${SMOKE_PATHS[@]}"; do
  url="${BASE}${path}"
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo 000)"
  echo "    $path → $code"
  if [[ "$code" == "503" ]]; then
    body="$(curl -sS "$url" 2>/dev/null || true)"
    if echo "$body" | grep -q 'sqlite_disabled'; then
      echo "FAIL 503 sqlite_disabled on $path" >&2
      fail_smoke=1
    fi
  fi
done

body="$(curl -sf "$HEALTH_URL")" || {
  echo "FAIL health check after ptt.db rename" >&2
  _write_report 0 "health unreachable after rename"
  exit 1
}

health_ok=1
if ! echo "$body" | grep -q '"sqlite_disabled"[[:space:]]*:[[:space:]]*true'; then
  echo "WARN health missing sqlite_disabled:true"
  health_ok=0
else
  echo "OK  sqlite_disabled=true"
fi
if ! echo "$body" | grep -q '"postgres"[[:space:]]*:[[:space:]]*true'; then
  echo "FAIL health missing postgres:true" >&2
  _write_report 0 "postgres not true in health"
  exit 1
fi
echo "OK  postgres=true"

if [[ "$fail_smoke" -ne 0 ]] || [[ "$health_ok" -ne 1 ]]; then
  _write_report 0 "smoke or health check failed"
  exit 1
fi

if [[ "$ARCHIVE" == "1" ]]; then
  echo "OK  ptt.db archived at $BAK (not restored — Wave 4 prep)"
  _write_report 1 "archived at $BAK"
else
  echo "OK  ptt.db absence acceptance — API healthy without sqlite file"
  _write_report 1 "rename smoke pass; restored via trap"
fi

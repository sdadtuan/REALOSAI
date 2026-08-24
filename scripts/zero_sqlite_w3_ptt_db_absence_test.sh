#!/usr/bin/env bash
# Zero SQLite W3 P6 — optional acceptance: API healthy without ptt.db on disk
#
# Renames ptt.db aside, curls /health, restores file. Safe dry-run by default.
#
# Usage (VPS):
#   HEALTH_URL=https://real.gomira.vn/health ./scripts/zero_sqlite_w3_ptt_db_absence_test.sh
#   APPLY=1 HEALTH_URL=http://127.0.0.1:3010/health ./scripts/zero_sqlite_w3_ptt_db_absence_test.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${PTT_APP_DIR:-$ROOT}"
SQLITE="${PTT_SQLITE_PATH:-$APP_DIR/ptt.db}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
APPLY="${APPLY:-0}"
TS="$(date +%Y%m%d-%H%M%S)"
BAK="${SQLITE}.bak.${TS}"

echo "==> Zero SQLite ptt.db absence test"
echo "    sqlite: $SQLITE"
echo "    health: $HEALTH_URL"
echo "    APPLY:  $APPLY"

if [[ ! -f "$SQLITE" ]]; then
  echo "SKIP no sqlite file at $SQLITE — already absent"
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    echo "OK  health reachable without ptt.db"
    exit 0
  fi
  echo "FAIL health not reachable: $HEALTH_URL" >&2
  exit 1
fi

if [[ "$APPLY" != "1" ]]; then
  echo ""
  echo "Dry-run: would mv $SQLITE → $BAK, curl $HEALTH_URL, restore"
  echo "Re-run with APPLY=1 to execute"
  exit 0
fi

cleanup() {
  if [[ -f "$BAK" ]] && [[ ! -f "$SQLITE" ]]; then
    mv "$BAK" "$SQLITE"
    echo "==> Restored $SQLITE"
  fi
}
trap cleanup EXIT

echo "==> Rename aside: $BAK"
mv "$SQLITE" "$BAK"

echo "==> Health check"
body="$(curl -sf "$HEALTH_URL")" || {
  echo "FAIL health check after ptt.db rename" >&2
  exit 1
}

if echo "$body" | grep -q '"sqlite_disabled"[[:space:]]*:[[:space:]]*true'; then
  echo "OK  sqlite_disabled=true"
else
  echo "WARN health response missing sqlite_disabled:true — $body"
fi

if echo "$body" | grep -q '"postgres"[[:space:]]*:[[:space:]]*true'; then
  echo "OK  postgres=true"
else
  echo "FAIL health response missing postgres:true" >&2
  exit 1
fi

echo "OK  ptt.db absence acceptance — API healthy without sqlite file"

#!/usr/bin/env bash
# Zero SQLite W3 P6 — ptt.db absence acceptance wrapper
#
# Default: dry-run. Set APPLY=1 on VPS after backup to execute live test.
#
# Usage:
#   ./scripts/ci_zero_sqlite_w3_p6_accept.sh
#   APPLY=1 HEALTH_URL=http://127.0.0.1:3010/health PTT_APP_DIR=/var/www/realosai \
#     ./scripts/ci_zero_sqlite_w3_p6_accept.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Zero SQLite W3 P6 accept =="
echo ""

if [[ ! -x "$ROOT/scripts/zero_sqlite_w3_ptt_db_absence_test.sh" ]]; then
  echo "FAIL missing zero_sqlite_w3_ptt_db_absence_test.sh" >&2
  exit 1
fi

export HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
export PTT_APP_DIR="${PTT_APP_DIR:-$ROOT}"
export PTT_ARTIFACTS_DIR="${PTT_ARTIFACTS_DIR:-$ROOT/.local-dev}"

"$ROOT/scripts/zero_sqlite_w3_ptt_db_absence_test.sh" "$@"

echo ""
echo "Zero SQLite W3 P6 accept: PASS"

#!/usr/bin/env bash
# Zero SQLite Wave 4 P6 — permanent ptt.db archive + post-W4 regression
#
# Wraps zero_sqlite_w3_ptt_db_absence_test.sh (ARCHIVE=1) and verifies:
#   W4-P6-01  ptt.db absent under PTT_APP_DIR
#   W4-P6-02  archived copy under PTT_BACKUP_DIR (when archive ran)
#   W4-P6-03  optional strip active PTT_SQLITE_PATH from .env
#   W4-P6-04  W2/W4 ops smoke (401/200/404 OK; 503 sqlite_disabled = FAIL)
#
# Usage (VPS — dry-run):
#   HEALTH_URL=http://127.0.0.1:3010/health PTT_APP_DIR=/var/www/realosai \
#     ./scripts/ci_zero_sqlite_w4_p6_accept.sh
#
# Live archive + regression:
#   APPLY=1 ARCHIVE=1 WITH_BACKUP=1 \
#     HEALTH_URL=http://127.0.0.1:3010/health PTT_APP_DIR=/var/www/realosai \
#     ./scripts/ci_zero_sqlite_w4_p6_accept.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
fi

APP_DIR="${PTT_APP_DIR:-$ROOT}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
ENV_FILE="${PTT_ENV_FILE:-$APP_DIR/.env}"
BACKUP_DIR="${PTT_BACKUP_DIR:-/var/backups/ptt}"
APPLY="${APPLY:-0}"
ARCHIVE="${ARCHIVE:-1}"
WITH_BACKUP="${WITH_BACKUP:-0}"
STRIP_SQLITE_ENV="${STRIP_SQLITE_ENV:-1}"
export PTT_ARTIFACTS_DIR="${PTT_ARTIFACTS_DIR:-$ROOT/.local-dev}"
mkdir -p "$PTT_ARTIFACTS_DIR"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if ! mkdir -p "$BACKUP_DIR" 2>/dev/null; then
  BACKUP_DIR="$APP_DIR/backups"
  mkdir -p "$BACKUP_DIR"
fi
export PTT_BACKUP_DIR="$BACKUP_DIR"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

fail=0
ok() { echo "OK   $*"; }
bad() { echo "FAIL $*"; fail=1; }
warn_line() { echo "WARN $*"; }

BASE="${HEALTH_URL%/health}"
BASE="${BASE%/}"

W4_SMOKE_PATHS=(
  "/health"
  "/api/v1/leads/1/status-options"
  "/api/crm/deal-room/1/snapshot"
  "/api/crm/ai/forecast/current"
  "/api/crm/finance/business-dashboard"
  "/api/crm/re-projects/1/accounting/dashboard"
  "/api/crm/tickets"
)

echo "== Zero SQLite W4 P6 accept =="
echo "    app:     $APP_DIR"
echo "    health:  $HEALTH_URL"
echo "    APPLY:   $APPLY"
echo "    ARCHIVE: $ARCHIVE"
echo "    backup:  $WITH_BACKUP"
echo ""

if [[ ! -x "$ROOT/scripts/zero_sqlite_w3_ptt_db_absence_test.sh" ]]; then
  bad "missing zero_sqlite_w3_ptt_db_absence_test.sh"
  exit 1
fi

export HEALTH_URL PTT_APP_DIR
export ARCHIVE WITH_BACKUP
if ! "$ROOT/scripts/zero_sqlite_w3_ptt_db_absence_test.sh"; then
  bad "W4-P6-00 zero_sqlite_w3_ptt_db_absence_test.sh failed"
  exit 1
fi
ok "W4-P6-00 ptt.db absence / archive step PASS"
echo ""

if [[ "$APPLY" != "1" ]]; then
  ok "W4-P6 dry-run complete — re-run with APPLY=1 ARCHIVE=1 WITH_BACKUP=1 on VPS"
  REPORT="$PTT_ARTIFACTS_DIR/zero-sqlite-w4-p6-accept-report.json"
  export W4_P6_FAIL=0 W4_P6_ARCHIVE_COUNT=0 W4_P6_SQLITE_LIVE="${PTT_SQLITE_PATH:-$APP_DIR/ptt.db}" W4_P6_REPORT="$REPORT"
  "$PYTHON" - <<'PY'
import json, os
from datetime import datetime, timezone
from pathlib import Path
out = Path(os.environ["W4_P6_REPORT"])
report = {
    "phase": "zero-sqlite-w4-p6",
    "ok": True,
    "dry_run": True,
    "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "notes": "Re-run APPLY=1 on VPS to archive ptt.db",
}
out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(f"Report → ok=True (dry-run) → {out}")
PY
  echo ""
  echo "Zero SQLite W4 P6 accept: PASS (dry-run)"
  exit 0
fi

SQLITE_LIVE="${PTT_SQLITE_PATH:-$APP_DIR/ptt.db}"
if [[ -f "$SQLITE_LIVE" ]]; then
  bad "W4-P6-01 ptt.db still present at $SQLITE_LIVE"
else
  ok "W4-P6-01 ptt.db absent at $SQLITE_LIVE"
fi

ARCHIVE_GLOB="$BACKUP_DIR/ptt-archived-*.db"
ARCHIVE_COUNT=0
if compgen -G "$ARCHIVE_GLOB" >/dev/null 2>&1; then
  ARCHIVE_COUNT="$(ls -1 $ARCHIVE_GLOB 2>/dev/null | wc -l | tr -d ' ')"
fi
if [[ "$ARCHIVE_COUNT" -gt 0 ]]; then
  ok "W4-P6-02 archived copies in $BACKUP_DIR ($ARCHIVE_COUNT file(s))"
  ls -1t $ARCHIVE_GLOB 2>/dev/null | head -3 | sed 's/^/       /'
elif [[ -f "$SQLITE_LIVE" ]]; then
  bad "W4-P6-02 no archive yet and ptt.db still live"
else
  warn_line "W4-P6-02 no $ARCHIVE_GLOB (already archived earlier or dry-run)"
fi

if [[ "$APPLY" == "1" ]] && [[ "$STRIP_SQLITE_ENV" == "1" ]] && [[ -f "$ENV_FILE" ]]; then
  if grep -qE '^[^#]*PTT_SQLITE_PATH' "$ENV_FILE"; then
    _env_bak="${ENV_FILE}.bak.w4p6.$(date +%Y%m%d-%H%M%S)"
    cp "$ENV_FILE" "$_env_bak"
    sed -i.bak '/^[^#]*PTT_SQLITE_PATH/d' "$ENV_FILE" 2>/dev/null || \
      sed -i '' '/^[^#]*PTT_SQLITE_PATH/d' "$ENV_FILE"
    rm -f "${ENV_FILE}.bak" 2>/dev/null || true
    ok "W4-P6-03 removed active PTT_SQLITE_PATH from $ENV_FILE (backup $_env_bak)"
  else
    ok "W4-P6-03 no active PTT_SQLITE_PATH in $ENV_FILE"
  fi
else
  ok "W4-P6-03 env strip skipped (APPLY=$APPLY or no $ENV_FILE)"
fi

echo ""
echo "==> W4-P6-04 ops smoke (${#W4_SMOKE_PATHS[@]} routes)"
_smoke_fail=0
for path in "${W4_SMOKE_PATHS[@]}"; do
  url="${BASE}${path}"
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
  code="${code:-000}"
  echo "    $path → $code"
  if [[ "$code" == "503" ]]; then
    body="$(curl -sS "$url" 2>/dev/null || true)"
    if echo "$body" | grep -q 'sqlite_disabled'; then
      bad "503 sqlite_disabled on $path"
      _smoke_fail=1
    fi
  elif [[ "$path" == "/health" ]] && [[ "$code" != "200" ]]; then
    bad "health expected 200 got $code"
    _smoke_fail=1
  elif [[ "$path" != "/health" ]] && [[ "$code" == "000" ]]; then
    bad "unreachable $path"
    _smoke_fail=1
  fi
done

if [[ "$_smoke_fail" -eq 0 ]]; then
  ok "W4-P6-04 smoke matrix PASS (no sqlite_disabled 503)"
else
  fail=1
fi

body="$(curl -sf "$HEALTH_URL" 2>/dev/null || true)"
if [[ -n "$body" ]]; then
  echo "$body" | grep -q '"sqlite_disabled"[[:space:]]*:[[:space:]]*true' && \
    ok "health sqlite_disabled=true" || bad "health missing sqlite_disabled:true"
  echo "$body" | grep -q '"postgres"[[:space:]]*:[[:space:]]*true' && \
    ok "health postgres=true" || bad "health missing postgres:true"
else
  bad "health unreachable at $HEALTH_URL"
fi

REPORT="$PTT_ARTIFACTS_DIR/zero-sqlite-w4-p6-accept-report.json"
export W4_P6_FAIL="$fail"
export W4_P6_ARCHIVE_COUNT="$ARCHIVE_COUNT"
export W4_P6_SQLITE_LIVE="$SQLITE_LIVE"
export W4_P6_REPORT="$REPORT"
"$PYTHON" - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

fail = os.environ.get("W4_P6_FAIL", "1")
report = {
    "phase": "zero-sqlite-w4-p6",
    "ok": fail == "0",
    "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "checks": {
        "sqlite_live_path": os.environ.get("W4_P6_SQLITE_LIVE"),
        "archive_count": int(os.environ.get("W4_P6_ARCHIVE_COUNT", "0")),
    },
    "notes": "Permanent ptt.db archive; keep PTT_SQLITE_DISABLED=1 on prod",
}
out = Path(os.environ["W4_P6_REPORT"])
out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(f"Report → ok={report['ok']} → {out}")
if not report["ok"]:
    raise SystemExit(1)
PY

echo ""
if [[ "$fail" -ne 0 ]]; then
  echo "Zero SQLite W4 P6 accept: FAIL"
  exit 1
fi
echo "Zero SQLite W4 P6 accept: PASS"
exit 0

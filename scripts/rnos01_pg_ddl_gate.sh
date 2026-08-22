#!/usr/bin/env bash
# RNOS-01 gate — verify Revenue OS AI DDL on staging/prod (read-only verify or apply+verify)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="${ROOT}${PYTHONPATH:+:$PYTHONPATH}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  ENV_FILE="${RNOS01_ENV:-$ROOT/deploy/env.local.example}"
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$ENV_FILE" 2>/dev/null || true
    set +a
  fi
fi

: "${DATABASE_URL:?DATABASE_URL required — run: set -a && source .env && set +a}"

PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
fi

APPLY="${APPLY:-1}"
REPORT="${REPORT:-$ROOT/.local-dev/rnos01-gate-report.json}"
mkdir -p "$(dirname "$REPORT")"

fail=0
ok() { echo "OK  $*"; }
bad() { echo "FAIL $*"; fail=1; }

echo "== RNOS-01 gate =="
echo "   DATABASE_URL=${DATABASE_URL%%@*}@***"
echo "   APPLY=$APPLY"

if [[ "$APPLY" == "1" ]]; then
  echo ""
  echo "==> Apply DDL"
  if bash "$ROOT/scripts/apply_pg_ddl_revenue_os_ai.sh"; then
    ok "apply_pg_ddl_revenue_os_ai.sh"
  else
    bad "apply failed"
  fi
else
  echo ""
  echo "==> Verify only (APPLY=0)"
  SKIP_APPLY=1 bash "$ROOT/scripts/apply_pg_ddl_revenue_os_ai.sh" || bad "verify failed"
fi

echo ""
echo "==> Write gate report"
"$PYTHON" - <<PY
import json
import os
from pathlib import Path

from ptt_crm.pg_schema import (
    MIGRATION_REVENUE_OS_AI,
    pg_revenue_os_ai_migration_applied,
    pg_revenue_os_ai_prerequisites_ready,
    pg_revenue_os_ai_r1_core_ready,
    pg_revenue_os_ai_ready,
    pg_revenue_os_ai_smoke_insert_ok,
    pg_revenue_os_ai_table_counts,
    pg_v3_ready,
)

report = {
    "rnos": "RNOS-01",
    "migration": MIGRATION_REVENUE_OS_AI,
    "pg_v3_ready": pg_v3_ready(),
    "prerequisites_ready": pg_revenue_os_ai_prerequisites_ready(),
    "migration_applied": pg_revenue_os_ai_migration_applied(),
    "r1_core_ready": pg_revenue_os_ai_r1_core_ready(),
    "full_ready": pg_revenue_os_ai_ready(),
    "smoke_insert_ok": pg_revenue_os_ai_smoke_insert_ok(),
    "table_counts": pg_revenue_os_ai_table_counts(),
    "ok": False,
}
report["ok"] = all(
    [
        report["pg_v3_ready"],
        report["prerequisites_ready"],
        report["migration_applied"],
        report["r1_core_ready"],
        report["full_ready"],
        report["smoke_insert_ok"],
    ]
)

path = Path("$REPORT")
path.write_text(json.dumps(report, indent=2, default=str) + "\n", encoding="utf-8")
print(f"Report: {path}")
print(f"ok={report['ok']}")
if not report["ok"]:
    raise SystemExit(1)
PY

if [[ "$fail" -ne 0 ]]; then
  echo ""
  echo "RNOS-01 gate FAILED"
  exit 1
fi

echo ""
echo "RNOS-01 gate PASSED"

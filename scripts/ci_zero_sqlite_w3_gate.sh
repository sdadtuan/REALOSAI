#!/usr/bin/env bash
# Zero SQLite Wave 3 P1 — CI / pre-deploy gate
#
# Checks:
#   W3-G01  PTT_SQLITE_DISABLED=1 in prod env template
#   W3-G02  No PTT_SQLITE_PATH in zero-sqlite prod template / runtime.env.example
#   W3-G03  PTT_FLASK_MONOLITH_MODE=retired
#   W3-G04  phase5_flask_retirement_gates PASS (skip prior artifacts in CI)
#   W3-G05  Flask CRM registry 100% RETIRED
#   W3-G06  Playwright sqlite inventory (0 required)
#   W3-G07  Staging gate packs PG bootstrap + PG-primary backup
#
# Usage:
#   ./scripts/ci_zero_sqlite_w3_gate.sh
#   set -a && source deploy/env.zero-sqlite-w3-prod.example && set +a
#   ./scripts/ci_zero_sqlite_w3_gate.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
fi
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"

ENV_FILE="${ZERO_SQLITE_W3_ENV:-$ROOT/deploy/env.zero-sqlite-w3-prod.example}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export PHASE5_SKIP_PRIOR_GATES="${PHASE5_SKIP_PRIOR_GATES:-1}"
export PHASE5_EXPECT_FLASK_MODE="${PHASE5_EXPECT_FLASK_MODE:-retired}"
export PTT_ARTIFACTS_DIR="${PTT_ARTIFACTS_DIR:-$ROOT/.local-dev}"
mkdir -p "$PTT_ARTIFACTS_DIR"

fail=0
warn=0
ok() { echo "OK   $*"; }
bad() { echo "FAIL $*"; fail=1; }
warn_line() { echo "WARN $*"; warn=1; }

echo "== Zero SQLite W3 P1 gate =="
echo "    env template: $ENV_FILE"
echo ""

# W3-G01
if [[ "${PTT_SQLITE_DISABLED:-0}" == "1" ]]; then
  ok "W3-G01 PTT_SQLITE_DISABLED=1"
else
  bad "W3-G01 PTT_SQLITE_DISABLED must be 1 (got: ${PTT_SQLITE_DISABLED:-unset})"
fi

# W3-G02 — prod templates must not require sqlite file
PROD_ENV="$ROOT/deploy/env.zero-sqlite-w3-prod.example"
if [[ -f "$PROD_ENV" ]] && grep -qE '^[^#]*PTT_SQLITE_PATH' "$PROD_ENV"; then
  bad "W3-G02 $PROD_ENV must not set PTT_SQLITE_PATH"
else
  ok "W3-G02 deploy/env.zero-sqlite-w3-prod.example has no PTT_SQLITE_PATH"
fi

RUNTIME_EX="$ROOT/deploy/runtime.env.example"
if [[ -f "$RUNTIME_EX" ]] && grep -qE '^[^#]*PTT_SQLITE_PATH' "$RUNTIME_EX"; then
  bad "W3-G02 deploy/runtime.env.example must not set PTT_SQLITE_PATH"
else
  ok "W3-G02 deploy/runtime.env.example has no PTT_SQLITE_PATH"
fi

# W3-G03
mode="${PTT_FLASK_MONOLITH_MODE:-active}"
if [[ "$mode" == "retired" ]]; then
  ok "W3-G03 PTT_FLASK_MONOLITH_MODE=retired"
else
  bad "W3-G03 PTT_FLASK_MONOLITH_MODE must be retired (got: $mode)"
fi

# W3-G04 — phase5 Flask retirement gates
echo ""
echo "==> W3-G04 phase5_flask_retirement_gates"
export PTT_LEADS_WRITE_SOURCE="${PTT_LEADS_WRITE_SOURCE:-pg}"
export PTT_LEAD_INGEST_RULES_SOURCE="${PTT_LEAD_INGEST_RULES_SOURCE:-pg}"
export PTT_WEBHOOKS_FLASK_FALLBACK="${PTT_WEBHOOKS_FLASK_FALLBACK:-0}"
export PTT_WEBHOOKS_NEST_META="${PTT_WEBHOOKS_NEST_META:-1}"
export PTT_PORTAL_SEO_ENABLED="${PTT_PORTAL_SEO_ENABLED:-1}"
if "$PYTHON" -m ptt_crm.phase5_flask_retirement_gates >/dev/null; then
  ok "W3-G04 phase5_flask_retirement_gates PASS"
else
  bad "W3-G04 phase5_flask_retirement_gates FAIL — run: $PYTHON -m ptt_crm.phase5_flask_retirement_gates"
fi

# W3-G05 — Flask registry
echo ""
echo "==> W3-G05 Flask CRM registry"
if "$PYTHON" -m unittest tests.test_crm_flask_retirement -q 2>/dev/null; then
  ok "W3-G05 all CRM Flask modules RETIRED"
else
  bad "W3-G05 tests.test_crm_flask_retirement FAIL"
fi

# W3-G06 — Playwright inventory (warn until W3 P3)
PW_TOTAL=0
PW_SQLITE=0
if compgen -G "$ROOT/scripts/playwright_ops_*e2e*.sh" >/dev/null; then
  for f in "$ROOT"/scripts/playwright_ops_*e2e*.sh; do
    PW_TOTAL=$((PW_TOTAL + 1))
    if grep -q 'PTT_SQLITE_PATH' "$f"; then
      PW_SQLITE=$((PW_SQLITE + 1))
    fi
  done
fi
PW_TARGET=0
if [[ "$PW_SQLITE" -eq "$PW_TARGET" ]]; then
  ok "W3-G06 Playwright PG-only ($PW_TOTAL scripts, 0 with PTT_SQLITE_PATH)"
else
  bad "W3-G06 Playwright still sqlite-backed: $PW_SQLITE / $PW_TOTAL (target 0)"
fi

# W3-G07 — staging/local scripts use PG bootstrap (W3 P4)
W3G07_FILES=(
  staging_phase2_gate_pack.sh
  staging_phase3_gate_pack.sh
  staging_phase4_gate_pack.sh
  staging_phase5_full_gate.sh
)
W3G07_FAIL=0
for f in "${W3G07_FILES[@]}"; do
  p="$ROOT/scripts/$f"
  if [[ ! -f "$p" ]]; then
    bad "W3-G07 missing $f"
    W3G07_FAIL=1
  elif ! grep -q 'e2e_pg_bootstrap' "$p"; then
    bad "W3-G07 $f must source e2e_pg_bootstrap.sh"
    W3G07_FAIL=1
  fi
done
if [[ "$W3G07_FAIL" -eq 0 ]]; then
  ok "W3-G07 staging gate packs PG bootstrap (${#W3G07_FILES[@]} scripts)"
fi

BACKUP="$ROOT/scripts/backup_ptt_data.sh"
if [[ -f "$BACKUP" ]] && grep -q 'with-sqlite-archive' "$BACKUP"; then
  ok "W3-G07 backup_ptt_data.sh PG-primary (--with-sqlite-archive optional)"
else
  bad "W3-G07 backup_ptt_data.sh must support --with-sqlite-archive"
fi

# Summary artifact
REPORT="$PTT_ARTIFACTS_DIR/zero-sqlite-w3-p1-gate-report.json"
"$PYTHON" - <<PY
import json
import os
from datetime import datetime, timezone
from pathlib import Path

root = Path("$ROOT")
report = {
    "phase": "zero-sqlite-w3-p1",
    "ok": $fail == 0,
    "warnings": $warn != 0,
    "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "env_file": "$ENV_FILE",
    "checks": {
        "sqlite_disabled": os.environ.get("PTT_SQLITE_DISABLED"),
        "flask_mode": os.environ.get("PTT_FLASK_MONOLITH_MODE"),
        "playwright_sqlite_count": $PW_SQLITE,
        "playwright_total": $PW_TOTAL,
    },
    "notes": "W3-G06 requires zero Playwright scripts with PTT_SQLITE_PATH; W3-G07 staging PG bootstrap",
}
Path("$REPORT").write_text(json.dumps(report, indent=2) + "\\n", encoding="utf-8")
print(f"Report → {report['ok']=} warnings={report['warnings']} → $REPORT")
if not report["ok"]:
    raise SystemExit(1)
PY

echo ""
if [[ "$fail" -ne 0 ]]; then
  echo "Zero SQLite W3 P1 gate: FAIL"
  exit 1
fi
echo "Zero SQLite W3 P1 gate: PASS"
exit 0

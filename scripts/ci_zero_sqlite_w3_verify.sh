#!/usr/bin/env bash
# Zero SQLite Wave 3 P5 — full verification matrix (extends ci_zero_sqlite_w3_gate.sh)
#
# Checks:
#   W3-G01…G07  via ci_zero_sqlite_w3_gate.sh
#   W3-V01      Nest zero new DatabaseSync outside specs (Wave 4 complete)
#   W3-V02      ai-intelligence/ has zero DatabaseSync
#   W3-V03      PG e2e bootstrap library present
#   W3-V04      dual-run scripts deprecated when PTT_SQLITE_DISABLED=1
#
# Usage:
#   ./scripts/ci_zero_sqlite_w3_verify.sh
#   ./scripts/ci_zero_sqlite_w3_verify.sh --skip-gate   # V01–V04 only
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
fi
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
export PTT_ARTIFACTS_DIR="${PTT_ARTIFACTS_DIR:-$ROOT/.local-dev}"
mkdir -p "$PTT_ARTIFACTS_DIR"

SKIP_GATE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-gate) SKIP_GATE=1 ;;
    -h|--help)
      echo "Usage: ci_zero_sqlite_w3_verify.sh [--skip-gate]"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

fail=0
ok() { echo "OK   $*"; }
bad() { echo "FAIL $*"; fail=1; }

echo "== Zero SQLite W3 P5 verify =="
echo ""

if [[ "$SKIP_GATE" -eq 0 ]]; then
  "$ROOT/scripts/ci_zero_sqlite_w3_gate.sh"
  echo ""
fi

NEST_SRC="$ROOT/services/ptt-crm-api/src"

# W3-V01 — Nest zero `new DatabaseSync` outside specs (Wave 4 complete)
STRAGGLER_LIST=""
while IFS= read -r -d '' f; do
  [[ "$f" == *sqlite.repository.ts ]] && continue
  [[ "$f" == *.spec.ts ]] && continue
  [[ "$f" == *sqlite-leads* ]] && continue
  grep -q 'new DatabaseSync' "$f" 2>/dev/null || continue
  STRAGGLER_LIST+="${f#$NEST_SRC/}"$'\n'
done < <(find "$NEST_SRC" -name '*.ts' -print0 2>/dev/null || true)
STRAGGLER_LIST="$(printf '%s' "$STRAGGLER_LIST" | sed '/^$/d' | sort -u)"

STRAGGLER_COUNT=0
if [[ -n "$STRAGGLER_LIST" ]]; then
  STRAGGLER_COUNT="$(printf '%s\n' "$STRAGGLER_LIST" | sed '/^$/d' | wc -l | tr -d ' ')"
fi

if [[ "$STRAGGLER_COUNT" -ne 0 ]]; then
  bad "W3-V01 Nest new DatabaseSync outside specs count=$STRAGGLER_COUNT (expected 0)"
  printf '%s\n' "$STRAGGLER_LIST" | sed 's/^/       /'
else
  ok "W3-V01 Nest zero new DatabaseSync outside specs (Wave 4)"
fi

# W3-V02 — AI intelligence PG-only
AI_DS=0
if [[ -d "$NEST_SRC/ai-intelligence" ]]; then
  AI_DS="$( { grep -r 'DatabaseSync' "$NEST_SRC/ai-intelligence" 2>/dev/null || true; } | wc -l | tr -d ' \n')"
fi
if [[ "${AI_DS:-0}" -eq 0 ]]; then
  ok "W3-V02 ai-intelligence/ zero DatabaseSync"
else
  bad "W3-V02 ai-intelligence/ has DatabaseSync matches: $AI_DS"
fi

# W3-V03 — e2e PG bootstrap library
E2E_FILES=(e2e_pg_bootstrap.sh e2e_pg_seed_minimal.sh seed_crm_e2e_pg.py)
V03_OK=1
for f in "${E2E_FILES[@]}"; do
  p="$ROOT/scripts/$f"
  if [[ ! -f "$p" ]]; then
    bad "W3-V03 missing scripts/$f"
    V03_OK=0
  fi
done
if [[ "$V03_OK" -eq 1 ]]; then
  ok "W3-V03 PG e2e bootstrap library (${#E2E_FILES[@]} files)"
fi

# W3-V04 — deprecated dual-run
_dual_rc=0
PTT_SQLITE_DISABLED=1 PTT_FLASK_MONOLITH_MODE=retired \
  "$ROOT/scripts/local_dual_run_check.sh" >/dev/null 2>&1 || _dual_rc=$?
if [[ "$_dual_rc" -eq 0 ]]; then
  bad "W3-V04 local_dual_run_check.sh should fail when sqlite disabled"
else
  ok "W3-V04 dual-run deprecated when PTT_SQLITE_DISABLED=1"
fi

REPORT="$PTT_ARTIFACTS_DIR/zero-sqlite-w3-p5-verify-report.json"
STRAGGLERS_JSON="$(printf '%s\n' "$STRAGGLER_LIST" | sed '/^$/d' | "$PYTHON" -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')"
export W3_VERIFY_FAIL="$fail"
export W3_VERIFY_STRAGGLER_COUNT="$STRAGGLER_COUNT"
export W3_VERIFY_STRAGGLERS_JSON="$STRAGGLERS_JSON"
export W3_VERIFY_AI_DS="$AI_DS"
export W3_VERIFY_E2E_COUNT="${#E2E_FILES[@]}"
export W3_VERIFY_REPORT="$REPORT"
"$PYTHON" - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

fail = os.environ.get("W3_VERIFY_FAIL", "1")
report = {
    "phase": "zero-sqlite-w3-p5",
    "ok": fail == "0",
    "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "checks": {
        "nest_straggler_count": int(os.environ.get("W3_VERIFY_STRAGGLER_COUNT", "0")),
        "nest_stragglers": json.loads(os.environ.get("W3_VERIFY_STRAGGLERS_JSON", "[]")),
        "ai_intelligence_database_sync": int(os.environ.get("W3_VERIFY_AI_DS", "0")),
        "e2e_bootstrap_files": int(os.environ.get("W3_VERIFY_E2E_COUNT", "0")),
    },
    "notes": "W3-V01 expects zero new DatabaseSync outside specs after Wave 4; prod routes must not 503 sqlite_disabled",
}
out = Path(os.environ["W3_VERIFY_REPORT"])
out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(f"Report → {report['ok']=} → {out}")
if not report["ok"]:
    raise SystemExit(1)
PY

echo ""
if [[ "$fail" -ne 0 ]]; then
  echo "Zero SQLite W3 P5 verify: FAIL"
  exit 1
fi
echo "Zero SQLite W3 P5 verify: PASS"
exit 0

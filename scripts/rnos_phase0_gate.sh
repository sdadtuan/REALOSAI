#!/usr/bin/env bash
# RNOS Gate Phase 0 — DDL (RNOS-01) + timeline ≥70% + attribution ≥80% + audit smoke
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="${ROOT}${PYTHONPATH:+:$PYTHONPATH}"

ENV_FILE="${RNOS01_ENV:-$ROOT/deploy/env.local.example}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required — source deploy/env.local.example}"

# shellcheck source=scripts/rnosai_pg_guard.sh
source "$ROOT/scripts/rnosai_pg_guard.sh"
rnosai_assert_database_url "$DATABASE_URL"

APPLY_DDL="${APPLY_DDL:-0}"
SEED_LOCAL="${SEED_LOCAL:-0}"
REPORT="${REPORT:-$ROOT/.local-dev/rnos-phase0-gate-report.json}"
MIN_SAMPLE="${MIN_SAMPLE:-50}"

mkdir -p "$(dirname "$REPORT")"

echo "== RNOS Gate Phase 0 =="
echo "   DATABASE_URL=${DATABASE_URL%%@*}@***"
echo "   APPLY_DDL=$APPLY_DDL  SEED_LOCAL=$SEED_LOCAL  MIN_SAMPLE=$MIN_SAMPLE"

echo ""
echo "==> RNOS-01 DDL gate"
if [[ "$APPLY_DDL" == "1" ]]; then
  APPLY=1 bash "$ROOT/scripts/rnos01_pg_ddl_gate.sh"
else
  APPLY=0 bash "$ROOT/scripts/rnos01_pg_ddl_gate.sh"
fi

if [[ "$SEED_LOCAL" == "1" ]]; then
  echo ""
  echo "==> Seed local pilot sample (≥${MIN_SAMPLE} leads)"
  python3 "$ROOT/scripts/rnos_phase0_seed_local_sample.py" --count "$MIN_SAMPLE"
fi

echo ""
echo "==> Phase 0 metrics gate"
python3 - <<PY
import json
import os
import sys
from pathlib import Path

from ptt_crm.rnos_phase0_gates import build_phase0_gate_report, write_phase0_gate_report

report = build_phase0_gate_report(min_sample=int(os.environ.get("MIN_SAMPLE", "50")))
path = Path("$REPORT")
write_phase0_gate_report(str(path), report)

print(f"Report: {path}")
for check in report["checks"]:
    status = "OK  " if check["ok"] else "FAIL"
    print(f"{status} {check['id']} {check['label']}")
    detail = check.get("detail") or {}
    if "completeness_pct" in detail:
        print(f"      timeline {detail.get('leads_with_timeline')}/{detail.get('total_leads')} = {detail.get('completeness_pct')}%")
    if "attribution_pct" in detail:
        print(f"      attribution {detail.get('attributed_leads')}/{detail.get('total_leads')} = {detail.get('attribution_pct')}%")

if not report["ok"]:
    print("")
    print("Hint: local empty DB → SEED_LOCAL=1 bash scripts/rnos_phase0_gate.sh")
    sys.exit(1)

print("")
print("RNOS Gate Phase 0 PASSED")
PY

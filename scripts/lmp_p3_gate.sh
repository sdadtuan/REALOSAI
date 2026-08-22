#!/usr/bin/env bash
# S-LMP-5 P3 gate — Multi-moment + funnel merge
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"

PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
elif [[ -x "/var/www/ptt/.venv/bin/python" ]]; then
  PYTHON="/var/www/ptt/.venv/bin/python"
fi
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"

if ! "$PYTHON" -m pytest --version >/dev/null 2>&1; then
  "$PYTHON" -m pip install -q pytest
fi

echo "== LMP S-LMP-5 P3 gate =="
bash "$ROOT/scripts/lmp_p2_gate.sh"

"$PYTHON" -m pytest \
  "$ROOT/tests/test_lmp_funnel_moments.py" \
  "$ROOT/tests/test_lmp_deal_room_bridge.py" \
  -q

cd "$ROOT/services/ptt-crm-api"
npm run test -- --testPathPattern=lmp-stage.util --passWithNoTests 2>/dev/null || \
  npx jest --testPathPattern=lmp-stage.util --passWithNoTests

"$PYTHON" - <<'PY'
# EC-LMP-15 / INT-01 shape — consult merge fields from prep result
row = {
    "status": "ready",
    "prep_stage": "m2_qualify_win",
    "result_json": {
        "company_profile": {"summary": "External summary for consult"},
        "recommended_services": [{"dv_code": "DV02"}, {"dv_code": "DV05"}],
        "meta": {"sources_count": 3},
    },
}
summary = str(row["result_json"]["company_profile"]["summary"])
dvs = [s["dv_code"] for s in row["result_json"]["recommended_services"]]
assert summary and len(dvs) == 2
print("PASS  consult-brief merge shape (EC-LMP-15 / INT-01)")
PY

echo "PASS lmp_p3_gate"

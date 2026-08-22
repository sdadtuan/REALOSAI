#!/usr/bin/env bash
# S-LMP-3 P1 gate — Close Intelligence + Cockpit
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

echo "== LMP S-LMP-3 P1 gate =="
bash "$ROOT/scripts/lead_meeting_prep_gate.sh"

"$PYTHON" -m pytest "$ROOT/tests/test_lmp_offer_ladder.py" "$ROOT/tests/test_lmp_close_intelligence.py" -q

"$PYTHON" - <<'PY'
from ptt_crm.lead_meeting_prep.synthesize import build_stub_llm_result
from ptt_crm.lead_meeting_prep.collect import collect_company
from ptt_crm.lead_meeting_prep import close_intelligence
inp = {"lead_id": 1, "company_name": "Cty Gate", "industry": "BDS", "problem": "Can lead", "phone": "0901234567"}
collect = collect_company(inp)
base = build_stub_llm_result(inp, collect, verify_website=None, prep_stage="m1_first_strike")
close_intelligence.enrich_close_intelligence(base, inp, collect, prep_stage="m1_first_strike")
sci = base["close_intelligence"]
assert len(sci["offer_ladder"]) == 3
assert sci["offer_ladder"][1]["anchor_role"] == "recommended"
assert len(sci["talk_track"]["phases"]) >= 3
assert base["contact_profile"]["found"] is False
print("PASS  close_intelligence shape")
PY

TABLE=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='crm_lead_meeting_prep_feedback'")
[[ "$TABLE" == "1" ]] && echo "PASS  feedback table" || { echo "FAIL  feedback table"; exit 1; }

echo "PASS lmp_p1_gate"

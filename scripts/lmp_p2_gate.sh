#!/usr/bin/env bash
# S-LMP-4 P2 gate — Deal Close bridge (SCI → Deal Room + quote 3 gói)
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

echo "== LMP S-LMP-4 P2 gate =="
bash "$ROOT/scripts/lmp_p1_gate.sh"

"$PYTHON" -m pytest \
  "$ROOT/tests/test_lmp_deal_room_bridge.py" \
  "$ROOT/tests/test_lmp_offer_ladder.py" \
  -q

"$PYTHON" - <<'PY'
from ptt_crm.lead_meeting_prep import close_intelligence, playbook_rag
from ptt_crm.lead_meeting_prep.synthesize import build_stub_llm_result
from ptt_crm.lead_meeting_prep.collect import collect_company

inp = {
    "lead_id": 99,
    "company_name": "Cty P2 Gate",
    "industry": "Bất động sản",
    "problem": "Lead rác cao",
    "phone": "0901234567",
}
collect = collect_company(inp)
base = build_stub_llm_result(inp, collect, verify_website=None, prep_stage="m3_pre_close")
close_intelligence.enrich_close_intelligence(base, inp, collect, prep_stage="m3_pre_close")
sci = base["close_intelligence"]
assert sci.get("deal_room_payload"), "EC-LMP-16 deal_room_payload"
assert len(sci["offer_ladder"]) == 3
slug = sci["competitive_angle"].get("playbook_slug")
if slug:
    print(f"PASS  playbook slug matched: {slug}")
else:
    print("PASS  playbook slug optional (no catalog)")
print("PASS  m3 close intelligence + deal_room_payload")
PY

echo "PASS lmp_p2_gate"

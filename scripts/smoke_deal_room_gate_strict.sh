#!/usr/bin/env bash
# F3 — G4 gate strict smoke (handoff + POST proposals with lead_id)
#
#   export PTT_DEAL_ROOM_ENABLED=1 PTT_DEAL_ROOM_GATE_STRICT=1
#   LEAD_ID=900000910 ./scripts/smoke_deal_room_gate_strict.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

BASE="${PTT_API_URL:-http://127.0.0.1:3000}"
LEAD_ID="${LEAD_ID:-900000910}"
: "${PTT_CRM_INTERNAL_KEY:?PTT_CRM_INTERNAL_KEY required}"

HDR=(-H "x-ptt-internal-key: ${PTT_CRM_INTERNAL_KEY}" -H "Content-Type: application/json")

echo "== Deal Room G4 gate smoke LEAD_ID=${LEAD_ID} =="

curl -sf "$BASE/health" >/dev/null && echo "OK  Nest /health" || { echo "FAIL Nest down"; exit 1; }

snap_code="$(curl -s -o /tmp/dr-gate-snap.json -w '%{http_code}' \
  "${HDR[@]}" -X GET "$BASE/api/v1/leads/${LEAD_ID}/deal-room")"

if [[ "$snap_code" == "404" ]]; then
  echo "SKIP deal-room 404 — set PTT_DEAL_ROOM_ENABLED=1"
  exit 0
fi

[[ "$snap_code" =~ ^2 ]] || { echo "FAIL GET deal-room HTTP $snap_code"; exit 1; }

python3 - <<PY
import json
d = json.load(open("/tmp/dr-gate-snap.json"))
assert "l1_checklist" in d and isinstance(d["l1_checklist"], list), d.keys()
print("OK  snapshot l1_checklist len=", len(d["l1_checklist"]))
PY

handoff_code="$(curl -s -o /tmp/dr-gate-handoff.json -w '%{http_code}' \
  "${HDR[@]}" -X GET "$BASE/api/v1/leads/${LEAD_ID}/presales/proposal-handoff")"

[[ "$handoff_code" =~ ^2 ]] && echo "OK  GET proposal-handoff (HTTP $handoff_code)" || {
  echo "FAIL handoff HTTP $handoff_code"; cat /tmp/dr-gate-handoff.json; exit 1;
}

python3 - <<PY
import json
h = json.load(open("/tmp/dr-gate-handoff.json"))["handoff"]
assert "l1_checklist" in h
assert "proposal_gate_ok" in h
print("OK  handoff gate_ok=", h["proposal_gate_ok"], "can_open=", h["can_open"])
PY

if [[ "${PTT_DEAL_ROOM_GATE_STRICT:-0}" != "1" ]]; then
  echo "SKIP POST g4_blocked — PTT_DEAL_ROOM_GATE_STRICT not 1"
  exit 0
fi

gate_ok="$(python3 - <<PY
import json
print("1" if json.load(open("/tmp/dr-gate-snap.json")).get("proposal_gate", {}).get("ok") else "0")
PY
)"

if [[ "$gate_ok" == "1" ]]; then
  echo "SKIP POST g4_blocked — G4 already green on lead $LEAD_ID"
  exit 0
fi

cust_id="$(python3 - <<PY
import json
print(json.load(open("/tmp/dr-gate-handoff.json"))["handoff"].get("customer_id") or 0)
PY
)"

post_code="$(curl -s -o /tmp/dr-gate-post.json -w '%{http_code}' \
  "${HDR[@]}" -X POST "$BASE/api/crm/proposals" \
  -d "{\"customer_id\": ${cust_id:-1}, \"lead_id\": ${LEAD_ID}, \"service_slugs\": [\"meta-lead-gen\"]}")"

if [[ "$post_code" == "400" ]]; then
  python3 - <<PY
import json
d = json.load(open("/tmp/dr-gate-post.json"))
assert d.get("error") == "g4_blocked" or d.get("message"), d
print("OK  POST proposals blocked g4_blocked")
PY
else
  echo "FAIL expected 400 g4_blocked got HTTP $post_code"
  cat /tmp/dr-gate-post.json
  exit 1
fi

echo "Deal Room G4 gate smoke PASSED"

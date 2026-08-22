#!/usr/bin/env bash
# Deal Room F1 smoke — GET /api/v1/leads/:id/deal-room
#
#   export PTT_DEAL_ROOM_ENABLED=1
#   LEAD_ID=900000910 ./scripts/smoke_deal_room.sh
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

HDR=(-H "x-ptt-internal-key: ${PTT_CRM_INTERNAL_KEY}")

echo "== Deal Room smoke LEAD_ID=${LEAD_ID} BASE=${BASE} =="

curl -sf "$BASE/health" >/dev/null && echo "OK  Nest /health" || { echo "FAIL Nest down"; exit 1; }

code="$(curl -s -o /tmp/deal-room-smoke.json -w '%{http_code}' \
  "${HDR[@]}" "$BASE/api/v1/leads/${LEAD_ID}/deal-room")"

if [[ "$code" == "404" ]]; then
  echo "SKIP deal-room 404 — set PTT_DEAL_ROOM_ENABLED=1 and restart API"
  exit 0
fi

[[ "$code" =~ ^2 ]] && echo "OK  GET deal-room (HTTP $code)" || { echo "FAIL GET deal-room HTTP $code"; cat /tmp/deal-room-smoke.json; exit 1; }

python3 - <<PY
import json, sys
d = json.load(open("/tmp/deal-room-smoke.json"))
assert d.get("ok") is True, d
assert d.get("lead_id") == ${LEAD_ID}, d.get("lead_id")
assert "l1_checklist" in d and isinstance(d["l1_checklist"], list), d.keys()
assert "gates" in d and "g4_r5" in d["gates"], d.keys()
assert "marketing_plan" in d and "consult_progress" in d
print("OK  snapshot gates + marketing_plan + consult_progress")
print(json.dumps({"deal_room_smoke": True, "lead_id": d["lead_id"], "g4": d["gates"]["g4_r5"]["status"]}, ensure_ascii=False))
PY

echo "Deal Room smoke PASSED"

#!/usr/bin/env bash
# Deal Room F2 — POST export-pack → PDF
#
#   export PTT_DEAL_ROOM_ENABLED=1 PTT_DEAL_ROOM_PACK_PDF=1
#   LEAD_ID=900000910 ./scripts/smoke_deal_room_pack_pdf.sh
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

echo "== Deal Room Pack PDF smoke LEAD_ID=${LEAD_ID} BASE=${BASE} =="

curl -sf "$BASE/health" >/dev/null && echo "OK  Nest /health" || { echo "FAIL Nest down"; exit 1; }

snap_code="$(curl -s -o /tmp/deal-room-pack-snap.json -w '%{http_code}' \
  "${HDR[@]}" -X GET "$BASE/api/v1/leads/${LEAD_ID}/deal-room")"

if [[ "$snap_code" == "404" ]]; then
  echo "SKIP deal-room 404 — set PTT_DEAL_ROOM_ENABLED=1 and restart API"
  exit 0
fi

if [[ ! "$snap_code" =~ ^2 ]]; then
  echo "FAIL GET deal-room HTTP $snap_code"
  cat /tmp/deal-room-pack-snap.json
  exit 1
fi

can_export="$(python3 - <<PY
import json
d = json.load(open("/tmp/deal-room-pack-snap.json"))
print("1" if d.get("actions", {}).get("can_export_pack") else "0")
PY
)"

if [[ "$can_export" != "1" ]]; then
  echo "SKIP export-pack — G4 chưa xanh hoặc PTT_DEAL_ROOM_PACK_PDF=0"
  echo "    Chạy: ./scripts/seed_workshop_buoi1_sandbox_lead.sh --consult (điền R5 đủ G4)"
  exit 0
fi

code="$(curl -s -o /tmp/deal-room-pack.pdf -w '%{http_code}' \
  "${HDR[@]}" -X POST "$BASE/api/v1/leads/${LEAD_ID}/deal-room/export-pack" \
  -d '{"include_timeline":true}')"

if [[ "$code" == "403" ]]; then
  echo "SKIP export-pack 403 — bật PTT_DEAL_ROOM_PACK_PDF=1"
  exit 0
fi

[[ "$code" =~ ^2 ]] && echo "OK  POST export-pack (HTTP $code)" || {
  echo "FAIL POST export-pack HTTP $code"
  head -c 500 /tmp/deal-room-pack.pdf
  exit 1
}

python3 - <<PY
from pathlib import Path
p = Path("/tmp/deal-room-pack.pdf")
data = p.read_bytes()
assert data[:5] == b"%PDF-", data[:20]
assert len(data) > 500, len(data)
print(f"OK  PDF size={len(data)} bytes header=%PDF-")
PY

echo "Deal Room Pack PDF smoke PASSED"

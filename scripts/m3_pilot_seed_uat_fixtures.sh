#!/usr/bin/env bash
# RNOS-M3 Phase 3 — Seed pending creative for push UAT (scenario 2-3)
#   export PTT_CRM_INTERNAL_KEY=... M3_PILOT_CLIENT_ID=...
#   bash scripts/m3_pilot_seed_uat_fixtures.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${M3_API_URL:-http://127.0.0.1:3000}"
API="${API%/}"
CLIENT_ID="${M3_PILOT_CLIENT_ID:-550e8400-e29b-41d4-a716-446655440000}"
TITLE="${M3_PILOT_CREATIVE_TITLE:-M3 Pilot UAT $(date +%Y%m%d-%H%M)}"
INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"

if [[ -z "$INTERNAL_KEY" ]]; then
  echo "FAIL  Set PTT_CRM_INTERNAL_KEY (or export from VPS vault)"
  exit 1
fi

echo "== RNOS-M3 seed UAT creative =="
echo "    client_id: $CLIENT_ID"
echo "    title:     $TITLE"

RESP="$(curl -sf -X POST "${API}/api/v1/creatives" \
  -H "Content-Type: application/json" \
  -H "X-PTT-Internal-Key: ${INTERNAL_KEY}" \
  -d "{\"client_id\":\"${CLIENT_ID}\",\"title\":\"${TITLE}\",\"description\":\"M3 Phase 3 pilot UAT — pending approval for native push test\"}" \
  2>&1)" || { echo "FAIL  POST /api/v1/creatives — $RESP"; exit 1; }

CREATIVE_ID="$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id') or d.get('creative',{}).get('id') or '')" 2>/dev/null || true)"

echo "OK  Creative submitted"
echo "    Response: $RESP"
if [[ -n "$CREATIVE_ID" ]]; then
  echo "    Deep link: pttads://approve/${CREATIVE_ID}"
  echo "    HTTPS:     https://portal.pttads.vn/creatives?focus=${CREATIVE_ID}"
fi

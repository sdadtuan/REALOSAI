#!/usr/bin/env bash
# WS-P4-05 — Portal plan summary read-only (MKTP-UC-023)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
LIFECYCLE_ID="${LIFECYCLE_ID:-1}"
KEY="${PTT_CRM_INTERNAL_KEY:-}"
PORTAL_EMAIL="${PORTAL_EMAIL:-${OPS_E2E_PORTAL_EMAIL:-}}"
PORTAL_PASS="${PORTAL_PASSWORD:-${OPS_E2E_PORTAL_PASSWORD:-}}"

echo "== smoke_mkt_ai_portal_summary =="
echo "api=$API_URL lifecycle=$LIFECYCLE_ID"

if [[ -z "$PORTAL_EMAIL" || -z "$PORTAL_PASS" ]]; then
  echo "SKIP portal JWT auth — set PORTAL_EMAIL + PORTAL_PASSWORD (or OPS_E2E_PORTAL_*)"
  exit 0
fi

TOKEN="$(
  curl -sf "$API_URL/api/v1/portal/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$PORTAL_EMAIL\",\"password\":\"$PORTAL_PASS\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true
)"
if [[ -z "$TOKEN" ]]; then
  echo "FAIL portal login"
  exit 1
fi

AUTH=(-H "Authorization: Bearer $TOKEN")

linked="$(curl -sf "${AUTH[@]}" "$API_URL/api/v1/portal/service-lifecycle/linked")"
echo "$linked" | grep -q '"enabled"' || { echo "FAIL linked shape"; exit 1; }

if echo "$linked" | grep -q '"enabled":false'; then
  echo "WARN PTT_MKT_AI_PORTAL_SUMMARY off — enable flag and retry"
  exit 0
fi

LID="$(echo "$linked" | python3 -c "import sys,json; print(json.load(sys.stdin).get('lifecycle_id') or '')" 2>/dev/null || true)"
if [[ -z "$LID" ]]; then
  LID="$LIFECYCLE_ID"
  echo "WARN no linked lifecycle — fallback LIFECYCLE_ID=$LID"
fi

summary="$(curl -sf "${AUTH[@]}" "$API_URL/api/v1/portal/service-lifecycle/$LID/ai-planner/summary")"
echo "$summary" | grep -q '"strategy_excerpt"' || { echo "FAIL summary shape"; exit 1; }
echo "$summary" | grep -q '"campaign_count"' || { echo "FAIL missing campaign_count"; exit 1; }

# Must not leak full draft keys
if echo "$summary" | grep -q 'campaigns_json'; then
  echo "FAIL draft JSON leaked"
  exit 1
fi

excerpt_len="$(echo "$summary" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('strategy_excerpt') or ''))" 2>/dev/null || echo 0)"
[[ "$excerpt_len" -le 500 ]] || { echo "FAIL excerpt >500 chars ($excerpt_len)"; exit 1; }

# Wrong lifecycle should 403 when client mismatch
if [[ -n "$KEY" ]]; then
  wrong_id="$((LID + 9999))"
  code="$(curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" "$API_URL/api/v1/portal/service-lifecycle/$wrong_id/ai-planner/summary")"
  [[ "$code" == "403" || "$code" == "404" ]] && echo "OK scope guard HTTP $code" || echo "WARN scope guard HTTP $code"
fi

echo "PASS smoke_mkt_ai_portal_summary"

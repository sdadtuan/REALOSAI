#!/usr/bin/env bash
# Smoke M10 — metrics CRUD + intelligence aggregate + topic suggest
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

API_BASE="${PTT_API_URL:-http://127.0.0.1:3000}"
LIFECYCLE_ID="${LIFECYCLE_ID:-}"
TOKEN="${STAFF_JWT:-${CRM_STAFF_TOKEN:-}}"
INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"
EMAIL="${ADMIN_EMAIL:-${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}}"
PASS="${ADMIN_PASSWORD:-${OPS_E2E_STAFF_PASSWORD:-}}"

AUTH=()
if [[ -n "$INTERNAL_KEY" ]]; then
  AUTH=(-H "x-ptt-internal-key: $INTERNAL_KEY")
elif [[ -z "$TOKEN" && -n "$PASS" ]]; then
  TOKEN="$(
    curl -sf "$API_BASE/api/v1/staff/auth/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true
  )"
fi
if [[ -n "$TOKEN" && ${#AUTH[@]} -eq 0 ]]; then
  AUTH=(-H "Authorization: Bearer $TOKEN")
fi
if [[ ${#AUTH[@]} -eq 0 ]]; then
  echo "Set STAFF_JWT, ADMIN_PASSWORD, or PTT_CRM_INTERNAL_KEY"
  exit 1
fi

if [[ -z "$LIFECYCLE_ID" ]]; then
  LIFECYCLE_ID="$(
    curl -sf "$API_BASE/api/crm/service-lifecycle?include_draft=1" "${AUTH[@]}" \
    | python3 -c "
import sys, json
ls = json.load(sys.stdin).get('lifecycles') or []
pref = [x for x in ls if str(x.get('service_slug','')) == 'tiep-thi-noi-dung']
pick = pref[0] if pref else (ls[0] if ls else None)
print(pick['id'] if pick else '')
" 2>/dev/null || true
  )"
fi
if [[ -z "$LIFECYCLE_ID" ]]; then
  echo "FAIL set LIFECYCLE_ID"
  exit 1
fi

BASE="$API_BASE/api/crm/service-lifecycle/$LIFECYCLE_ID/content-marketing"
echo "==> M10 intelligence smoke lifecycle #$LIFECYCLE_ID"

ITEM_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"M10 metrics smoke","channel":"facebook","format":"social_post","body_json":{"markdown":"Body"}}' \
  -X POST "$BASE/items")"
ITEM_ID="$(echo "$ITEM_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"

curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/submit-review" >/dev/null
curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/approve" >/dev/null
curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"published_url":"https://example.com/m10-smoke"}' \
  -X POST "$BASE/items/$ITEM_ID/publish" >/dev/null

METRIC="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"metric_date":"2026-08-09","impressions":1200,"engagements":96,"clicks":24,"leads":3}' \
  -X POST "$BASE/items/$ITEM_ID/metrics")"
METRIC_ID="$(echo "$METRIC" | python3 -c "import sys,json; print(json.load(sys.stdin)['metric']['id'])")"

INTEL="$(curl -sf "${AUTH[@]}" "$BASE/intelligence?range=30d")"
COUNT="$(echo "$INTEL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('metrics_count',0))")"
if [[ "$COUNT" -lt 1 ]]; then
  echo "FAIL intelligence metrics_count=$COUNT expected >=1"
  exit 1
fi

ENG="$(echo "$INTEL" | python3 -c "import sys,json; d=json.load(sys.stdin).get('by_channel',{}).get('facebook',{}); print(d.get('engagements',0))")"
if [[ "$ENG" -lt 96 ]]; then
  echo "FAIL intelligence facebook engagements=$ENG"
  exit 1
fi

JOB="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"range":"30d"}' -X POST "$BASE/jobs/topic-suggest")"
JOB_STATUS="$(echo "$JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
if [[ "$JOB_STATUS" != "succeeded" ]]; then
  echo "FAIL topic-suggest status=$JOB_STATUS"
  exit 1
fi

SUG="$(curl -sf "${AUTH[@]}" "$BASE/intelligence/suggestions?range=30d")"
SCOUNT="$(echo "$SUG" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('suggestions') or []))")"
if [[ "$SCOUNT" -lt 1 ]]; then
  echo "FAIL suggestions empty"
  exit 1
fi

echo "PASS M10 intelligence smoke — item #$ITEM_ID metric #$METRIC_ID reflected in intelligence"

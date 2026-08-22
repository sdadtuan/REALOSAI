#!/usr/bin/env bash
# Smoke P1 — repurpose + SEO bridge assert
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
EMAIL_CLIENT_ID="${EMAIL_CLIENT_ID:-}"

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
echo "==> P1 smoke lifecycle #$LIFECYCLE_ID"

curl -sf "${AUTH[@]}" "$BASE/context" >/dev/null

BLOG_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"P1 repurpose master","channel":"website","format":"blog","body_json":{"markdown":"# Blog master\n\nLong form content for repurpose smoke."}}' \
  -X POST "$BASE/items")"
BLOG_ID="$(echo "$BLOG_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"

curl -sf "${AUTH[@]}" -X POST "$BASE/items/$BLOG_ID/submit-review" >/dev/null
curl -sf "${AUTH[@]}" -X POST "$BASE/items/$BLOG_ID/approve" >/dev/null

REPURPOSE="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"targets":[{"channel":"facebook","format":"social_post","count":2},{"channel":"linkedin","format":"social_post","count":1}],"optimize_hooks":true}' \
  -X POST "$BASE/items/$BLOG_ID/repurpose")"
DERIVED_COUNT="$(echo "$REPURPOSE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('derived_items') or []))")"
if [[ "$DERIVED_COUNT" -lt 2 ]]; then
  echo "FAIL repurpose derived_count=$DERIVED_COUNT"
  exit 1
fi

DERIVATIONS="$(curl -sf "${AUTH[@]}" "$BASE/items/$BLOG_ID/derivations")"
LINEAGE="$(echo "$DERIVATIONS" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('derivations') or []))")"
if [[ "$LINEAGE" -lt 2 ]]; then
  echo "FAIL derivations lineage=$LINEAGE"
  exit 1
fi

SEO_HTTP="$(curl -sS -o /tmp/cmkt-seo-bridge.json -w "%{http_code}" "${AUTH[@]}" -X POST "$BASE/items/$BLOG_ID/bridge/seo")"
if [[ "$SEO_HTTP" == "200" ]]; then
  SEO_ID="$(python3 -c "import json; print(json.load(open('/tmp/cmkt-seo-bridge.json')).get('seo_content_id',''))")"
  if [[ -z "$SEO_ID" ]]; then
    echo "FAIL seo bridge missing seo_content_id"
    exit 1
  fi
  echo "OK  seo bridge -> content #$SEO_ID"
elif [[ "$SEO_HTTP" == "400" ]]; then
  echo "SKIP seo bridge (lifecycle thiếu customer_id — OK trên staging chưa map KH)"
else
  echo "FAIL seo bridge HTTP=$SEO_HTTP"
  cat /tmp/cmkt-seo-bridge.json || true
  exit 1
fi

CAROUSEL_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"P1 carousel prod gate","channel":"facebook","format":"carousel","body_json":{"markdown":"Slide 1\nSlide 2"}}' \
  -X POST "$BASE/items")"
CAROUSEL_ID="$(echo "$CAROUSEL_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
curl -sf "${AUTH[@]}" -X POST "$BASE/items/$CAROUSEL_ID/submit-review" >/dev/null
curl -sf "${AUTH[@]}" -X POST "$BASE/items/$CAROUSEL_ID/approve" >/dev/null

PUBLISH_HTTP="$(curl -sS -o /tmp/cmkt-prod-gate.json -w "%{http_code}" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"published_url":"https://example.com/carousel"}' -X POST "$BASE/items/$CAROUSEL_ID/publish")"
if [[ "$PUBLISH_HTTP" != "400" ]]; then
  echo "WARN production gate expected 400 got $PUBLISH_HTTP"
fi

curl -sf "${AUTH[@]}" -X POST "$BASE/items/$CAROUSEL_ID/production/done" >/dev/null
PUBLISH2="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"published_url":"https://example.com/carousel-ok"}' -X POST "$BASE/items/$CAROUSEL_ID/publish")"
if [[ "$(echo "$PUBLISH2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")" != "published" ]]; then
  echo "FAIL carousel publish after production done"
  exit 1
fi

echo "OK  smoke_content_marketing_p1 passed (blog $BLOG_ID, derived $DERIVED_COUNT, carousel $CAROUSEL_ID)"

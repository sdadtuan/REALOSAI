#!/usr/bin/env bash
# Smoke — Video SOP S9: delivery + review links BR-14/BR-15
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

if [[ "${PTT_CMKT_VIDEO_CINEMATIC:-0}" != "1" ]]; then
  echo "SKIP cinematic off"
  exit 0
fi

API_BASE="${PTT_API_URL:-http://127.0.0.1:3000}"
LIFECYCLE_ID="${LIFECYCLE_ID:-3}"
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

echo "==> Video SOP S9 smoke lifecycle #$LIFECYCLE_ID"

LIST_BODY="/tmp/vd-sop-s9-projects.json"
curl -sS -o "$LIST_BODY" "${AUTH[@]}" \
  "$API_BASE/api/v1/vd/projects?lifecycle_id=$LIFECYCLE_ID" >/dev/null
if grep -q 'cmkt_cinematic_disabled' "$LIST_BODY"; then
  echo "SKIP cinematic off"
  exit 0
fi

PROJ_ID="$(
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
items = p if isinstance(p, list) else (p.get('items') or [])
ids = [it['id'] for it in items if isinstance(it, dict) and isinstance(it.get('id'), int) and it['id'] > 0]
if ids:
    print(ids[0])
" "$LIST_BODY"
)"

if [[ -z "$PROJ_ID" ]]; then
  echo "FAIL no reusable project"
  exit 1
fi

ASSET_ID="$(
  curl -sS "${AUTH[@]}" "$API_BASE/api/v1/vd/projects/$PROJ_ID/keyframes" \
  | python3 -c "
import json, sys
try:
    rows = json.load(sys.stdin)
except Exception:
    rows = []
if isinstance(rows, dict):
    rows = rows.get('items') or []
ids = [int(r['id']) for r in rows if isinstance(r, dict) and str(r.get('id', '')).isdigit()]
print(ids[0] if ids else 1)
" 2>/dev/null || echo 1
)"

LINK_BODY="/tmp/vd-sop-s9-link.json"
LINK_CODE="$(
  curl -sS -o "$LINK_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d "{\"project_id\":$PROJ_ID,\"gate_no\":4,\"asset_ids\":[$ASSET_ID],\"ttl_days\":14}" \
    -X POST "$API_BASE/api/v1/vd/review-links"
)"
if [[ "$LINK_CODE" != "201" ]]; then
  echo "FAIL review link expected 201 got $LINK_CODE"
  cat "$LINK_BODY" >&2 || true
  exit 1
fi

REVIEW_TOKEN="$(
  python3 -c "import json,sys; print(json.load(open(sys.argv[1],encoding='utf-8')).get('token',''))" "$LINK_BODY"
)"

EXPIRED_CODE="$(
  curl -sS -o /tmp/vd-sop-s9-expired.json -w '%{http_code}' \
    "$API_BASE/api/v1/public/vd/review/expired-smoke-token-s9"
)"
if [[ "$EXPIRED_CODE" != "403" && "$EXPIRED_CODE" != "404" ]]; then
  echo "FAIL expired token expected 403/404 got $EXPIRED_CODE"
  exit 1
fi

PUBLIC_CODE="$(
  curl -sS -o /tmp/vd-sop-s9-public.json -w '%{http_code}' \
    "$API_BASE/api/v1/public/vd/review/$REVIEW_TOKEN"
)"
if [[ "$PUBLIC_CODE" != "200" ]]; then
  echo "FAIL public review expected 200 got $PUBLIC_CODE"
  cat /tmp/vd-sop-s9-public.json >&2 || true
  exit 1
fi

TTL_FAIL_CODE="$(
  curl -sS -o /tmp/vd-sop-s9-ttl.json -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d "{\"project_id\":$PROJ_ID,\"gate_no\":4,\"asset_ids\":[$ASSET_ID],\"ttl_days\":15}" \
    -X POST "$API_BASE/api/v1/vd/review-links"
)"
if [[ "$TTL_FAIL_CODE" != "400" ]]; then
  echo "FAIL ttl_days=15 expected 400 got $TTL_FAIL_CODE"
  exit 1
fi

echo "OK Video SOP S9 — project #$PROJ_ID link token ${REVIEW_TOKEN:0:12}…"

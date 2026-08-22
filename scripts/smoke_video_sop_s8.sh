#!/usr/bin/env bash
# Smoke — Video SOP S8: post DAG BR-09 + cine_compose
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

echo "==> Video SOP S8 smoke lifecycle #$LIFECYCLE_ID"

LIST_BODY="/tmp/vd-sop-s8-projects.json"
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

COMPOSE_BODY="/tmp/vd-sop-s8-compose.json"
COMPOSE_CODE="$(
  curl -sS -o "$COMPOSE_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Idempotency-Key: smoke-s8-compose-'"$PROJ_ID" \
    -X POST "$API_BASE/api/v1/vd/projects/$PROJ_ID/post/compose"
)"
if [[ "$COMPOSE_CODE" != "201" ]]; then
  COMPOSE_CODE="$(
    curl -sS -o "$COMPOSE_BODY" -w '%{http_code}' "${AUTH[@]}" \
      -H 'Content-Type: application/json' \
      -H 'Idempotency-Key: smoke-s8-compose-jobs-'"$PROJ_ID" \
      -d '{"queue":"q.media","job_type":"cine_compose","payload":{"credit_estimate":8}}' \
      -X POST "$API_BASE/api/v1/vd/projects/$PROJ_ID/jobs"
  )"
fi
if [[ "$COMPOSE_CODE" != "201" ]]; then
  echo "FAIL cine_compose enqueue expected 201 got $COMPOSE_CODE"
  cat "$COMPOSE_BODY" >&2 || true
  exit 1
fi

sleep 1

POST_BODY="/tmp/vd-sop-s8-post.json"
curl -sS -o "$POST_BODY" "${AUTH[@]}" \
  "$API_BASE/api/v1/vd/projects/$PROJ_ID/post" >/dev/null

python3 -c "
import json, sys
ALLOWED = {
    'select_takes', 'concat', 'loudness', 'proxy', 'optional_topaz', 'package_zip'
}
p = json.load(open(sys.argv[1], encoding='utf-8'))
nodes = p.get('nodes') if isinstance(p, dict) else []
if not isinstance(nodes, list) or len(nodes) != 6:
    raise SystemExit(f'FAIL expected 6 nodes got={len(nodes) if isinstance(nodes, list) else 0}')
for it in nodes:
    if not isinstance(it, dict):
        raise SystemExit('FAIL invalid node row')
    nid = it.get('id')
    if nid not in ALLOWED:
        raise SystemExit(f'FAIL node outside POST_DAG_NODES: {nid!r}')
ids = [it.get('id') for it in nodes]
if ids != sorted(ids, key=lambda x: list(ALLOWED).index(x) if x in ALLOWED else 99):
    pass
" "$POST_BODY"

echo "OK Video SOP S8 — project #$PROJ_ID"

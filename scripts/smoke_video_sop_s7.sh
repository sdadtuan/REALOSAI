#!/usr/bin/env bash
# Smoke — Video SOP S7: cost reserve BR-06 + ledger
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

echo "==> Video SOP S7 smoke lifecycle #$LIFECYCLE_ID"

LIST_BODY="/tmp/vd-sop-s7-projects.json"
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
  echo "FAIL no reusable project — run smoke_video_sop_s5.sh first"
  exit 1
fi

BUDGET_PUT_BODY="/tmp/vd-sop-s7-budget-put.json"
curl -sS -o "$BUDGET_PUT_BODY" "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"limit_amount":10,"buffer_factor":1.5,"overshoot_factor":2.5}' \
  -X PUT "$API_BASE/api/v1/vd/projects/$PROJ_ID/budget" >/dev/null

# reserve 20 via job enqueue → budget_exceeded (cap = 15)
OVER_BODY="/tmp/vd-sop-s7-over.json"
OVER_CODE="$(
  curl -sS -o "$OVER_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -H 'Idempotency-Key: smoke-s7-over-'"$PROJ_ID" \
    -d '{"queue":"q.image","job_type":"cine_keyframe","payload":{"credit_estimate":20,"prompt":"s7 over"}}' \
    -X POST "$API_BASE/api/v1/vd/projects/$PROJ_ID/jobs"
)"
if [[ "$OVER_CODE" != "400" ]]; then
  echo "FAIL reserve 20 expected 400 budget_exceeded got $OVER_CODE"
  cat "$OVER_BODY" >&2 || true
  exit 1
fi
python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
err = p.get('error') or p.get('message') or ''
if err != 'budget_exceeded':
    raise SystemExit(f'FAIL expected budget_exceeded got={err!r}')
" "$OVER_BODY"

# reserve 5 → 201 + ledger estimated
OK_BODY="/tmp/vd-sop-s7-ok.json"
OK_CODE="$(
  curl -sS -o "$OK_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -H 'Idempotency-Key: smoke-s7-ok-'"$PROJ_ID" \
    -d '{"queue":"q.image","job_type":"cine_keyframe","payload":{"credit_estimate":5,"prompt":"s7 ok"}}' \
    -X POST "$API_BASE/api/v1/vd/projects/$PROJ_ID/jobs"
)"
if [[ "$OK_CODE" != "201" ]]; then
  echo "FAIL reserve 5 expected 201 got $OK_CODE"
  cat "$OK_BODY" >&2 || true
  exit 1
fi

COSTS_BODY="/tmp/vd-sop-s7-costs.json"
curl -sS -o "$COSTS_BODY" "${AUTH[@]}" \
  "$API_BASE/api/v1/vd/projects/$PROJ_ID/costs" >/dev/null
python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
items = p.get('items') if isinstance(p, dict) else []
if not isinstance(items, list):
    items = []
has_est = any(isinstance(it, dict) and it.get('kind') == 'estimated' for it in items)
if not has_est:
    raise SystemExit('FAIL ledger missing estimated row')
" "$COSTS_BODY"

# export close=1 on active project → 400 project_not_closed
EXP_BODY="/tmp/vd-sop-s7-export.json"
EXP_CODE="$(
  curl -sS -o "$EXP_BODY" -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/projects/$PROJ_ID/costs/export.xlsx?close=1"
)"
if [[ "$EXP_CODE" != "400" ]]; then
  echo "FAIL export close=1 on active project expected 400 got $EXP_CODE"
  exit 1
fi

echo "OK Video SOP S7 — project #$PROJ_ID"

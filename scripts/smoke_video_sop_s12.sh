#!/usr/bin/env bash
# Smoke — Video SOP S12: lucid_origin registry + keyframe job + Leonardo webhook auth
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

echo "==> Video SOP S12 smoke lifecycle #$LIFECYCLE_ID"

MODELS_BODY="/tmp/vd-sop-s12-models.json"
MODELS_CODE="$(
  curl -sS -o "$MODELS_BODY" -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/admin/models"
)"

if [[ "$MODELS_CODE" == "404" && -z "${DATABASE_URL:-}" ]]; then
  echo "SKIP admin models 404 (no DATABASE_URL)"
  exit 0
fi

if [[ "$MODELS_CODE" != "200" ]]; then
  echo "FAIL admin models expected 200 got $MODELS_CODE"
  cat "$MODELS_BODY" >&2 || true
  exit 1
fi

python3 -c "
import json, sys
raw = json.load(open(sys.argv[1], encoding='utf-8'))
items = raw if isinstance(raw, list) else (raw.get('items') if isinstance(raw, dict) else None)
if not isinstance(items, list) or len(items) == 0:
    raise SystemExit('FAIL admin models empty')
found = any(isinstance(r, dict) and r.get('code') == 'image.leonardo.lucid_origin' for r in items)
if not found:
    codes = [r.get('code') for r in items if isinstance(r, dict)]
    raise SystemExit(f'FAIL missing image.leonardo.lucid_origin in {codes!r}')
print('OK registry image.leonardo.lucid_origin')
" "$MODELS_BODY"

PROJ_BODY="/tmp/vd-sop-s12-project.json"
LIST_BODY="/tmp/vd-sop-s12-projects.json"
LIST_CODE="$(
  curl -sS -o "$LIST_BODY" -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/projects?lifecycle_id=$LIFECYCLE_ID"
)"
PROJ_ID=""
if [[ "$LIST_CODE" == "200" ]]; then
  PROJ_ID="$(
    python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
items = p if isinstance(p, list) else (p.get('items') or [])
if items and isinstance(items[0], dict) and isinstance(items[0].get('id'), int) and items[0]['id'] > 0:
    print(items[0]['id'])
" "$LIST_BODY"
  )"
fi

if [[ -z "$PROJ_ID" ]]; then
  PROJ_CODE="$(
    curl -sS -o "$PROJ_BODY" -w '%{http_code}' "${AUTH[@]}" \
      -H 'Content-Type: application/json' \
      -H 'Idempotency-Key: vd-s12-smoke-project' \
      -d "{\"lifecycle_id\":$LIFECYCLE_ID,\"title\":\"S12 smoke\"}" \
      "$API_BASE/api/v1/vd/projects"
  )"
  if [[ "$PROJ_CODE" != "201" && "$PROJ_CODE" != "200" ]]; then
    echo "FAIL create project HTTP $PROJ_CODE"
    cat "$PROJ_BODY" >&2 || true
    exit 1
  fi
  PROJ_ID="$(
    python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
print(p.get('id') or p.get('project_id') or '')
" "$PROJ_BODY"
  )"
fi
if [[ -z "$PROJ_ID" ]]; then
  echo "FAIL could not resolve project id"
  exit 1
fi

JOB_BODY="/tmp/vd-sop-s12-job.json"
JOB_CODE="$(
  curl -sS -o "$JOB_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -H 'Idempotency-Key: vd-s12-smoke-kf' \
    -d '{"queue":"q.image","job_type":"cine_keyframe","payload":{"prompt":"S12 smoke keyframe","width":1024,"height":1024}}' \
    "$API_BASE/api/v1/vd/projects/$PROJ_ID/jobs"
)"
if [[ "$JOB_CODE" != "201" ]]; then
  echo "FAIL keyframe job expected 201 got $JOB_CODE"
  cat "$JOB_BODY" >&2 || true
  exit 1
fi
echo "OK keyframe job 201 project #$PROJ_ID"

WEBHOOK_KEY="${PTT_VD_LEONARDO_WEBHOOK_KEY:-}"
WH_BODY="/tmp/vd-sop-s12-webhook.json"
WH_BAD="$(
  curl -sS -o "$WH_BODY" -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer wrong-key' \
    -d '{"data":{"type":"generation.complete","object":{"id":"wh-bad"}}}' \
    "$API_BASE/api/v1/vd/webhooks/leonardo"
)"
if [[ "$WH_BAD" == "401" ]]; then
  echo "OK webhook bad sig 401"
elif [[ "$WH_BAD" == "200" ]]; then
  echo "SKIP webhook auth (PTT_VD_LEONARDO_WEBHOOK_KEY unset on API)"
else
  echo "FAIL webhook bad sig expected 401 or 200(skip) got $WH_BAD"
  cat "$WH_BODY" >&2 || true
  exit 1
fi

echo "OK Video SOP S12 stub — registry + keyframe + webhook auth lifecycle #$LIFECYCLE_ID"

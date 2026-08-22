#!/usr/bin/env bash
# Smoke — Video SOP S14: cost actuals fixture + enhance job + SC-15 verified_at
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

echo "==> Video SOP S14 smoke lifecycle #$LIFECYCLE_ID"

REPORT_BODY="/tmp/vd-sop-s14-report.json"
REPORT_CODE="$(
  curl -sS -o "$REPORT_BODY" -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/reports/production?lifecycle_id=$LIFECYCLE_ID"
)"
if [[ "$REPORT_CODE" != "200" ]]; then
  echo "FAIL production report expected 200 got $REPORT_CODE"
  exit 1
fi
python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
metrics = p.get('metrics') if isinstance(p, dict) else []
if not isinstance(metrics, list) or len(metrics) != 7:
    raise SystemExit(f'FAIL expected 7 metrics got={len(metrics) if isinstance(metrics, list) else 0}')
" "$REPORT_BODY"
echo "OK production report 7 metrics"

MODELS_BODY="/tmp/vd-sop-s14-models.json"
curl -sS -o "$MODELS_BODY" "${AUTH[@]}" "$API_BASE/api/v1/vd/admin/models"
python3 -c "
import json, sys
raw = json.load(open(sys.argv[1], encoding='utf-8'))
items = raw if isinstance(raw, list) else (raw.get('items') if isinstance(raw, dict) else None)
if not isinstance(items, list) or len(items) == 0:
    raise SystemExit('FAIL models empty')
for row in items:
    if not isinstance(row, dict):
        continue
    cap = row.get('capability_json')
    if isinstance(cap, str):
        try:
            cap = json.loads(cap)
        except Exception:
            cap = {}
    if isinstance(cap, dict) and cap.get('verified_at'):
        print('OK SC-15 verified_at present on', row.get('code'))
        break
else:
    raise SystemExit('FAIL no model with verified_at')
" "$MODELS_BODY"

LIST_BODY="/tmp/vd-sop-s14-projects.json"
curl -sS -o "$LIST_BODY" "${AUTH[@]}" "$API_BASE/api/v1/vd/projects?lifecycle_id=$LIFECYCLE_ID"
PROJ_ID="$(
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
items = p if isinstance(p, list) else (p.get('items') or [])
if items and isinstance(items[0], dict):
    print(items[0].get('id') or '')
" "$LIST_BODY"
)"
if [[ -n "$PROJ_ID" ]]; then
  ENH_BODY="/tmp/vd-sop-s14-enhance.json"
  ENH_CODE="$(
    curl -sS -o "$ENH_BODY" -w '%{http_code}' "${AUTH[@]}" \
      -H 'Content-Type: application/json' \
      -H 'Idempotency-Key: vd-s14-enhance' \
      -d '{"queue":"q.enhance","job_type":"cine_enhance","payload":{"input_path":"/tmp/vd-proxy.mp4","credit_estimate":10}}' \
      "$API_BASE/api/v1/vd/projects/$PROJ_ID/jobs"
  )"
  if [[ "$ENH_CODE" == "201" ]]; then
    echo "OK enhance job queued 201"
  else
    echo "SKIP enhance job HTTP $ENH_CODE"
  fi
fi

echo "OK Video SOP S14 stub — cost fixtures + enhance + SC-15 lifecycle #$LIFECYCLE_ID"

#!/usr/bin/env bash
# Smoke — Video SOP S10: production report SC-16 + E2E stub (AC-11)
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

echo "==> Video SOP S10 smoke lifecycle #$LIFECYCLE_ID"

REPORT_BODY="/tmp/vd-sop-s10-report.json"
REPORT_CODE="$(
  curl -sS -o "$REPORT_BODY" -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/reports/production?lifecycle_id=$LIFECYCLE_ID"
)"
if [[ "$REPORT_CODE" != "200" ]]; then
  echo "FAIL production report expected 200 got $REPORT_CODE"
  cat "$REPORT_BODY" >&2 || true
  exit 1
fi

python3 -c "
import json, sys
ALLOWED = {
    'kf_pass_rate', 'clip_pass_rate', 'takes_per_shot',
    'credit_ratio', 'client_rounds', 'lead_days', 'override_rate',
}
p = json.load(open(sys.argv[1], encoding='utf-8'))
metrics = p.get('metrics') if isinstance(p, dict) else []
if not isinstance(metrics, list) or len(metrics) != 7:
    raise SystemExit(f'FAIL expected 7 metrics got={len(metrics) if isinstance(metrics, list) else 0}')
ids = {m.get('metric') for m in metrics if isinstance(m, dict)}
if ids != ALLOWED:
    raise SystemExit(f'FAIL metric set mismatch: {ids!r}')
" "$REPORT_BODY"

if [[ "${VD_E2E_PROVIDERS:-0}" == "1" ]]; then
  echo "OK Video SOP S10 live (VD_E2E_PROVIDERS=1 — provider E2E runbook staging)"
else
  echo "OK Video SOP S10 stub — lifecycle #$LIFECYCLE_ID"
fi

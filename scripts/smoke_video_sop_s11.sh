#!/usr/bin/env bash
# Smoke — Video SOP S11: capability registry SC-15 + production report SC-16 (no vendor POST)
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

echo "==> Video SOP S11 smoke lifecycle #$LIFECYCLE_ID"

MODELS_BODY="/tmp/vd-sop-s11-models.json"
MODELS_CODE="$(
  curl -sS -o "$MODELS_BODY" -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/admin/models"
)"

if [[ "$MODELS_CODE" == "404" ]]; then
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "SKIP admin models 404 (no DATABASE_URL — DDL may be unapplied)"
    exit 0
  fi
  echo "FAIL admin models expected 200 got 404 (apply S11 DDL / seed)"
  cat "$MODELS_BODY" >&2 || true
  exit 1
fi

if [[ "$MODELS_CODE" != "200" ]]; then
  echo "FAIL admin models expected 200 got $MODELS_CODE"
  cat "$MODELS_BODY" >&2 || true
  exit 1
fi

# Exit 0 OK, 2 SKIP empty (no DATABASE_URL), 1 FAIL
set +e
MODELS_MSG="$(
  python3 -c "
import json, os, sys

path = sys.argv[1]
raw = json.load(open(path, encoding='utf-8'))
items = raw if isinstance(raw, list) else (raw.get('items') if isinstance(raw, dict) else None)
if not isinstance(items, list):
    print('FAIL admin models body missing list/items', file=sys.stderr)
    sys.exit(1)

if len(items) == 0:
    if not os.environ.get('DATABASE_URL'):
        print('SKIP admin models empty (no DATABASE_URL — DDL may be unapplied)')
        sys.exit(2)
    print('FAIL admin models empty — apply S11 DDL seed (docs/specs/postgresql-ddl-vd-sop-s11.sql)', file=sys.stderr)
    sys.exit(1)

kling = None
for row in items:
    if not isinstance(row, dict):
        continue
    if row.get('code') == 'video.kling.v3.pro':
        kling = row
        break

if kling is None:
    codes = [r.get('code') for r in items if isinstance(r, dict)]
    print(f'FAIL missing video.kling.v3.pro in models: {codes!r}', file=sys.stderr)
    sys.exit(1)

cap = kling.get('capability_json')
if isinstance(cap, str):
    try:
        cap = json.loads(cap)
    except Exception as e:
        print(f'FAIL capability_json not JSON for video.kling.v3.pro: {e}', file=sys.stderr)
        sys.exit(1)
if not isinstance(cap, dict):
    print(f'FAIL capability_json must be object for video.kling.v3.pro got {type(cap).__name__}', file=sys.stderr)
    sys.exit(1)

route = cap.get('route')
if route != 'VIA_LEONARDO':
    print(f'FAIL video.kling.v3.pro route expected VIA_LEONARDO got {route!r}', file=sys.stderr)
    sys.exit(1)

print('OK registry video.kling.v3.pro route=VIA_LEONARDO')
" "$MODELS_BODY"
)"
MODELS_RC=$?
set -e
echo "$MODELS_MSG"
if [[ "$MODELS_RC" -eq 2 ]]; then
  exit 0
fi
if [[ "$MODELS_RC" -ne 0 ]]; then
  exit "$MODELS_RC"
fi

REPORT_BODY="/tmp/vd-sop-s11-report.json"
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

echo "OK Video SOP S11 stub — registry + production report lifecycle #$LIFECYCLE_ID"

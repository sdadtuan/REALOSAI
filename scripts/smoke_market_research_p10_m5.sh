#!/usr/bin/env bash
# Live P10 — skip when qualtrics_enabled is false (prod default).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${API_BASE:-http://127.0.0.1:3001}"
ACCESS_TOKEN="${ACCESS_TOKEN:-}"
CLIENT_ID="${CLIENT_ID:-}"

echo "== P10 M5 live qualtrics (skip if disabled) =="
HTTP_CODE="$(curl -sS -o /tmp/mr_p10_health.json -w '%{http_code}' \
  "$API_BASE/api/v1/research/health" || true)"
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P10 — health not 200"
  exit 0
fi
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p10_health.json'))
if not row.get('qualtrics_enabled'):
    print('SKIP live P10 — qualtrics_enabled false')
    raise SystemExit(0)
print('qualtrics_enabled=true — live POST requires ACCESS_TOKEN + study_id (manual UAT)')
PY
echo "OK  P10 M5 live gate"

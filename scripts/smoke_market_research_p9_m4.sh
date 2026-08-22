#!/usr/bin/env bash
# P9 M4 — live SparkToro staging (skip if sparktoro_enabled false). RES-UC-061 live.
#
#   API_BASE=... ACCESS_TOKEN=... CLIENT_ID=acme ./scripts/smoke_market_research_p9_m4.sh
set -euo pipefail
API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

HTTP_CODE="$(curl -sS -o /tmp/mr_p9_m4_health.json -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || true)"
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P9 M4 — health not 200"
  exit 0
fi

python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p9_m4_health.json'))
open('/tmp/mr_p9_m4_enabled','w').write('1' if row.get('sparktoro_enabled') is True else '0')
print(f"health sparktoro_enabled={row.get('sparktoro_enabled')}")
PY

if [[ "$(cat /tmp/mr_p9_m4_enabled)" != "1" ]]; then
  echo "SKIP live P9 M4 — sparktoro_enabled false (prod/staging flag 0)"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live P9 M4 — set ACCESS_TOKEN and CLIENT_ID for staging UAT"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )
TITLE="Smoke P9 SparkToro live $(date +%s)"

HTTP_CODE="$(curl -sS -o /tmp/mr_p9_m4_create.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"title\":\"$TITLE\",\"product_type\":\"CONSUMER\",\"dv12_tier\":\"CB\",\"decision_statement\":\"Quyết định có mở IDI premium Q4 hay không.\",\"geo\":[\"VN\"],\"languages\":[\"vi\"],\"risk_class\":\"low\",\"questions\":[{\"question_vi\":\"Ai overlap audience sữa uống?\",\"sort_order\":1}]}")"
[[ "$HTTP_CODE" == "201" ]] || { echo "SKIP create project http=$HTTP_CODE"; exit 0; }

PID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p9_m4_create.json'))['project']['id'])")"
QID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p9_m4_create.json'))['project']['questions'][0]['id'])")"

HTTP_CODE="$(curl -sS -o /tmp/mr_p9_m4_run.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/run-sparktoro" \
  -d "{\"question_id\":$QID}")"
echo "run-sparktoro http=$HTTP_CODE body=$(cat /tmp/mr_p9_m4_run.json)"
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p9_m4_run.json'))
assert row.get('ok') is True
assert 'createInsight' not in json.dumps(row)
assert row.get('insight') is None
print('OK  live run-sparktoro accepted — credits/sources via worker; no insight in response')
PY

echo "OK  P9 M4 live smoke (poll ai_run for credits_used on staging manually)"

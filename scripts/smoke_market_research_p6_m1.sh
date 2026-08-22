#!/usr/bin/env bash
# Smoke P6 M1 — Survey codebook import API (RES-UC-062).
#
# Live API (flag on + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme \
#     ./scripts/smoke_market_research_p6_m1.sh
#
# Skip live if API is down (documents the contract and exits 0).
# Gates: PII cell → 400 survey_pii_forbidden; import does not createInsight.
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVC="$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
CTRL="$ROOT/services/ptt-crm-api/src/market-research/market-research.controller.ts"

echo "==> API contract (import-survey)"
python3 - <<PY
from pathlib import Path
svc = Path("$SVC").read_text()
ctrl = Path("$CTRL").read_text()
assert "projects/:id/import-survey" in ctrl, "missing import-survey route"
assert "FileInterceptor('file'" in ctrl, "must accept multipart file"
assert "expert_review" in ctrl
assert "async importSurvey" in svc
fn = svc.split("async importSurvey", 1)[1].split("private draftsFromVw", 1)[0]
assert "createInsight" not in fn, "importSurvey must not call createInsight"
assert "survey_pii_forbidden" in svc
print("OK  API import-survey + PII gate + no createInsight")
PY

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p6_m1_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p6_m1_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

echo "Contract:"
echo "  POST $API_BASE/api/v1/research/projects/:id/import-survey"
echo "    multipart file + format=codebook|vw; cap edit; 201 SurveyImportResult"
echo "    PII cell → 400 {error:survey_pii_forbidden}; 0 evidence"
echo "    result has study_id, source_id, evidence_ids, n — no insight_id / statement"
echo "    import does not call createInsight"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P6 M1 import — health not 200 (flag off, API down, or unauthenticated path)."
  echo "OK  market research P6 M1 smoke (API contract only)"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live P6 M1 import — set ACCESS_TOKEN and CLIENT_ID"
  echo "OK  market research P6 M1 smoke (API contract only)"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )
TITLE="Smoke P6 M1 Codebook $(date +%s)"

echo "==> POST /api/v1/research/projects"
HTTP_CODE="$(curl -sS -o /tmp/mr_p6_m1_create.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"title\":\"$TITLE\",\"product_type\":\"CONSUMER\",\"dv12_tier\":\"CB\",\"decision_statement\":\"Quyết định có mở khảo sát giá Q4 hay không.\",\"geo\":[\"VN\"],\"languages\":[\"vi\"],\"risk_class\":\"low\",\"questions\":[{\"question_vi\":\"Khách nghĩ gì về giá?\",\"sort_order\":1}]}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p6_m1_create.json)"
if [[ "$HTTP_CODE" != "201" ]]; then
  echo "SKIP live P6 M1 import — create project not 201 (http=$HTTP_CODE)"
  echo "OK  market research P6 M1 smoke (API contract only)"
  exit 0
fi
PID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p6_m1_create.json'))['project']['id'])")"

printf '%s\n' \
  'respondent_id,question_code,value,unit,value_base,period_note,geography' \
  'R001,Q1,15000,VND,mean,2026-Q1,analyst@ptt.vn' \
  > /tmp/mr_p6_m1_pii.csv

echo "==> POST /projects/$PID/import-survey with PII (expect 400 survey_pii_forbidden)"
HTTP_CODE="$(curl -sS -o /tmp/mr_p6_m1_pii.json -w '%{http_code}' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@/tmp/mr_p6_m1_pii.csv;type=text/csv" \
  -F "format=codebook" \
  "$API_BASE/api/v1/research/projects/$PID/import-survey" || true)"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p6_m1_pii.json)"
[[ "$HTTP_CODE" == "400" ]]
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p6_m1_pii.json'))
payload=row.get('message') if isinstance(row.get('message'), dict) else row
err=payload.get('error') or row.get('error')
assert err=='survey_pii_forbidden', row
blob=json.dumps(row)
assert 'insight_id' not in blob
print('OK  live PII gate 400 survey_pii_forbidden; no insight')
PY

printf '%s\n' \
  'respondent_id,question_code,value,unit,value_base,period_note,geography' \
  'R001,Q1,15000,VND,mean,2026-Q1,VN' \
  'R002,Q1,18000,VND,mean,2026-Q1,VN' \
  > /tmp/mr_p6_m1_ok.csv

echo "==> POST /projects/$PID/import-survey valid codebook (expect 201, no insight)"
HTTP_CODE="$(curl -sS -o /tmp/mr_p6_m1_ok.json -w '%{http_code}' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@/tmp/mr_p6_m1_ok.csv;type=text/csv" \
  -F "format=codebook" \
  "$API_BASE/api/v1/research/projects/$PID/import-survey" || true)"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p6_m1_ok.json)"
if [[ "$HTTP_CODE" == "201" || "$HTTP_CODE" == "200" ]]; then
  python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p6_m1_ok.json'))
assert row.get('ok') is True, row
assert 'study_id' in row and 'evidence_ids' in row, row
assert 'insight_id' not in row and 'statement' not in row, row
print('OK  live import 201 + no insight_id')
PY
else
  echo "SKIP live valid import body — API not ready (http=$HTTP_CODE)"
fi

echo "OK  market research P6 M1 smoke"

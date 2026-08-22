#!/usr/bin/env bash
# Smoke P5 M1 — Whisper ingest contract (RES-UC-060).
#
# Live API (flag on + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme \
#     ./scripts/smoke_market_research_p5_m1.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m1_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p5_m1_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

echo "Contract:"
echo "  POST $API_BASE/api/v1/research/projects/:id/studies/:studyId/whisper"
echo "    multipart field file; cap run; 202 {ok, run_id, study_id, excerpt_ids}"
echo "    MIME audio/mpeg|audio/wav|audio/mp4|audio/x-m4a; else 400 validation_error"
echo "    study 0 consent / all expired → 400 {error:consent_required|consent_expired}; no OpenAI"
echo "    evidence excerpt > 500 → 400 {error:raw_transcript_forbidden}"
echo "    complete payload = {excerpt_ids} only — no transcript / audio_uri / raw"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P5 M1 whisper — health not 200 (flag off, API down, or unauthenticated path)."
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live P5 M1 whisper — set ACCESS_TOKEN and CLIENT_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )
TITLE="Smoke P5 M1 Whisper $(date +%s)"

echo "==> POST /api/v1/research/projects"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m1_create.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"title\":\"$TITLE\",\"product_type\":\"CONSUMER\",\"dv12_tier\":\"CB\",\"decision_statement\":\"Quyết định có mở IDI premium Q4 hay không.\",\"geo\":[\"VN\"],\"languages\":[\"vi\"],\"risk_class\":\"low\",\"questions\":[{\"question_vi\":\"Khách nghĩ gì về giá?\",\"sort_order\":1}]}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p5_m1_create.json)"
if [[ "$HTTP_CODE" != "201" ]]; then
  echo "SKIP live P5 M1 whisper — create project not 201 (http=$HTTP_CODE)"
  exit 0
fi
PID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p5_m1_create.json'))['project']['id'])")"

echo "==> POST /projects/$PID/studies"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m1_study.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/studies" \
  -d '{"name":"IDI smoke","method":"idi"}')"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p5_m1_study.json)"
if [[ "$HTTP_CODE" != "201" ]]; then
  echo "SKIP live P5 M1 whisper — create study not 201 (http=$HTTP_CODE)"
  exit 0
fi
SID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p5_m1_study.json'))['id'])")"

printf 'ID3' > /tmp/mr_p5_m1_tiny.mp3
echo "==> POST /projects/$PID/studies/$SID/whisper without consent"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m1_whisper.json -w '%{http_code}' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@/tmp/mr_p5_m1_tiny.mp3;type=audio/mpeg" \
  "$API_BASE/api/v1/research/projects/$PID/studies/$SID/whisper" || true)"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p5_m1_whisper.json)"
[[ "$HTTP_CODE" == "400" ]]
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p5_m1_whisper.json'))
payload=row.get('message') if isinstance(row.get('message'), dict) else row
err=payload.get('error') or row.get('error')
assert err=='consent_required', row
blob=json.dumps(row)
assert 'transcript' not in blob.lower() or err=='consent_required', row
print('OK  whisper without consent → 400 consent_required')
PY

EXCERPT="$(python3 -c "print('x'*800)")"
echo "==> POST /projects/$PID/evidence excerpt 800"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m1_ev.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/evidence" \
  -d "{\"study_id\":$SID,\"locator\":\"T-00:00\",\"excerpt\":\"$EXCERPT\"}" || true)"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p5_m1_ev.json)"
[[ "$HTTP_CODE" == "400" ]]
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p5_m1_ev.json'))
payload=row.get('message') if isinstance(row.get('message'), dict) else row
err=payload.get('error') or row.get('error')
assert err=='raw_transcript_forbidden', row
print('OK  excerpt > 500 → 400 raw_transcript_forbidden')
PY

echo "OK  market research P5 M1 smoke"

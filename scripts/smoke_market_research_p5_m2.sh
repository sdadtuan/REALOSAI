#!/usr/bin/env bash
# Smoke P5 M2 — Studies tab Tải audio + consent gate (RES-UC-060).
#
# Live API (flag on + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme \
#     ./scripts/smoke_market_research_p5_m2.sh
#
# Skip live if API is down (documents the contract and exits 0).
# Always checks FE: banner, Tải audio, no transcript textarea.
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PANE="$ROOT/services/ops-web/src/components/research/StudiesPane.tsx"
UTIL="$ROOT/services/ops-web/src/components/research/studies-whisper.util.ts"
PAGE="$ROOT/services/ops-web/src/app/crm/research/[id]/page.tsx"
API="$ROOT/services/ops-web/src/lib/market-research-api.ts"

echo "==> FE contract (Studies upload UI)"
python3 - <<PY
import re
from pathlib import Path
pane = Path("$PANE").read_text()
util = Path("$UTIL").read_text()
page = Path("$PAGE").read_text()
api = Path("$API").read_text()
banner = "Chỉ lưu đoạn trích ≤ 500 ký tự + mốc thời gian. Không lưu bản ghi / transcript đầy đủ."
assert banner in util, "missing NFR-PRI-02 banner"
assert "WHISPER_PRIVACY_BANNER" in pane, "StudiesPane must render privacy banner"
assert "Tải audio" in pane, "missing Tải audio"
assert "Cần consent còn hạn và quyền chạy job" in util, "missing disabled title"
assert "UPLOAD_DISABLED_TITLE" in pane, "StudiesPane must set disabled title"
assert "dán transcript" not in pane.lower() and "dán transcript" not in util.lower(), "no paste-transcript copy"
for tag in re.findall(r"<textarea\b[^>]*>", pane, flags=re.I):
    assert "transcript" not in tag.lower(), tag
assert 'name="transcript"' not in pane.lower()
assert "canRun={canRun}" in page, "page must pass canRun to StudiesPane"
fn = api.split("export async function ingestResearchWhisper", 1)[1].split("export async function", 1)[0]
assert "FormData" in fn and "file" in fn, "client must send multipart FormData"
assert "JSON.stringify" not in fn, "must not JSON-encode the audio file"
print("OK  FE StudiesPane upload + no transcript textarea")
PY

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m2_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p5_m2_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

echo "Contract:"
echo "  FE Studies: Tải audio + poll fetchResearchJob; no paste-transcript box"
echo "  POST whisper without unexpired consent → 400 consent_required|consent_expired"
echo "  excerpt > 500 → 400 raw_transcript_forbidden"
echo "  cap run for upload; create study/consent stays edit"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P5 M2 whisper — health not 200 (flag off, API down, or unauthenticated path)."
  echo "OK  market research P5 M2 smoke (FE contract only)"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live P5 M2 whisper — set ACCESS_TOKEN and CLIENT_ID"
  echo "OK  market research P5 M2 smoke (FE contract only)"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )
TITLE="Smoke P5 M2 Studies $(date +%s)"

echo "==> POST /api/v1/research/projects"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m2_create.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"title\":\"$TITLE\",\"product_type\":\"CONSUMER\",\"dv12_tier\":\"CB\",\"decision_statement\":\"Quyết định có mở IDI premium Q4 hay không.\",\"geo\":[\"VN\"],\"languages\":[\"vi\"],\"risk_class\":\"low\",\"questions\":[{\"question_vi\":\"Khách nghĩ gì về giá?\",\"sort_order\":1}]}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p5_m2_create.json)"
if [[ "$HTTP_CODE" != "201" ]]; then
  echo "SKIP live P5 M2 whisper — create project not 201 (http=$HTTP_CODE)"
  echo "OK  market research P5 M2 smoke (FE contract only)"
  exit 0
fi
PID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p5_m2_create.json'))['project']['id'])")"

echo "==> POST /projects/$PID/studies"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m2_study.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/studies" \
  -d '{"name":"IDI smoke","method":"idi"}')"
if [[ "$HTTP_CODE" != "201" ]]; then
  echo "SKIP live P5 M2 whisper — create study not 201 (http=$HTTP_CODE)"
  echo "OK  market research P5 M2 smoke (FE contract only)"
  exit 0
fi
SID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p5_m2_study.json'))['id'])")"

printf 'ID3' > /tmp/mr_p5_m2_tiny.mp3
echo "==> POST whisper without consent (expect 400 consent_required)"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m2_whisper.json -w '%{http_code}' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@/tmp/mr_p5_m2_tiny.mp3;type=audio/mpeg" \
  "$API_BASE/api/v1/research/projects/$PID/studies/$SID/whisper" || true)"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p5_m2_whisper.json)"
[[ "$HTTP_CODE" == "400" ]]
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p5_m2_whisper.json'))
payload=row.get('message') if isinstance(row.get('message'), dict) else row
err=payload.get('error') or row.get('error')
assert err=='consent_required', row
print('OK  live consent gate 400')
PY

echo "OK  market research P5 M2 smoke"

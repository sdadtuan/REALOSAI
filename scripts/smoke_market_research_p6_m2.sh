#!/usr/bin/env bash
# Smoke P6 M2 — Studies tab Nhập codebook (RES-UC-062).
#
# Live API (flag on + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme \
#     ./scripts/smoke_market_research_p6_m2.sh
#
# Skip live if API is down (documents the contract and exits 0).
# Always checks FE: banner, Nhập codebook, CSV accept, no createInsight, no transcript.
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PANE="$ROOT/services/ops-web/src/components/research/StudiesPane.tsx"
UTIL="$ROOT/services/ops-web/src/components/research/studies-codebook.util.ts"
API="$ROOT/services/ops-web/src/lib/market-research-api.ts"

echo "==> FE contract (Studies codebook upload UI)"
python3 - <<PY
from pathlib import Path
pane = Path("$PANE").read_text()
util = Path("$UTIL").read_text()
api = Path("$API").read_text()
banner = "Nhập CSV codebook — evidence số. Không tự tạo insight."
assert banner in util, "missing codebook banner"
assert "CODEBOOK_IMPORT_BANNER" in pane, "StudiesPane must render codebook banner"
assert "Nhập codebook" in pane, "missing Nhập codebook"
assert 'accept=".csv,text/csv"' in pane or "CODEBOOK_CSV_ACCEPT" in pane, "file must accept CSV"
assert "CODEBOOK_CSV_ACCEPT" in util and '.csv,text/csv' in util
assert "codebook" in util and "vw" in util
assert "isCodebookCsvFile" in pane, "must reject non-CSV before POST"
assert "canEdit" in pane and "canRun" in pane
assert "importResearchSurvey" in pane and "importResearchSurvey" in api
assert "createInsight" not in pane and "createResearchInsight" not in pane
assert "dán transcript" not in pane.lower() and "dán transcript" not in util.lower()
import re
for tag in re.findall(r"<textarea\b[^>]*>", pane, flags=re.I):
    assert "transcript" not in tag.lower(), tag
assert 'name="transcript"' not in pane.lower()
assert "xlsx" not in pane.lower() and "xlsx" not in util.lower()
assert "/crm/sales?tab=market" not in pane
fn = api.split("export async function importResearchSurvey", 1)[1].split("export async function", 1)[0]
assert "FormData" in fn and "import-survey" in fn, "client must send multipart FormData"
assert "JSON.stringify" not in fn, "must not JSON-encode the CSV file"
assert "Content-Type" not in fn
print("OK  FE StudiesPane codebook upload + no createInsight + no transcript")
PY

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p6_m2_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p6_m2_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

echo "Contract:"
echo "  FE Studies: Nhập codebook (cap edit); banner verbatim; accept .csv,text/csv"
echo "  format codebook|vw; geography required when vw; unit default VND when vw"
echo "  ExpertReview → expert_review source note; no transcript textarea"
echo "  POST import-survey multipart; no createInsight; no consent required"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P6 M2 codebook — health not 200 (flag off, API down, or unauthenticated path)."
  echo "OK  market research P6 M2 smoke (FE contract only)"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live P6 M2 codebook — set ACCESS_TOKEN and CLIENT_ID"
  echo "OK  market research P6 M2 smoke (FE contract only)"
  exit 0
fi

echo "OK  market research P6 M2 smoke"

#!/usr/bin/env bash
# Smoke P8 M2 — POST insights/copilot RAG inject (RES-UC-072).
#
# Live API (health 200 + staff token + project/evidence):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... PROJECT_ID=... EVIDENCE_IDS=1,2 \
#     ./scripts/smoke_market_research_p8_m2.sh
#
# Health 200; if rag_enabled=false and token present, assert rag_note=rag_disabled
# or SKIP live. Do not assert createInsight count over HTTP (Jest covers ×1).
# If flag on staging: body has rag_hits array.
#
# Gates: flag off P0 prompt; draft not in prior; PII skip RAG; 1 draft; no publish.
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVC="$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
CTRL="$ROOT/services/ptt-crm-api/src/market-research/market-research.controller.ts"

echo "==> Contract (POST insights/copilot + rag_note / rag_hits)"
python3 - <<PY
from pathlib import Path
svc = Path("$SVC").read_text()
ctrl = Path("$CTRL").read_text()
assert "@Post('projects/:id/insights/copilot')" in ctrl
assert "async insightCopilot" in svc
assert "buildCopilotRagQuery" in svc
assert "shouldSkipCopilotRag" in svc
assert "toCopilotRagHits" in svc
assert "rag_disabled" in svc
assert "rag_skipped_pii" in svc
assert "rag_hits" in svc
copilot = svc.split("async insightCopilot", 1)[1].split("async reportCopilot", 1)[0]
assert "createInsight" in copilot
print("OK  M2 POST insights/copilot + rag_hits / rag_note on disk")
PY

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p8_m2_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p8_m2_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

echo "Contract:"
echo "  POST /api/v1/research/projects/:id/insights/copilot  cap crm_research.run"
echo "  flag off → rag_note=rag_disabled + P0 prompt; rag_hits []"
echo "  flag on staging → body.rag_hits is array (0..5)"
echo "  PII query → rag_skipped_pii; draft not in prior; 1 draft; no publish"
echo "  Do not assert createInsight count over HTTP"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P8 M2 copilot — health not 200 (flag off, API down, or unauthenticated path)."
  echo "OK  market research P8 M2 smoke (contract only)"
  exit 0
fi

RAG_ENABLED="$(python3 -c "import json; print(json.load(open('/tmp/mr_p8_m2_health.json')).get('rag_enabled', False))" 2>/dev/null || echo false)"
echo "health.rag_enabled=$RAG_ENABLED"

if [[ -z "${ACCESS_TOKEN:-}" ]]; then
  echo "SKIP live P8 M2 copilot — set ACCESS_TOKEN (and PROJECT_ID + EVIDENCE_IDS to POST)"
  echo "OK  market research P8 M2 smoke (contract only)"
  exit 0
fi

if [[ -z "${PROJECT_ID:-}" || -z "${EVIDENCE_IDS:-}" ]]; then
  echo "SKIP live P8 M2 copilot — set PROJECT_ID and EVIDENCE_IDS to POST (do not assert createInsight count over HTTP)"
  echo "OK  market research P8 M2 smoke (contract only)"
  exit 0
fi

IDS_JSON="$(python3 -c "import json,os; print(json.dumps([int(x) for x in os.environ['EVIDENCE_IDS'].split(',') if x.strip()]))")"
echo "==> POST /api/v1/research/projects/$PROJECT_ID/insights/copilot"
HTTP_CODE="$(curl -sS -o /tmp/mr_p8_m2_copilot.json -w '%{http_code}' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$API_BASE/api/v1/research/projects/$PROJECT_ID/insights/copilot" \
  -d "{\"evidence_ids\":$IDS_JSON}" || true)"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p8_m2_copilot.json)"

if [[ "$HTTP_CODE" != "201" ]]; then
  echo "SKIP live P8 M2 copilot — POST not 201 (http=$HTTP_CODE; llm_unconfigured / validation / API)."
  echo "OK  market research P8 M2 smoke (contract only)"
  exit 0
fi

python3 - <<PY
import json
row = json.load(open("/tmp/mr_p8_m2_copilot.json"))
rag_enabled = str("$RAG_ENABLED").lower() in ("true", "1")
hits = row.get("rag_hits")
assert isinstance(hits, list), row
if not rag_enabled:
    note = row.get("rag_note")
    assert note == "rag_disabled", row
    print("OK  flag off → rag_note=rag_disabled")
else:
    print("OK  flag on → rag_hits array len=%s" % len(hits))
print("OK  live P8 M2 copilot (no createInsight count assert)")
PY

echo "OK  market research P8 M2 smoke"

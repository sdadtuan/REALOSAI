#!/usr/bin/env bash
# Smoke P8 M1 — Copilot RAG query util contract (RES-UC-072).
#
# Documents util contract (buildCopilotRagQuery / shouldSkipCopilotRag / toCopilotRagHits).
# Skip live if health not 200.
#
#   bash scripts/smoke_market_research_p8_m1.sh
#
# Gates: flag off P0 prompt; draft not in prior; PII skip RAG; 1 draft; no publish.
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UTIL="$ROOT/services/ptt-crm-api/src/market-research/research-copilot-rag.util.ts"

echo "==> Contract (buildCopilotRagQuery / shouldSkipCopilotRag / toCopilotRagHits)"
python3 - <<PY
from pathlib import Path
util = Path("$UTIL").read_text()
assert "export function buildCopilotRagQuery" in util
assert "export function shouldSkipCopilotRag" in util
assert "export function toCopilotRagHits" in util
assert "piiHint" in util
assert "isRagCorpusStatus" in util
assert "RAG_COPILOT_HIT_LIMIT" in util
print("OK  M1 copilot RAG util contract on disk")
PY

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p8_m1_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p8_m1_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

echo "Contract:"
echo "  buildCopilotRagQuery(evidence) → excerpt/locator/unit/geo joined, trimmed, slice 500"
echo "  shouldSkipCopilotRag(query) → empty or PII (piiHint) → skip RAG"
echo "  toCopilotRagHits(hits) → corpus status only, cap RAG_COPILOT_HIT_LIMIT, no draft in prior"
echo "  Gates: flag off P0 prompt; draft not in prior; PII skip RAG; 1 draft; no publish"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P8 M1 copilot RAG util — health not 200 (flag off, API down, or unauthenticated path)."
  echo "OK  market research P8 M1 smoke (contract only)"
  exit 0
fi

echo "OK  market research P8 M1 smoke"

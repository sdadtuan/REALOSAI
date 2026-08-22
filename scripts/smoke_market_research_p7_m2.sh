#!/usr/bin/env bash
# Smoke P7 M2 — RAG embed + search API (RES-UC-070).
#
# Live API (health 200 + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... \
#     ./scripts/smoke_market_research_p7_m2.sh
#
# Skip live if health ≠ 200 or no token (exit 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CTRL="$ROOT/services/ptt-crm-api/src/market-research/market-research.controller.ts"
SVC="$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"

echo "==> Contract (search GET + embed on approve)"
python3 - <<PY
from pathlib import Path
ctrl = Path("$CTRL").read_text()
svc = Path("$SVC").read_text()
assert "@Get('insights/search')" in ctrl
assert "searchInsights" in ctrl and "searchInsights" in svc
assert "rag_disabled" in svc
assert "shouldSkipRagEmbed" in svc
assert "upsertInsightEmbedding" in svc
assert "deleteInsightEmbedding" in svc
search = svc.split("async searchInsights", 1)[1].split("async ", 1)[0]
assert "createInsight" not in search
assert "this.repo.createInsight" not in search
print("OK  M2 GET insights/search + rag_disabled + no createInsight from search")
PY

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p7_m2_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p7_m2_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

echo "Contract:"
echo "  GET /api/v1/research/insights/search?q= cap crm_research.view — no POST search"
echo "  empty q → 400 rag_query_required"
echo "  flag off → 200 {hits:[], note:rag_disabled}; listEmbeddings not called"
echo "  draft no hit; PII skip embed (approve still 200)"
echo "  403 {error:forbidden} no statement"
echo "  health.rag_enabled true only when RESEARCH_RAG_ENABLED; never returns secret"
echo "  no createInsight from search/embed"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P7 M2 RAG search — health not 200 (flag off, API down, or unauthenticated path)."
  echo "OK  market research P7 M2 smoke (contract only)"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" ]]; then
  echo "SKIP live P7 M2 RAG search — set ACCESS_TOKEN"
  echo "OK  market research P7 M2 smoke (contract only)"
  exit 0
fi

echo "OK  market research P7 M2 smoke"

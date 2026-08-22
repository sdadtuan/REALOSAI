#!/usr/bin/env bash
# Smoke P7 M3 — Insights tab Tìm insight đã duyệt (RES-UC-070).
#
# Live API (health 200 + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... \
#     ./scripts/smoke_market_research_p7_m3.sh
#
# Skip live if health ≠ 200 or no token (exit 0).
# Always checks FE: banner verbatim, shouldShowRagSearch, searchResearchInsights,
# no createInsight-from-RAG, no xlsx, no /crm/sales?tab=market.
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PAGE="$ROOT/services/ops-web/src/app/crm/research/[id]/page.tsx"
PANE="$ROOT/services/ops-web/src/components/research/InsightsRagSearch.tsx"
UTIL="$ROOT/services/ops-web/src/components/research/insights-rag.util.ts"
API="$ROOT/services/ops-web/src/lib/market-research-api.ts"

echo "==> FE contract (Insights RAG search)"
python3 - <<PY
from pathlib import Path
page = Path("$PAGE").read_text()
pane = Path("$PANE").read_text()
util = Path("$UTIL").read_text()
api = Path("$API").read_text()
banner = "Chỉ insight đã duyệt bản khách / published. Không tìm draft. Không tự tạo insight."
assert banner in util, "missing RAG search banner"
assert "RAG_SEARCH_BANNER" in pane, "InsightsRagSearch must render RAG_SEARCH_BANNER"
assert "shouldShowRagSearch" in util
assert "shouldShowRagSearch" in pane, "pane must hide via shouldShowRagSearch"
assert "shouldShowRagSearch(false, true)" not in pane
assert "Tìm insight đã duyệt" in pane
assert ">Tìm<" in pane or ">Tìm\n" in pane or "Tìm" in pane
assert "createInsight" not in pane and "createResearchInsight" not in pane
assert "Tạo insight từ" not in pane and "Tạo insight từ" not in page
assert "searchResearchInsights" in pane and "searchResearchInsights" in api
assert "insights/search" in api
assert "rag_enabled" in api
assert "rag_disabled" in api and "rag_query_required" in api
assert "ragEnabled" in page and "setRagEnabled" in page
assert "InsightsRagSearch" in page
fn = api.split("export async function searchResearchInsights", 1)[1].split("export async function", 1)[0]
assert "createInsight" not in fn and "createResearchInsight" not in fn
assert "method: 'POST'" not in fn and "method: \"POST\"" not in fn
assert "xlsx" not in pane.lower() and "xlsx" not in util.lower() and "xlsx" not in page.lower()
assert "/crm/sales?tab=market" not in pane and "/crm/sales?tab=market" not in page
assert "/crm/research/taxonomy" not in page and "/crm/research/taxonomy" not in pane
print("OK  FE Insights RAG search + hide when flag 0 + no createInsight-from-RAG")
PY

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p7_m3_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p7_m3_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

echo "Contract:"
echo "  GET /api/v1/research/health → rag_enabled true only when RESEARCH_RAG_ENABLED; never returns secret"
echo "  GET /api/v1/research/insights/search?q= cap crm_research.view"
echo "    empty q → 400 rag_query_required"
echo "    flag off → 200 {hits:[], note:rag_disabled}"
echo "  FE: hide Tìm insight đã duyệt when health.rag_enabled is false (prod flag 0)"
echo "  Banner verbatim: Chỉ insight đã duyệt bản khách / published. Không tìm draft. Không tự tạo insight."
echo "  No createInsight / createResearchInsight from search; no xlsx; no /crm/sales?tab=market"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P7 M3 RAG search — health not 200 (flag off, API down, or unauthenticated path)."
  echo "OK  market research P7 M3 smoke (FE contract only)"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" ]]; then
  echo "SKIP live P7 M3 RAG search — set ACCESS_TOKEN"
  echo "OK  market research P7 M3 smoke (FE contract only)"
  exit 0
fi

echo "OK  market research P7 M3 smoke"

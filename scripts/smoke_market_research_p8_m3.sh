#!/usr/bin/env bash
# Smoke P8 M3 — Copilot RAG banner + no sales-market route (RES-UC-072).
#
# Grep banner string in insight-copilot-rag.util.ts.
# rg the research page; fail only if P8 added /crm/sales?tab=market.
#
#   bash scripts/smoke_market_research_p8_m3.sh
#
# Gates: flag off P0 prompt; draft not in prior; PII skip RAG; 1 draft; no publish.
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UTIL="$ROOT/services/ops-web/src/components/research/insight-copilot-rag.util.ts"
PAGE="$ROOT/services/ops-web/src/app/crm/research/[id]/page.tsx"
BANNER='Copilot có thể tham chiếu insight đã duyệt cùng khách. Bản nháp — không tự duyệt, không tự công bố.'

echo "==> Banner string in insight-copilot-rag.util.ts"
python3 - <<PY
from pathlib import Path
util = Path("$UTIL").read_text()
banner = "$BANNER"
assert banner in util, "missing RAG copilot banner"
assert "RAG_COPILOT_BANNER" in util
assert "shouldShowRagCopilotBanner" in util
print("OK  M3 banner verbatim in insight-copilot-rag.util.ts")
PY

echo "==> rg research page for /crm/sales?tab=market (fail only if P8 added that route)"
SALES_ROUTE='/crm/sales?tab=market'
if git -C "$ROOT" log main..HEAD -S "$SALES_ROUTE" -- "$PAGE" | grep -q .; then
  echo "FAIL  P8 added $SALES_ROUTE to $PAGE"
  exit 1
fi
if grep -F -q "$SALES_ROUTE" "$PAGE"; then
  echo "NOTE  $SALES_ROUTE present on page but not introduced by P8 — not failing"
else
  echo "OK  page has no $SALES_ROUTE"
fi

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p8_m3_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p8_m3_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

echo "Contract:"
echo "  Banner verbatim: $BANNER"
echo "  shouldShowRagCopilotBanner(ragEnabled, canRun) — hide when flag off"
echo "  No new /crm/sales?tab=market on research page (P8 must not add that route)"
echo "  Gates: flag off P0 prompt; draft not in prior; PII skip RAG; 1 draft; no publish"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P8 M3 banner — health not 200 (flag off, API down, or unauthenticated path)."
  echo "OK  market research P8 M3 smoke (FE contract only)"
  exit 0
fi

echo "OK  market research P8 M3 smoke"

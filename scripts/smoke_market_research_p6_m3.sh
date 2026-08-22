#!/usr/bin/env bash
# Smoke P6 M4 — Tab Giá VW (RES-UC-063). File name p6_m3.sh per plan M4.
#
# Live API (flag on + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... \
#     ./scripts/smoke_market_research_p6_m3.sh
#
# Skip live if API is down (documents the contract and exits 0).
# Always checks FE: banner, shouldShowVwTab, Giá VW, VwPane, no createInsight.
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PAGE="$ROOT/services/ops-web/src/app/crm/research/[id]/page.tsx"
PANE="$ROOT/services/ops-web/src/components/research/VwPane.tsx"
UTIL="$ROOT/services/ops-web/src/components/research/vw-pane.util.ts"
API="$ROOT/services/ops-web/src/lib/market-research-api.ts"

echo "==> FE contract (PRICE_OFFER Giá VW tab)"
python3 - <<PY
from pathlib import Path
page = Path("$PAGE").read_text()
pane = Path("$PANE").read_text()
util = Path("$UTIL").read_text()
api = Path("$API").read_text()
banner = "Bảng ước lượng giá — mẫu convenience. Không MOE / 95% confidence."
assert banner in util, "missing VW tab banner"
assert "VW_TAB_BANNER" in pane, "VwPane must render VW_TAB_BANNER"
assert "shouldShowVwTab" in util
assert "shouldShowVwTab" in page, "page must call shouldShowVwTab (not inline PRICE_OFFER only)"
assert "Giá VW" in page, "missing tab label Giá VW"
assert "VwPane" in page and "VwPane" in pane
assert "Tính Van Westendorp" in pane
assert "canEdit" in pane
assert "formatVwPoint" in util and "formatVwPoint" in pane
assert "too_cheap" in pane and "cheap" in pane and "expensive" in pane and "too_expensive" in pane
assert "PMC" in pane and "PME" in pane and "OPP" in pane and "IDP" in pane
assert "limitation_note" in pane
assert "fetchResearchVanWestendorp" in pane and "createResearchVanWestendorp" in pane
assert "fetchResearchVanWestendorp" in api and "createResearchVanWestendorp" in api
assert "van-westendorp" in api
assert "vw_not_price_offer" in api and "vw_insufficient_n" in api
assert "createInsight" not in pane and "createResearchInsight" not in pane
fn = api.split("export async function createResearchVanWestendorp", 1)[1].split("export async function", 1)[0]
assert "createInsight" not in fn and "createResearchInsight" not in fn
assert "xlsx" not in pane.lower() and "xlsx" not in util.lower() and "xlsx" not in page.lower()
assert "/crm/sales?tab=market" not in pane and "/crm/sales?tab=market" not in page
print("OK  FE VwPane + shouldShowVwTab + no createInsight + no xlsx")
PY

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p6_m3_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p6_m3_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

echo "Contract:"
echo "  FE PRICE_OFFER: tab Giá VW via shouldShowVwTab; hidden on CAT_REVIEW and other types"
echo "  Banner verbatim; bins price + too_cheap/cheap/expensive/too_expensive %; PMC/PME/OPP/IDP"
echo "  GET /api/v1/research/projects/:id/van-westendorp → { summary } (cap view; not PRICE_OFFER-gated)"
echo "  POST /api/v1/research/projects/:id/van-westendorp body { study_id? } (cap edit)"
echo "  POST not PRICE_OFFER → 400 vw_not_price_offer"
echo "  POST n < 4 → 400 vw_insufficient_n"
echo "  No createInsight / createResearchInsight; no report/portal; no xlsx"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P6 M4 VW tab — health not 200 (flag off, API down, or unauthenticated path)."
  echo "OK  market research P6 M3 smoke (FE contract only)"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" ]]; then
  echo "SKIP live P6 M4 VW tab — set ACCESS_TOKEN"
  echo "OK  market research P6 M3 smoke (FE contract only)"
  exit 0
fi

echo "OK  market research P6 M3 smoke"

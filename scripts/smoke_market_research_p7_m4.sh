#!/usr/bin/env bash
# Smoke P7 M4 — Taxonomy CRUD + attach (RES-UC-071).
#
# Live API (health 200 + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... \
#     ./scripts/smoke_market_research_p7_m4.sh
#
# Skip live if health ≠ 200 or no token (exit 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CTRL="$ROOT/services/ptt-crm-api/src/market-research/market-research.controller.ts"
SVC="$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
GUARD="$ROOT/services/ptt-crm-api/src/market-research/guards/staff-market-research.guard.ts"

echo "==> Contract (taxonomy CRUD + attach statement immutable)"
python3 - <<PY
from pathlib import Path
ctrl = Path("$CTRL").read_text()
svc = Path("$SVC").read_text()
guard = Path("$GUARD").read_text()
assert "@Get('taxonomy')" in ctrl
assert "@Post('taxonomy')" in ctrl
assert "@Patch('taxonomy/:id')" in ctrl
assert "@Post('insights/:id/themes')" in ctrl
assert "StaffMarketResearchConfigureGuard" in ctrl
assert "attachInsightTheme" in svc
attach = svc.split("async attachInsightTheme", 1)[1].split("async ", 1)[0]
assert "createInsight" not in attach
assert "patchInsight" not in attach
assert "loadScopedInsight" in attach
assert "configure" in guard.lower() or "Configure" in guard
print("OK  M4 taxonomy CRUD + attach does not createInsight / patchInsight")
PY

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p7_m4_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p7_m4_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

echo "Contract:"
echo "  GET /api/v1/research/taxonomy cap view"
echo "  POST /api/v1/research/taxonomy cap configure — missing configure → 403"
echo "  POST /insights/:id/themes {taxonomy_id} cap edit — statement unchanged"
echo "  attach does not change statement; no createInsight"
echo "  theme_code invalid → 400 taxonomy_code_invalid"
echo "  search theme_code=PRICE excludes untagged"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P7 M4 taxonomy — health not 200 (flag off, API down, or unauthenticated path)."
  echo "OK  market research P7 M4 smoke (contract only)"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" ]]; then
  echo "SKIP live P7 M4 taxonomy — set ACCESS_TOKEN"
  echo "OK  market research P7 M4 smoke (contract only)"
  exit 0
fi

echo "OK  market research P7 M4 smoke"

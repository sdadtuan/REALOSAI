#!/usr/bin/env bash
# Smoke P2 M5 — Market Research OS: aggregator + deploy + gate syntax.
#
# Live API is not required. This milestone ships scripts and UAT Actions.
#   bash scripts/smoke_market_research_p2_m5.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> bash -n aggregator + deploy + gate"
bash -n "$ROOT/scripts/smoke_market_research_p2.sh"
bash -n "$ROOT/scripts/deploy_market_research_p2_vps.sh"
bash -n "$ROOT/scripts/market_research_gate.sh"
echo "OK  bash -n smoke_p2 / deploy_p2 / gate"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m5_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p2_m5_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P2 M5 — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  bash scripts/smoke_market_research_p2.sh   # p2_m1…p2_m5 if present"
  echo "  bash scripts/deploy_market_research_p2_vps.sh  # dry-run unless APPLY=1 / --local"
  echo "  step 1/4 P0+P1+P2 DDL (P2 DDL before worker); 2/4 api; 3/4 ops-web; 4/4 worker"
  echo "  npm ci without --omit=dev; default no --enable-flags"
  echo "  JEST_WORKER_ID skip of deploy/runtime.env must stay (d8255ecd)"
  echo "  UAT 030–033: study → consent → locator → pulse → Ops alert → EN draft → Lead duyệt → analytics"
  echo "OK  market research P2 M5 smoke"
  exit 0
fi

echo "SKIP live P2 M5 — syntax-only milestone; no live deploy or flag flip"
echo "OK  market research P2 M5 smoke"

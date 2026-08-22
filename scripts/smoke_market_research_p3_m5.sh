#!/usr/bin/env bash
# Smoke P3 M5 — Market Research OS: aggregator + deploy + gate syntax.
#
# Live API is not required. This milestone ships scripts and UAT Actions.
#   bash scripts/smoke_market_research_p3_m5.sh
#
# m5 = bash -n only (plus skip-live contract print when health ≠ 200).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> bash -n aggregator + deploy + gate"
bash -n "$ROOT/scripts/smoke_market_research_p3.sh"
bash -n "$ROOT/scripts/deploy_market_research_p3_vps.sh"
bash -n "$ROOT/scripts/market_research_gate.sh"
echo "OK  bash -n smoke_p3 / deploy_p3 / gate"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p3_m5_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p3_m5_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P3 M5 — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  bash scripts/smoke_market_research_p3.sh   # p3_m1…p3_m5 if present"
  echo "  bash scripts/deploy_market_research_p3_vps.sh  # dry-run unless APPLY=1 / --local"
  echo "  step 1/5 P0+P1+P2+P3 DDL (P3 DDL before restarts); 2/5 api; 3/5 ops-web; 4/5 portal-web; 5/5 worker"
  echo "  portal rebuild: wave_p1_rebuild_portal_web.sh + systemctl restart ptt-portal-web"
  echo "  export NEXT_PUBLIC_MARKET_RESEARCH from deploy/runtime.env when building portal (do not flip if already 1)"
  echo "  npm ci without --omit=dev; default no --enable-flags"
  echo "  JEST_WORKER_ID skip of deploy/runtime.env must stay untouched"
  echo "  UAT 040–042: embargo → publish → portal watermark → Beta 403 → TRACKER wave ×2 → compare → decision + insight → F5"
  echo "OK  market research P3 M5 smoke"
  exit 0
fi

echo "SKIP live P3 M5 — syntax-only milestone; no live deploy or flag flip"
echo "OK  market research P3 M5 smoke"

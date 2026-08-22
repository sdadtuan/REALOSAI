#!/usr/bin/env bash
# Smoke P5 M5 — Market Research OS: aggregator + deploy + syntax.
#
# Live API is not required. This milestone ships scripts and UAT Actions.
#   bash scripts/smoke_market_research_p5_m5.sh
#
# m5 = bash -n only (plus skip-live contract print when health ≠ 200).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> bash -n aggregator + deploy + p5_m4 + p5_m5"
bash -n "$ROOT/scripts/smoke_market_research_p5.sh"
bash -n "$ROOT/scripts/deploy_market_research_p5_vps.sh"
bash -n "$ROOT/scripts/smoke_market_research_p5_m4.sh"
bash -n "$ROOT/scripts/smoke_market_research_p5_m5.sh"
echo "OK  bash -n smoke_p5 / deploy_p5 / p5_m4 / p5_m5"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m5_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p5_m5_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P5 M5 — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  bash scripts/smoke_market_research_p5.sh   # p5_m1…p5_m5 if present"
  echo "  bash scripts/deploy_market_research_p5_vps.sh  # dry-run unless APPLY=1 / --local"
  echo "  step 1/4 P0+P1+P2+P3+P4+P5 DDL (P5 last, before restarts); 2/4 api; 3/4 ops-web; 4/4 worker"
  echo "  no portal-web rebuild"
  echo "  default no --enable-flags; never RESEARCH_SPARKTORO_ENABLED=1; never write SPARKTORO_API_KEY"
  echo "  APPLY=1 git pull --ff-only origin main (merge-to-main before VPS)"
  echo "  npm ci without --omit=dev"
  echo "  JEST_WORKER_ID skip of deploy/runtime.env must stay untouched"
  echo "  Gates: consent 400; excerpt > 500 → raw_transcript_forbidden; SparkToro no createInsight; paid tier high → reliability_capped"
  echo "  UAT 060–061: consent → upload → excerpt ≤ 500 → F5 no transcript → SparkToro (or disabled) → limitation → no new insight → F5"
  echo "OK  market research P5 M5 smoke"
  exit 0
fi

echo "SKIP live P5 M5 — syntax-only milestone; no live deploy or flag flip"
echo "OK  market research P5 M5 smoke"

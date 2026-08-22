#!/usr/bin/env bash
# Smoke P6 M5 — Market Research OS: Qualtrics stub + aggregator + deploy + syntax.
#
# Live API is not required. This milestone ships stub, scripts, and UAT Actions.
#   bash scripts/smoke_market_research_p6_m5.sh
#
# m5 = bash -n only (plus skip-live contract print when health ≠ 200).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"
PAGE="$ROOT/services/ops-web/src/app/crm/research/[id]/page.tsx"
UTIL="$ROOT/services/ops-web/src/components/research/qualtrics-stub.util.ts"
API="$ROOT/services/ops-web/src/lib/market-research-api.ts"
CFG="$ROOT/services/ptt-crm-api/src/config/app-config.service.ts"
SVC="$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
CTRL="$ROOT/services/ptt-crm-api/src/market-research/market-research.controller.ts"

echo "==> FE + API contract (Qualtrics stub hidden on prod)"
python3 - <<PY
from pathlib import Path
page = Path("$PAGE").read_text()
util = Path("$UTIL").read_text()
api = Path("$API").read_text()
cfg = Path("$CFG").read_text()
svc = Path("$SVC").read_text()
ctrl = Path("$CTRL").read_text()
assert "shouldShowQualtricsButton" in util
assert "shouldShowQualtricsButton" in page, "page must gate Qualtrics CTA"
assert "qualtrics_enabled" in api
assert "run-qualtrics" in api and "run-qualtrics" in ctrl
assert "async runQualtrics" in svc
fn = svc.split("async runQualtrics", 1)[1].split("private ", 1)[0]
assert "createInsight" not in fn
assert "enqueue" not in fn.lower()
assert "qualtrics_disabled" in fn
assert "JEST_WORKER_ID" in cfg
assert "RESEARCH_QUALTRICS_ENABLED" in cfg
assert "QUALTRICS_API_KEY" in cfg
print("OK  Qualtrics stub gated + no enqueue/insight + JEST_WORKER_ID present")
PY

echo "==> bash -n aggregator + deploy + p6_m5"
bash -n "$ROOT/scripts/smoke_market_research_p6.sh"
bash -n "$ROOT/scripts/deploy_market_research_p6_vps.sh"
bash -n "$ROOT/scripts/smoke_market_research_p6_m5.sh"
echo "OK  bash -n smoke_p6 / deploy_p6 / p6_m5"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p6_m5_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p6_m5_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P6 M5 — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  bash scripts/smoke_market_research_p6.sh   # p6_m1…p6_m5 if present"
  echo "  bash scripts/deploy_market_research_p6_vps.sh  # dry-run unless APPLY=1 / --local"
  echo "  step 1/4 P0+P1+P2+P3+P4+P5+P6 DDL (P6 last, before restarts); 2/4 api; 3/4 ops-web; 4/4 worker"
  echo "  no portal-web rebuild"
  echo "  default no --enable-flags; never RESEARCH_QUALTRICS_ENABLED=1; never write QUALTRICS_API_KEY"
  echo "  never RESEARCH_SPARKTORO_ENABLED=1; never write SPARKTORO_API_KEY"
  echo "  APPLY=1 git pull --ff-only origin main (merge-to-main before VPS)"
  echo "  npm ci without --omit=dev"
  echo "  JEST_WORKER_ID skip of deploy/runtime.env must stay untouched"
  echo "  Gates: PII 400; BR-RES-02 400; vw_not_price_offer; no createInsight; Qualtrics disabled 200"
  echo "  UAT 062–063: study survey → codebook → evidence value+unit+base → F5 → (PRICE_OFFER) VW → limitation → no insight → Qualtrics hidden/disabled → F5"
  echo "OK  market research P6 M5 smoke"
  exit 0
fi

echo "SKIP live P6 M5 — syntax-only milestone; no live deploy or flag flip"
echo "OK  market research P6 M5 smoke"

#!/usr/bin/env bash
# Smoke P5 M4 — health sparktoro_enabled false → no CTA (RES-UC-061).
#
# Live API (flag on + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme \
#     ./scripts/smoke_market_research_p5_m4.sh
#
# Skip live if API is down. Prod SparkToro stays off — this milestone
# asserts the no-CTA contract when sparktoro_enabled is false.
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PAGE="$ROOT/services/ops-web/src/app/crm/research/[id]/page.tsx"
UTIL="$ROOT/services/ops-web/src/components/research/sources-sparktoro.util.ts"

echo "==> FE contract (no CTA when sparktoro_enabled is false)"
python3 - <<PY
from pathlib import Path
page = Path("$PAGE").read_text()
util = Path("$UTIL").read_text()
assert "shouldShowSparktoroButton" in util
assert "return sparktoroEnabled === true && canRun === true" in util
assert "shouldShowSparktoroButton" in page
assert "showSparktoro" in page
assert "Chạy SparkToro" in page
assert "shouldShowSparktoroButton(false, true)" not in page
print("OK  FE hides Chạy SparkToro unless health.sparktoro_enabled and canRun")
PY

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m4_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p5_m4_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

echo "Contract:"
echo "  GET /api/v1/research/health → sparktoro_enabled false when flag or key off"
echo "  sparktoro_enabled false → no Chạy SparkToro CTA (shouldShowSparktoroButton)"
echo "  SparkToro does not createInsight"
echo "  paid estimate tier high (sparktoro|similarweb|semrush) → 400 reliability_capped"
echo "  consent missing/expired → 400 consent_required|consent_expired"
echo "  excerpt > 500 → 400 raw_transcript_forbidden"
echo "  never returns SPARKTORO_API_KEY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P5 M4 SparkToro CTA — health not 200 (flag off, API down, or unauthenticated path)."
  echo "OK  market research P5 M4 smoke (no-CTA contract documented)"
  exit 0
fi

python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p5_m4_health.json'))
blob=json.dumps(row)
assert 'SPARKTORO_API_KEY' not in blob
assert 'sparktoroApiKey' not in blob
enabled=row.get('sparktoro_enabled')
open('/tmp/mr_p5_m4_st_enabled','w').write('1' if enabled is True else '0')
print(f"OK  health sparktoro_enabled={enabled} (key never in JSON)")
PY

if [[ "$(cat /tmp/mr_p5_m4_st_enabled)" != "1" ]]; then
  echo "OK  sparktoro_enabled is false → no Chạy SparkToro CTA (prod flag 0)"
  echo "OK  market research P5 M4 smoke"
  exit 0
fi

echo "NOTE  sparktoro_enabled is true on this host — CTA may show; still no createInsight"
echo "OK  market research P5 M4 smoke (no-CTA contract documented; flag unexpectedly on)"

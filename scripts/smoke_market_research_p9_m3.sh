#!/usr/bin/env bash
# P9 M3 — service sparktoro credits + disabled contract (no live HTTP required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/market-research.service.spec.ts -t sparktoro --passWithNoTests --no-coverage

echo "Contract:"
echo "  flag/key off → 200 {ok:true, note:sparktoro_disabled}; no HTTP"
echo "  jobs_disabled sync → credits_used on succeedAiRun output_json"
echo "  HTTP error → failAiRun sparktoro_failed; no createInsight"

HTTP_CODE="$(curl -sS -o /tmp/mr_p9_m3_health.json -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || true)"
if [[ "$HTTP_CODE" == "200" ]]; then
  python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p9_m3_health.json'))
assert 'SPARKTORO_API_KEY' not in json.dumps(row)
print(f"OK  health sparktoro_enabled={row.get('sparktoro_enabled')}")
PY
else
  echo "SKIP live health — http=$HTTP_CODE"
fi
echo "OK  P9 M3 sparktoro service gates"

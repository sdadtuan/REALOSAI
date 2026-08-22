#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'talkwalker_disabled' "$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
grep -q 'run-talkwalker' "$ROOT/services/ptt-crm-api/src/market-research/market-research.controller.ts"
grep -q 'shouldShowTalkwalkerButton' "$ROOT/services/ops-web/src/app/crm/research/[id]/page.tsx"
grep -q 'TALKWALKER_STUB_RESULTS' "$ROOT/services/ptt-crm-api/src/market-research/talkwalker-stub.util.ts"
if grep -R -q 'api.talkwalker.com' "$ROOT/services/ptt-crm-api/src/market-research/"; then
  echo "FAIL  api.talkwalker.com under services/ptt-crm-api/src/market-research/"
  exit 1
fi
echo "OK  P23 M3 stub gates + no vendor host"

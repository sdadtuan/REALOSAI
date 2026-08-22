#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'bakePublishedValidTo' "$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
grep -q 'published_valid_to' "$ROOT/services/ptt-crm-api/src/market-research/report-publish-bake.util.ts"
echo "OK  P32 M3 bake wiring"

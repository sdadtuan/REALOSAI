#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='market-research|portal-research' --passWithNoTests --no-coverage
npm test -- --testPathPattern='src/market-research/talkwalker-client.util.spec.ts|src/market-research/talkwalker-collect.spec.ts' --passWithNoTests --no-coverage
echo "OK  P36 M5 api + talkwalker client regression"

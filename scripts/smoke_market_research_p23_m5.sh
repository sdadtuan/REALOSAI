#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='market-research|portal-research' --passWithNoTests --no-coverage
cd "$ROOT/services/ops-web"
npm run test:unit -- src/components/research/sources-talkwalker.util.spec.ts
echo "OK  P23 M5 api + ops-web talkwalker util tests"

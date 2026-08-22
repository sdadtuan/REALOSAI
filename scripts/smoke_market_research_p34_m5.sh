#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='market-research|portal-research' --passWithNoTests --no-coverage
cd "$ROOT/services/ops-web"
npm run test:unit -- src/components/research/conjoint-pane.util.test.ts
echo "OK  P34 M5 api + ops conjoint util"

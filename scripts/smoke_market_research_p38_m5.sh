#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='market-research|portal-research' --passWithNoTests --no-coverage
cd "$ROOT/services/ops-web"
npx vitest run src/components/research/conjoint-pane.util.test.ts --passWithNoTests
echo "OK  P38 M5 api + ops conjoint util regression"

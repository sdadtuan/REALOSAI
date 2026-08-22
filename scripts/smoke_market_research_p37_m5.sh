#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='market-research|portal-research' --passWithNoTests --no-coverage
cd "$ROOT/services/ops-web"
npm test -- --run src/components/research/iso-gap-panel.util.spec.ts --passWithNoTests 2>/dev/null || \
  npx vitest run src/components/research/iso-gap-panel.util.spec.ts --passWithNoTests
echo "OK  P37 M5 api + ops-web util regression"

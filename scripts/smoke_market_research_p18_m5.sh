#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='market-research|portal-research' --passWithNoTests --no-coverage
cd "$ROOT/services/ops-web"
npm test -- --run src/components/research/insight-stale.util.spec.ts 2>/dev/null || npx vitest run src/components/research/insight-stale.util.spec.ts
echo "OK  P18 M5 full research + FE stale util"

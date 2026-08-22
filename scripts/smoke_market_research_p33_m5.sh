#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='market-research|portal-research' --passWithNoTests --no-coverage
cd "$ROOT/services/portal-web"
npx --yes vitest@2 run src/lib/published-valid-to.util.spec.ts src/lib/insight-stale.util.spec.ts
cd "$ROOT/services/ops-web"
npm run test:unit -- src/lib/published-valid-to.util.spec.ts src/components/research/insight-stale.util.spec.ts
echo "OK  P33 M5 api + FE util regression"

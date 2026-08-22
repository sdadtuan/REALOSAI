#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='market-research|portal-research' --passWithNoTests --no-coverage
cd "$ROOT/services/portal-web"
npx --yes vitest@2 run src/lib/portal-conjoint.util.spec.ts src/lib/published-valid-to.util.spec.ts
echo "OK  P35 M5 api + portal util regression"

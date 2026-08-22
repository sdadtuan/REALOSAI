#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='portal-research' --passWithNoTests --no-coverage
cd "$ROOT/services/portal-web"
npx --yes vitest@2 run src/lib/portal-report-list.util.spec.ts src/lib/insight-stale.util.spec.ts
echo "OK  P41 M5 api portal-research + portal-web stale helpers"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ops-web"
npx --yes vitest@2 run src/lib/report-stale.util.spec.ts src/lib/staff-report-list.util.spec.ts
echo "OK  P43 M5 ops-web stale list helpers"

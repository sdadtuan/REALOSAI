#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ops-web"
npx --yes vitest@2 run src/lib/staff-report-stale.util.spec.ts
echo "OK  P44 M2 staffReportVersionHasStaleInsights unit tests"

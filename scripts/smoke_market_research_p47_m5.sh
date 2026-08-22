#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/portal-web"
npx --yes vitest@2 run src/lib/portal-report-list.util.spec.ts
echo "OK  P47 M5 portal stale list helpers aggregate"

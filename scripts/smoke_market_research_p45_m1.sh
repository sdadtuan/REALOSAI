#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ops-web"
npx --yes vitest@2 run src/lib/staff-report-list.util.spec.ts
echo "OK  P45 M1 staff-report-list filter unit tests"

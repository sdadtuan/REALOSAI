#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- \
  --testPathPattern='src/market-research/market-research.service.spec.ts|src/portal-research/portal-research.service.spec.ts' \
  --testNamePattern='P29' \
  --passWithNoTests \
  --no-coverage
echo "OK  P29 M3 staff + portal PDF export stale footer"

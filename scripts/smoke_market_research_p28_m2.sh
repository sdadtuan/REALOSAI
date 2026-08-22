#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/market-research.service.spec.ts src/portal-research/portal-research.service.spec.ts --testNamePattern='P28|P20' --verbose --no-coverage
echo "OK  P28 M2 ANN path + JSONB fallback"

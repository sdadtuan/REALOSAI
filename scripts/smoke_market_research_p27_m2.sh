#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/market-research.service.spec.ts src/portal-research/portal-research.service.spec.ts --testNamePattern='P27' --verbose --no-coverage
echo "OK  P27 M2 staff/portal search + copilot exclude stale"

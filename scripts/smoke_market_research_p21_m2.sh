#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/market-research.service.spec.ts --testNamePattern='P21|cj_' --verbose --no-coverage
echo "OK  P21 M2 conjoint service"

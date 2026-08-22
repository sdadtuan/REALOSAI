#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/market-research.service.spec.ts --testNamePattern='P23' --verbose --no-coverage
echo "OK  P23 M2 runTalkwalker service"

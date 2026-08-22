#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/market-research.repository.spec.ts --testNamePattern='getThemeQuarterAnalytics' --verbose --no-coverage
echo "OK  P14 M1 repo theme quarter SQL"

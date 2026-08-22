#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/market-research.service.spec.ts --testNamePattern='P16 getThemeQuarterAnalytics' --verbose --no-coverage
echo "OK  P16 M2 service QoQ YoY enrich"

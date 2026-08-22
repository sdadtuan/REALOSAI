#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/market-research.service.spec.ts --testNamePattern='P44|listReports' --verbose --no-coverage
echo "OK  P44 M1 listReports has_stale_insights service"

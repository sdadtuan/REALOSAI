#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='market-research' --passWithNoTests --no-coverage
echo "OK  P14 M5 full market-research test suite"

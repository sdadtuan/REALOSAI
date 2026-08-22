#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='market-research|portal-research|report-pdf-stale' --passWithNoTests --no-coverage
echo "OK  P29 M5 api market-research + portal-research tests"

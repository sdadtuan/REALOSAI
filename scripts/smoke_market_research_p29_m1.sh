#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='src/market-research/report-pdf-stale.util.spec.ts' --testNamePattern='P29' --passWithNoTests --no-coverage
echo "OK  P29 M1 report-pdf-stale util"

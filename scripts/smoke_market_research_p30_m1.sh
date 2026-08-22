#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='src/market-research/market-research.service.spec.ts' --testNamePattern='P30' --passWithNoTests --no-coverage
echo "OK  P30 M1 staff search stale_only"

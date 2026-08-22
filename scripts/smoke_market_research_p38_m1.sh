#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='src/market-research/market-research.service.spec.ts' --testNamePattern='P38|P34 what-if on PRICE_OFFER' --passWithNoTests --no-coverage
echo "OK  P38 M1 service persist what-if"

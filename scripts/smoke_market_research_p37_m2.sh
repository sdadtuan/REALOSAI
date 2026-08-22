#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='src/market-research/market-research.service.spec.ts' --testNamePattern='P37' --passWithNoTests --no-coverage
echo "OK  P37 M2 service ISO gap-check"

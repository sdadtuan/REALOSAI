#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='src/market-research/report-publish-bake.util.spec.ts' --testNamePattern='P32' --passWithNoTests --no-coverage
echo "OK  P32 M1 bake util"

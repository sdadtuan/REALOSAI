#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='src/market-research/market-research.repository.spec.ts' --testNamePattern='P38' --passWithNoTests --no-coverage
echo "OK  P38 M2 repo what-if runs SQL"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/market-research.repository.spec.ts --testNamePattern='P20' --verbose --no-coverage
echo "OK  P20 M2 repository pgvector SQL"

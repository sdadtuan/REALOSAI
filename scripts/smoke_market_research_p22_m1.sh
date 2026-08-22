#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/market-research.repository.spec.ts --testNamePattern='P22 listEmbeddings' --verbose --no-coverage
echo "OK  P22 M1 listEmbeddings valid_to"

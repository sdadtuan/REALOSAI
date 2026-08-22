#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/pgvector.util.spec.ts --testNamePattern='P20' --verbose --no-coverage
echo "OK  P20 M1 pgvector util"

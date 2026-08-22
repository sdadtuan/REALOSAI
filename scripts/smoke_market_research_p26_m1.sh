#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/pgvector-ready.util.spec.ts --testNamePattern='P26' --verbose --no-coverage
echo "OK  P26 M1 pgvector-ready util"

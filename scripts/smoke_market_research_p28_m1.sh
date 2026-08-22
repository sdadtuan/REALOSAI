#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/pgvector.util.spec.ts --testNamePattern='P20|P28' --verbose --no-coverage
echo "OK  P28 M1 shouldUsePgvectorAnn ready gate"

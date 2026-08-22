#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/research-rag.util.spec.ts --testNamePattern='P19 rankRagHits' --verbose --no-coverage
echo "OK  P19 M1 rankRagHits stale"

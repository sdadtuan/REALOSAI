#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/research-rag.util.spec.ts --testNamePattern='P25' --verbose --no-coverage
echo "OK  P25 M1 rankRagHits stale_only"

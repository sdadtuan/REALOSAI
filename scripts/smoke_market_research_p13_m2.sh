#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/market-research.service.spec.ts --testNamePattern='P13 RAG re-embed' --verbose --no-coverage
echo "OK  P13 M2 API preview + start reembed"

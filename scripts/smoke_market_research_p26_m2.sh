#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/market-research.service.spec.ts src/portal-research/portal-research.service.spec.ts --testNamePattern='P26' --verbose --no-coverage
echo "OK  P26 M2 health rag_pgvector_ready probe cache"

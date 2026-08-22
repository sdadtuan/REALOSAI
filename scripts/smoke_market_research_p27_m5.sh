#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='market-research|portal-research|research-rag.util' --passWithNoTests --no-coverage
echo "OK  P27 M5 api market-research + portal-research + rankRagHits tests"

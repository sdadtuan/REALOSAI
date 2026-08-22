#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='portal-research|research-rag.util' --passWithNoTests --no-coverage
echo "OK  P25 M5 api portal-research + rankRagHits tests"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='src/market-research/pgvector-ivfflat.util.spec.ts' --testNamePattern='P36' --passWithNoTests --no-coverage
echo "OK  P36 M1 IVFFlat util"

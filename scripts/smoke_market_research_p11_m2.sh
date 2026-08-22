#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q '"G3"' "$ROOT/scripts/fixtures/research-rag-goldset.json"
grep -q 'needs_openai_query_vec' "$ROOT/scripts/fixtures/research-rag-goldset.json"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/research-rag.util.spec.ts --verbose --no-coverage
echo "OK  P11 M2 gold-set G1–G3 + rankRagHits queryVec"

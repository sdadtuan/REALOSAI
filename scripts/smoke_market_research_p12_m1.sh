#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q '"G4"' "$ROOT/scripts/fixtures/research-rag-goldset.json"
grep -q 'portal_published_only' "$ROOT/scripts/fixtures/research-rag-goldset.json"
grep -q 'corpusStatuses' "$ROOT/services/ptt-crm-api/src/market-research/research-rag.util.ts"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/research-rag.util.spec.ts --verbose --no-coverage
echo "OK  P12 M1 corpusStatuses + gold-set G4"

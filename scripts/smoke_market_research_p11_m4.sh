#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'rag_openai_embed_enabled' "$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
grep -q 'rag_openai_embed_enabled' "$ROOT/services/ops-web/src/lib/market-research-api.ts"
grep -q 'rag_embed_model' "$ROOT/services/ops-web/src/lib/market-research-api.ts"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/market-research.service.spec.ts -t "health rag_openai" --verbose --no-coverage
echo "OK  P11 M4 health + FE types"

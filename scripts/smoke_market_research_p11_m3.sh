#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'resolveInsightEmbedding' "$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
grep -q 'embed_model' "$ROOT/services/ptt-crm-api/src/market-research/market-research.repository.ts"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/market-research.service.spec.ts -t "P11 OpenAI embed path" --verbose --no-coverage
echo "OK  P11 M3 service approve/search + DDL columns wired"

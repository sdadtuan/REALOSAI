#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UTIL="$ROOT/services/ptt-crm-api/src/market-research/openai-embed.util.ts"
grep -q 'fetchOpenAIEmbedding' "$UTIL"
grep -q 'l2Normalize' "$UTIL"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/openai-embed.util.spec.ts --verbose --no-coverage
echo "OK  P11 M1 openai embed client"

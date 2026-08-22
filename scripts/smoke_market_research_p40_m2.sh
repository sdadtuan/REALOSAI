#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'previewResearchRagReembed' "$ROOT/services/ops-web/src/lib/market-research-api.ts"
grep -q 'startResearchRagReembed' "$ROOT/services/ops-web/src/lib/market-research-api.ts"
grep -q 'rag/reembed/preview' "$ROOT/services/ops-web/src/lib/market-research-api.ts"
grep -q 'rag/reembed' "$ROOT/services/ops-web/src/lib/market-research-api.ts"
echo "OK  P40 M2 ops-web re-embed API client"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'valid_to' "$ROOT/services/ptt-crm-api/src/market-research/market-research.repository.ts"
grep -q 'InsightStaleBanner' "$ROOT/services/ops-web/src/components/research/InsightsRagSearch.tsx"
grep -q 'is_stale' "$ROOT/services/ops-web/src/lib/market-research-api.ts"
echo "OK  P22 M3 listEmbeddings + staff RAG banner + ResearchRagHit"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'staff-rag-stale-only' "$ROOT/services/ops-web/src/components/research/InsightsRagSearch.tsx"
grep -q 'stale_only' "$ROOT/services/ops-web/src/lib/market-research-api.ts"
grep -q 'Không có insight hết hạn khớp tìm kiếm' "$ROOT/services/ops-web/src/components/research/InsightsRagSearch.tsx"
echo "OK  P30 M3 ops-web stale-only checkbox"

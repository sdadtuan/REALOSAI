#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'is_stale' "$ROOT/services/ops-web/src/lib/market-research-api.ts"
grep -q 'InsightStaleBanner' "$ROOT/services/ops-web/src/components/research/InsightCard.tsx"
grep -q 'Chỉ hết hạn' "$ROOT/services/ops-web/src/app/crm/research/[id]/page.tsx"
grep -q 'is_stale' "$ROOT/services/ptt-crm-api/src/market-research/market-research.repository.ts"
echo "OK  P18 M3 ops-web stale banner + filter"

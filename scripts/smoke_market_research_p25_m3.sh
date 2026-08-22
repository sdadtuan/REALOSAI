#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'stale_only' "$ROOT/services/ptt-crm-api/src/market-research/market-research.types.ts"
grep -q 'parseRagStaleOnlyFlag' "$ROOT/services/ptt-crm-api/src/market-research/research-rag.util.ts"
grep -q 'stale_only' "$ROOT/services/ptt-crm-api/src/portal-research/portal-research.service.ts"
grep -q 'Chỉ hết hạn' "$ROOT/services/portal-web/src/components/PortalResearchRagSearch.tsx"
grep -q 'stale_only' "$ROOT/services/portal-web/src/lib/api.ts"
echo "OK  P25 M3 stale_only API + portal RAG filter UI"

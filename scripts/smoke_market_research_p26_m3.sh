#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'rag_pgvector_ready' "$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
grep -q 'rag_pgvector_ready' "$ROOT/services/ptt-crm-api/src/portal-research/portal-research.service.ts"
grep -q 'probePgvectorReady' "$ROOT/services/ptt-crm-api/src/market-research/market-research.repository.ts"
test -f "$ROOT/scripts/install_pgvector_vps.sh"
test -f "$ROOT/scripts/verify_pgvector_market_research.sh"
echo "OK  P26 M3 health field + install/verify scripts"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'pgvectorReady' "$ROOT/services/ptt-crm-api/src/market-research/pgvector.util.ts"
grep -q 'ragPgvectorReady' "$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
grep -q 'write_vec: this.config.researchRagPgvectorEnabled && this.ragPgvectorReady' "$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
grep -q '\-\-enable-pgvector-staging' "$ROOT/scripts/deploy_market_research_p28_vps.sh"
echo "OK  P28 M3 ready gate + dual-write + deploy staging flag"

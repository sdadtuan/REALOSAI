#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$ROOT/scripts/install_pgvector_vps.sh"
bash -n "$INSTALL"
grep -q 'apply_pg_ddl_market_research_p20.sh' "$INSTALL"
grep -q 'apply_pg_ddl_market_research_p36.sh' "$INSTALL"
grep -q 'rag_ivfflat_ready' "$INSTALL"
echo "OK  P39 M3 install_pgvector chains P20 + P36"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'research_rag_reembed' "$ROOT/ptt_worker/__main__.py"
grep -q 'rag_reembed' "$ROOT/docs/specs/2026-08-15-postgresql-ddl-market-research-p13.sql"
test -f "$ROOT/scripts/deploy_market_research_p13_vps.sh"
echo "OK  P13 M4 deploy + worker dispatch"

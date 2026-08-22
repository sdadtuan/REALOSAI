#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
test -f "$ROOT/docs/specs/2026-08-15-postgresql-ddl-market-research-p11.sql"
test -f "$ROOT/scripts/apply_pg_ddl_market_research_p11.sh"
test -f "$ROOT/scripts/deploy_market_research_p11_vps.sh"
grep -q 'Walkthrough UAT P11' "$ROOT/docs/use-cases/actions/12-RES-ACTIONS.md"
grep -q 'rag_openai_embed_enabled' "$ROOT/docs/specs/modules/RNOSAI-BA-RES-UseCases.md"
echo "OK  P11 M5 DDL + deploy script + UAT docs present"

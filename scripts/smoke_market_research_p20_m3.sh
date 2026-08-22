#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'RESEARCH_RAG_PGVECTOR_ENABLED' "$ROOT/services/ptt-crm-api/src/config/app-config.service.ts"
grep -q 'embedding_vec' "$ROOT/docs/specs/2026-08-15-postgresql-ddl-market-research-p20.sql"
grep -q 'WARN  P20 skipped' "$ROOT/scripts/apply_pg_ddl_market_research_p20.sh"
echo "OK  P20 M3 config + DDL + fail-soft apply"

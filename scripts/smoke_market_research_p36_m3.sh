#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'fetchTalkwalkerSearchResults' "$ROOT/services/ptt-crm-api/src/market-research/talkwalker-client.util.ts"
grep -q 'talkwalker_live' "$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
grep -q 'crm_research_emb_vec_ivf' "$ROOT/docs/specs/2026-08-16-postgresql-ddl-market-research-p36.sql"
grep -q 'rag_ivfflat_ready' "$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
echo "OK  P36 M3 IVFFlat DDL + live Talkwalker wiring"

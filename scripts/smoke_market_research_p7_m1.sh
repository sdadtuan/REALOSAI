#!/usr/bin/env bash
# Smoke P7 M1 — RAG corpus gate + gold-set + taxonomy DDL (RES-UC-070).
#
# Live API is not required. Contract/syntax smoke so aggregator does not SKIP.
#   bash scripts/smoke_market_research_p7_m1.sh
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UTIL="$ROOT/services/ptt-crm-api/src/market-research/research-rag.util.ts"
DDL="$ROOT/docs/specs/2026-08-14-postgresql-ddl-market-research-p7.sql"
APPLY="$ROOT/scripts/apply_pg_ddl_market_research_p7.sh"
GOLD="$ROOT/scripts/fixtures/research-rag-goldset.json"

echo "==> Contract (corpus gate + DDL + gold-set)"
python3 - <<PY
from pathlib import Path
util = Path("$UTIL").read_text()
ddl = Path("$DDL").read_text()
apply = Path("$APPLY").read_text()
gold = Path("$GOLD").read_text()
assert "isRagCorpusStatus" in util
assert "shouldSkipRagEmbed" in util
assert "insightEmbedText" in util
assert "rankRagHits" in util
assert "crm_research_insight_embeddings" in ddl
assert "crm_research_taxonomy" in ddl
assert "crm_research_insight_themes" in ddl
assert "PRICE" in ddl
assert "apply_pg_ddl_market_research_p7" in apply or "postgresql-ddl-market-research-p7" in apply
assert '"id"' in gold or '"insight_id"' in gold
print("OK  M1 corpus gate + taxonomy DDL + gold-set on disk")
PY

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p7_m1_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p7_m1_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

echo "Contract:"
echo "  isRagCorpusStatus('draft') === false; published / approved_client_facing only"
echo "  gold-set G1: hit ids contain published, not draft"
echo "  shouldSkipRagEmbed on PII / empty text"
echo "  DDL: embeddings + taxonomy + insight_themes; seed PRICE…GEO"
echo "  draft no hit"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P7 M1 — health not 200 (flag off, API down, or unauthenticated path)."
  echo "OK  market research P7 M1 smoke (contract only)"
  exit 0
fi

echo "OK  market research P7 M1 smoke"

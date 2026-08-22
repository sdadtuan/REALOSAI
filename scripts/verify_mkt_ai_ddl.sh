#!/usr/bin/env bash
# Verify MKT-AI planner DDL applied (WS-INFRA-01)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"

echo "==> Verify MKT-AI DDL on ${DATABASE_URL%%@*}@***"

TABLES=(
  mkt_ai_briefs
  mkt_ai_drafts
  mkt_ai_jobs
  mkt_ai_campaigns
  mkt_ai_content_assets
  mkt_ai_plan_versions
  mkt_ai_exports
  mkt_ai_documents
  mkt_ai_document_chunks
  mkt_ai_budget_scenarios
  mkt_ai_approvals
)

for t in "${TABLES[@]}"; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}'" \
    | grep -q 1 || { echo "FAIL missing table: ${t}"; exit 1; }
  echo "OK  table ${t}"
done

MIG=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tAc \
  "SELECT count(*) FROM schema_migrations WHERE version='2026-08-08-mkt-ai-planner'")
if [[ "${MIG}" != "1" ]]; then
  echo "FAIL schema_migrations row missing (got ${MIG})"
  exit 1
fi
echo "OK  schema_migrations 2026-08-08-mkt-ai-planner"
echo "OK  MKT-AI DDL verified"

#!/usr/bin/env bash
# Smoke M0 — Market Research OS: 10 tables + health flag contract.
#
# Tables (if DATABASE_URL reachable):
#   ./scripts/smoke_market_research_m0.sh
#
# Health 404 when flag is off (API must be running with PTT_MARKET_RESEARCH_ENABLED=0):
#   API_BASE=http://127.0.0.1:3000 ./scripts/smoke_market_research_m0.sh --health
#
# Health 200 when flag is on:
#   PTT_MARKET_RESEARCH_ENABLED=1  → GET /api/v1/research/health → {"ok":true,"enabled":true}
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

MODE="${1:-tables}"
EXPECTED_TABLES=(
  crm_research_projects
  crm_research_questions
  crm_research_sources
  crm_research_evidence
  crm_research_insights
  crm_research_insight_evidence
  crm_research_reviews
  crm_research_reports
  crm_research_report_versions
  crm_research_ai_runs
)

if [[ "$MODE" == "--health" ]]; then
  API_BASE="${API_BASE:-http://127.0.0.1:3000}"
  URL="$API_BASE/api/v1/research/health"
  echo "==> GET $URL (expect 404 market_research_disabled when flag=0)"
  HTTP_CODE="$(curl -sS -o /tmp/mr_m0_health.json -w '%{http_code}' "$URL" || true)"
  BODY="$(cat /tmp/mr_m0_health.json 2>/dev/null || true)"
  echo "http=$HTTP_CODE body=$BODY"
  if [[ "$HTTP_CODE" == "404" ]]; then
    echo "$BODY" | grep -q 'market_research_disabled'
    echo "OK  health 404 market_research_disabled (flag off)"
    exit 0
  fi
  if [[ "$HTTP_CODE" == "200" ]]; then
    echo "$BODY" | grep -q '"ok":true'
    echo "$BODY" | grep -q '"enabled":true'
    echo "OK  health 200 {ok:true, enabled:true} (flag on)"
    echo "NOTE: to assert 404, restart API with PTT_MARKET_RESEARCH_ENABLED=0"
    exit 0
  fi
  echo "FAIL unexpected health http=$HTTP_CODE" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "SKIP tables — DATABASE_URL unset"
  echo "Health check (flag off): API_BASE=http://127.0.0.1:3000 $0 --health"
  echo "Expected 404 {\"error\":\"market_research_disabled\"} when PTT_MARKET_RESEARCH_ENABLED=0"
  echo "Expected 200 {\"ok\":true,\"enabled\":true} when PTT_MARKET_RESEARCH_ENABLED=1"
  exit 0
fi

if ! psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
  echo "SKIP tables — Postgres unreachable (shipped SQL + apply script)"
  echo "Health check (flag off): API_BASE=http://127.0.0.1:3000 $0 --health"
  echo "Expected 404 {\"error\":\"market_research_disabled\"} when PTT_MARKET_RESEARCH_ENABLED=0"
  echo "Expected 200 {\"ok\":true,\"enabled\":true} when PTT_MARKET_RESEARCH_ENABLED=1"
  exit 0
fi

echo "==> Assert crm_research_* tables (10)"
MISSING=0
for t in "${EXPECTED_TABLES[@]}"; do
  FOUND="$(psql "$DATABASE_URL" -tAc "SELECT to_regclass('public.$t')" 2>/dev/null || true)"
  if [[ "$FOUND" == "public.$t" || "$FOUND" == "$t" ]]; then
    echo "  OK  $t"
  else
    echo "  MISS $t"
    MISSING=1
  fi
done

if [[ "$MISSING" -ne 0 ]]; then
  echo "FAIL missing crm_research_* tables — run scripts/apply_pg_ddl_market_research.sh" >&2
  exit 1
fi

echo "OK  market research M0 tables (10)"
echo "Health (flag off): API_BASE=http://127.0.0.1:3000 $0 --health"
echo "  expect HTTP 404 {\"error\":\"market_research_disabled\"} when PTT_MARKET_RESEARCH_ENABLED=0"
echo "  expect HTTP 200 {\"ok\":true,\"enabled\":true} when PTT_MARKET_RESEARCH_ENABLED=1"

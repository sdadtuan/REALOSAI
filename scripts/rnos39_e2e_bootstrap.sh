#!/usr/bin/env bash
# RNOS-39 — Bootstrap Postgres + DDL + lead fixture for AI Copilot E2E
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="${ROOT}${PYTHONPATH:+:$PYTHONPATH}"

ENV_FILE="${RNOS39_ENV:-$ROOT/deploy/env.local.example}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"

# shellcheck source=rnosai_pg_guard.sh
source "$ROOT/scripts/rnosai_pg_guard.sh"
rnosai_assert_database_url "$DATABASE_URL"

LEAD_ID="${OPS_E2E_AI_LEAD_ID:-9000050}"

echo "== RNOS-39 E2E bootstrap =="
echo "   DATABASE_URL=${DATABASE_URL%%@*}@***"

if [[ "${CI:-}" != "true" ]] && command -v docker >/dev/null 2>&1; then
  echo "==> docker compose up postgres"
  docker compose up -d postgres 2>/dev/null || true
fi

_wait_pg() {
  for _ in $(seq 1 40); do
    if psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
      echo "OK  postgres ready"
      return 0
    fi
    sleep 1
  done
  echo "FAIL postgres not ready" >&2
  return 1
}
_wait_pg

_apply_sql() {
  local file="$1"
  if [[ -f "$file" ]]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
  fi
}

if ! python3 -c "from ptt_crm.pg_schema import pg_leads_replica_ready; assert pg_leads_replica_ready()" 2>/dev/null; then
  echo "==> Apply PG v1 + v2 (fresh database)"
  _apply_sql "$ROOT/docs/specs/2026-07-17-postgresql-ddl-v1.sql"
  _apply_sql "$ROOT/docs/specs/2026-07-17-postgresql-ddl-v2-leads.sql"
fi

echo "==> Apply PG v3 (if needed)"
if python3 -c "from ptt_crm.pg_schema import pg_v3_ready; import sys; sys.exit(0 if pg_v3_ready() else 1)" 2>/dev/null; then
  echo "OK  v3 already applied"
else
  bash "$ROOT/scripts/apply_pg_ddl_v3.sh"
fi

echo "==> Apply domain_events idempotency (required for LeadScored / LeadScoreOverridden emit)"
bash "$ROOT/scripts/apply_pg_ddl_v3_events_idempotency.sh" 2>/dev/null || true

echo "==> Apply Revenue OS AI DDL"
APPLY=1 bash "$ROOT/scripts/rnos01_pg_ddl_gate.sh" || bash "$ROOT/scripts/apply_pg_ddl_revenue_os_ai.sh"

echo "==> Seed minimal leads (if empty)"
LEAD_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM crm_leads;" 2>/dev/null | tr -d ' ' || echo 0)
if [[ "${LEAD_COUNT:-0}" -lt 5 ]]; then
  SEED_LOCAL=1 MIN_SAMPLE=10 bash "$ROOT/scripts/rnos_phase0_gate.sh" || true
fi

echo "==> Ensure lead ${LEAD_ID} owned by stub staff (owner_id=1)"
psql "$DATABASE_URL" -q -c \
  "UPDATE crm_leads SET owner_id = 1 WHERE sqlite_lead_id = ${LEAD_ID};" 2>/dev/null || true

# Activity notes still write to SQLite (crm_lead_activities FK → crm_leads.id)
SQLITE="${PTT_SQLITE_PATH:-$ROOT/ptt.db}"
if [[ -f "$SQLITE" ]]; then
  echo "==> Ensure SQLite crm_leads row for lead ${LEAD_ID} (follow-up accept FK)"
  sqlite3 "$SQLITE" <<SQL
INSERT OR IGNORE INTO crm_leads (
  id, full_name, phone, phone_norm, email, email_norm, source, status,
  owner_id, created_at, updated_at, created_by, updated_by
) VALUES (
  ${LEAD_ID},
  'Gate Sample ${LEAD_ID}',
  '0900000050',
  '0900000050',
  'gate${LEAD_ID}@example.invalid',
  'gate${LEAD_ID}@example.invalid',
  'meta',
  'new',
  1,
  datetime('now'),
  datetime('now'),
  'rnos39-e2e',
  'rnos39-e2e'
);
UPDATE crm_leads SET owner_id = 1 WHERE id = ${LEAD_ID};
SQL
fi

echo "OK  RNOS-39 bootstrap complete (lead_id=${LEAD_ID})"

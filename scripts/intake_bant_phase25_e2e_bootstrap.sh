#!/usr/bin/env bash
# INT-P25-18 — Reset lead funnel fixture for Funnel Stepper Playwright E2E
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${INT_P25_E2E_ENV:-$ROOT/deploy/env.local.example}"
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

echo "== INT-P25-18 E2E bootstrap (lead_id=${LEAD_ID}) =="

if [[ "${CI:-}" != "true" ]] && command -v docker >/dev/null 2>&1; then
  docker compose up -d postgres 2>/dev/null || true
fi

for _ in $(seq 1 40); do
  if psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! psql "$DATABASE_URL" -tAc "SELECT to_regclass('crm_lead_intake_sessions')" | grep -q crm_lead_intake_sessions; then
  echo "==> Apply Wave B5 PG DDL (funnel + intake)"
  bash "$ROOT/scripts/apply_pg_ddl_wave_b5_oltp.sh"
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<SQL
UPDATE crm_leads
SET owner_id = 1,
    care_stage_current = 'first_contact',
    care_stages_done_json = jsonb_build_object('first_contact', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    meta_json = COALESCE(meta_json, '{}'::jsonb) - 'review_queue'
WHERE sqlite_lead_id = ${LEAD_ID};

UPDATE crm_lead_presales
SET stage = 'lead',
    stage_entered_at = NOW(),
    updated_at = NOW()
WHERE lead_id = ${LEAD_ID};

DELETE FROM crm_lead_intake_sessions WHERE lead_id = ${LEAD_ID};
SQL

SQLITE="${PTT_SQLITE_PATH:-$ROOT/ptt.db}"
if [[ -f "$SQLITE" ]]; then
  sqlite3 "$SQLITE" <<SQL
INSERT OR IGNORE INTO crm_leads (
  id, full_name, phone, phone_norm, email, email_norm, source, status,
  owner_id, created_at, updated_at, created_by, updated_by
) VALUES (
  ${LEAD_ID},
  'E2E Stepper ${LEAD_ID}',
  '0900000050',
  '0900000050',
  'stepper${LEAD_ID}@example.invalid',
  'stepper${LEAD_ID}@example.invalid',
  'meta',
  'new',
  1,
  datetime('now'),
  datetime('now'),
  'int-p25-e2e',
  'int-p25-e2e'
);
UPDATE crm_leads SET owner_id = 1 WHERE id = ${LEAD_ID};
SQL
fi

echo "OK  INT-P25-18 bootstrap complete"

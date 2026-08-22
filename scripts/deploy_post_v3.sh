#!/usr/bin/env bash
# Post-v3 production deploy — data hygiene + RNOS-01 Timeline + optional extras
#
# Run after: ./scripts/apply_pg_ddl_v3.sh
#
# Usage:
#   cd /var/www/rnosai
#   set -a && source .env && set +a
#   ./scripts/deploy_post_v3.sh
#
# Options:
#   --backup          pg_dump before mutations
#   --skip-fk         skip orphan cleanup + VALIDATE CONSTRAINT
#   --skip-idempotency  skip apply_pg_ddl_v3_events_idempotency.sh
#   --skip-hub        skip sync_hub_campaign_map.sh
#   --skip-rnos01     skip RNOS-01 (Timeline DDL)
#   --with-modules    apply extra v3/v4/v5 DDL scripts (creatives, hub_sop, …)
#   --dry-run         print plan + orphan count only
#   -h|--help
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="${ROOT}${PYTHONPATH:+:$PYTHONPATH}"

DO_BACKUP=0
SKIP_FK=0
SKIP_IDEMPOTENCY=0
SKIP_HUB=0
SKIP_RNOS01=0
WITH_MODULES=0
DRY_RUN=0

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \?//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup) DO_BACKUP=1 ;;
    --skip-fk) SKIP_FK=1 ;;
    --skip-idempotency) SKIP_IDEMPOTENCY=1 ;;
    --skip-hub) SKIP_HUB=1 ;;
    --skip-rnos01) SKIP_RNOS01=1 ;;
    --with-modules) WITH_MODULES=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

: "${DATABASE_URL:?DATABASE_URL required — run: set -a && source .env && set +a}"

# shellcheck source=rnosai_pg_guard.sh
source "$ROOT/scripts/rnosai_pg_guard.sh"
rnosai_assert_database_url "$DATABASE_URL"

PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
fi

step_ok() { echo "OK    $*"; }
step_fail() { echo "FAIL  $*" >&2; exit 1; }
step_skip() { echo "SKIP  $*"; }
step_info() { echo "==> $*"; }

run_script() {
  local label="$1"
  local path="$2"
  step_info "$label"
  if [[ "$DRY_RUN" == "1" ]]; then
    step_skip "(dry-run) would run: $path"
    return 0
  fi
  bash "$path" || step_fail "$label"
  step_ok "$label"
}

echo "== Post-v3 deploy =="
echo "   DATABASE_URL=${DATABASE_URL%%@*}@***"
echo "   PYTHON=$PYTHON"
echo "   backup=$DO_BACKUP skip_fk=$SKIP_FK skip_idempotency=$SKIP_IDEMPOTENCY skip_hub=$SKIP_HUB skip_rnos01=$SKIP_RNOS01 with_modules=$WITH_MODULES dry_run=$DRY_RUN"
echo ""

step_info "Pre-check PG v3"
"$PYTHON" -c "
from ptt_crm.pg_schema import pg_v3_ready
import sys
if not pg_v3_ready():
    sys.exit('PG v3 not ready — run ./scripts/apply_pg_ddl_v3.sh first')
print('OK    pg_v3_ready')
" || step_fail "v3 prerequisite"

if [[ "$DO_BACKUP" == "1" ]]; then
  step_info "Backup (pg_dump)"
  if [[ "$DRY_RUN" == "1" ]]; then
    step_skip "(dry-run) would pg_dump to /tmp/post-v3-backup-*.sql.gz"
  else
    mkdir -p /tmp
    backup_path="/tmp/post-v3-backup-$(date +%Y%m%d-%H%M%S).sql.gz"
    pg_dump "$DATABASE_URL" | gzip > "$backup_path"
    step_ok "backup → $backup_path"
  fi
fi

if [[ "$SKIP_FK" != "1" ]]; then
  step_info "Orphan agency_client_id check"
  orphan_count="$("$PYTHON" -c "
from ptt_jobs.db import pg_connection
with pg_connection() as conn:
    with conn.cursor() as cur:
        cur.execute('''
            SELECT COUNT(*) FROM crm_leads l
            WHERE l.agency_client_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = l.agency_client_id)
        ''')
        print(int(cur.fetchone()[0] or 0))
")"
  echo "      orphan_leads=$orphan_count"
  if [[ "$orphan_count" -gt 0 ]]; then
    if [[ "$DRY_RUN" == "1" ]]; then
      step_skip "(dry-run) would SET agency_client_id = NULL on $orphan_count rows"
    else
      step_info "Fix orphan agency_client_id → NULL"
      "$PYTHON" -c "
from ptt_jobs.db import pg_connection
with pg_connection() as conn:
    with conn.cursor() as cur:
        cur.execute('''
            UPDATE crm_leads SET agency_client_id = NULL
            WHERE agency_client_id IS NOT NULL
              AND agency_client_id NOT IN (SELECT id FROM clients)
        ''')
        print(f'      updated={cur.rowcount}')
    conn.commit()
"
      step_ok "orphan cleanup"
    fi
  else
    step_ok "no orphan agency_client_id"
  fi

  step_info "VALIDATE CONSTRAINT crm_leads_agency_client_fk"
  if [[ "$DRY_RUN" == "1" ]]; then
    step_skip "(dry-run) would VALIDATE CONSTRAINT"
  else
    if command -v psql >/dev/null 2>&1; then
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
        "ALTER TABLE crm_leads VALIDATE CONSTRAINT crm_leads_agency_client_fk;"
    else
      "$PYTHON" -c "
from ptt_jobs.db import pg_connection
with pg_connection() as conn:
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute('ALTER TABLE crm_leads VALIDATE CONSTRAINT crm_leads_agency_client_fk')
"
    fi
    step_ok "FK validated"
  fi
else
  step_skip "FK orphan cleanup (--skip-fk)"
fi

if [[ "$SKIP_IDEMPOTENCY" != "1" ]]; then
  run_script "domain_events idempotency DDL" "$ROOT/scripts/apply_pg_ddl_v3_events_idempotency.sh"
else
  step_skip "idempotency DDL (--skip-idempotency)"
fi

if [[ "$SKIP_RNOS01" != "1" ]]; then
  run_script "RNOS-01 Revenue OS + AI (Timeline)" "$ROOT/scripts/apply_pg_ddl_revenue_os_ai.sh"
  if [[ "$DRY_RUN" != "1" ]]; then
    step_info "RNOS-01 verify"
    "$PYTHON" -c "
from ptt_crm.pg_schema import (
    pg_revenue_os_ai_migration_applied,
    pg_revenue_os_ai_r1_core_ready,
    pg_revenue_os_ai_ready,
    pg_revenue_os_ai_smoke_insert_ok,
)
checks = [
    ('migration_applied', pg_revenue_os_ai_migration_applied()),
    ('r1_core_ready', pg_revenue_os_ai_r1_core_ready()),
    ('full_ready', pg_revenue_os_ai_ready()),
    ('smoke_insert_ok', pg_revenue_os_ai_smoke_insert_ok()),
]
for name, ok in checks:
    print(f'      {name}: {\"OK\" if ok else \"FAIL\"}')
    if not ok:
        raise SystemExit(1)
" || step_fail "RNOS-01 verify"
    step_ok "RNOS-01 verified"
  fi
else
  step_skip "RNOS-01 (--skip-rnos01)"
fi

if [[ "$SKIP_HUB" != "1" ]]; then
  if [[ -f "${PTT_SQLITE_PATH:-$ROOT/ptt.db}" ]]; then
    run_script "hub_campaign_map sync" "$ROOT/scripts/sync_hub_campaign_map.sh"
  else
    step_skip "hub sync — SQLite not found (${PTT_SQLITE_PATH:-$ROOT/ptt.db})"
  fi
else
  step_skip "hub sync (--skip-hub)"
fi

if [[ "$WITH_MODULES" == "1" ]]; then
  step_info "Optional module DDL (--with-modules)"
  module_scripts=(
    apply_pg_ddl_v3_sprint0.sh
    apply_pg_ddl_v3_creatives.sh
    apply_pg_ddl_v3_launch_qa.sh
    apply_pg_ddl_v3_google_sync.sh
    apply_pg_ddl_v3_leads_ingest_config.sh
    apply_pg_ddl_v4_hub_sop.sh
    apply_pg_ddl_v5_campaign_writes.sh
    apply_pg_ddl_staff_auth.sh
  )
  for script in "${module_scripts[@]}"; do
    path="$ROOT/scripts/$script"
    if [[ -x "$path" ]]; then
      run_script "$script" "$path"
    else
      step_skip "$script (not found)"
    fi
  done
fi

if [[ "$DRY_RUN" == "1" ]]; then
  echo ""
  echo "Dry-run complete — re-run without --dry-run to apply."
  exit 0
fi

step_info "Final verify"
"$PYTHON" -c "
from ptt_crm.pg_schema import (
    pg_v3_ready,
    pg_revenue_os_ai_migration_applied,
    pg_domain_events_idempotency_ready,
)

checks = [('v3', pg_v3_ready())]
if ${SKIP_RNOS01} != 1:
    checks.append(('RNOS-01 migration', pg_revenue_os_ai_migration_applied()))
if ${SKIP_IDEMPOTENCY} != 1:
    checks.append(('domain_events idempotency', pg_domain_events_idempotency_ready()))
for name, ok in checks:
    print(f'      {name}: {\"OK\" if ok else \"FAIL\"}')
    if not ok:
        raise SystemExit(1)
"

timeline="$("$PYTHON" -c "
from ptt_jobs.db import pg_connection
with pg_connection() as conn:
    with conn.cursor() as cur:
        cur.execute(\"SELECT to_regclass('public.customer_timeline_events')::text\")
        print(cur.fetchone()[0] or 'NULL')
")"
if [[ "$SKIP_RNOS01" != "1" ]]; then
  echo "      customer_timeline_events: $timeline"
fi

echo ""
echo "Post-v3 deploy complete."
echo "Next: refresh lead detail on rs.pttads.vn (Timeline should load)."
echo "Staging-only (NOT run here): staging_write_cutover_pilot.sh · staging_closed_loop_pilot.sh"

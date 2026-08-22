#!/usr/bin/env bash
# RNOS-01 — Apply Revenue OS + AI Intelligence PostgreSQL DDL
# Spec: docs/specs/2026-07-26-postgresql-ddl-revenue-os-ai.sql
# UC: AI-UC-008 (timeline prerequisite) · Gate: Phase 0
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="${ROOT}${PYTHONPATH:+:$PYTHONPATH}"

: "${DATABASE_URL:?DATABASE_URL required — source deploy/env.local.example}"

# shellcheck source=rnosai_pg_guard.sh
source "$ROOT/scripts/rnosai_pg_guard.sh"
rnosai_assert_database_url "$DATABASE_URL"

DRY_RUN="${DRY_RUN:-0}"
SKIP_APPLY="${SKIP_APPLY:-0}"

PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
fi

echo "== RNOS-01 Apply Revenue OS AI DDL =="
echo "   DATABASE_URL=${DATABASE_URL%%@*}@***"
echo "   DRY_RUN=$DRY_RUN SKIP_APPLY=$SKIP_APPLY"

"$PYTHON" - <<'PY'
import os
import sys

from ptt_crm.pg_schema import (
    MIGRATION_REVENUE_OS_AI,
    REVENUE_OS_AI_R1_CORE_TABLES,
    REVENUE_OS_AI_TABLES,
    apply_ddl_revenue_os_ai,
    ddl_revenue_os_ai_path,
    pg_revenue_os_ai_migration_applied,
    pg_revenue_os_ai_prerequisites_ready,
    pg_revenue_os_ai_smoke_insert_ok,
    pg_revenue_os_ai_table_counts,
    pg_v3_ready,
)
from ptt_jobs.db import pg_connection


def fail(msg: str) -> None:
    print(f"FAIL  {msg}", file=sys.stderr)
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"OK    {msg}")


def present_tables() -> set[str]:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = ANY(%s)
                """,
                (list(REVENUE_OS_AI_TABLES),),
            )
            return {row[0] for row in cur.fetchall()}


dry_run = os.environ.get("DRY_RUN", "0") == "1"
skip_apply = os.environ.get("SKIP_APPLY", "0") == "1"

ddl_path = ddl_revenue_os_ai_path()
if not ddl_path.is_file():
    fail(f"DDL file missing: {ddl_path}")

print(f"==> DDL file: {ddl_path}")

if not pg_v3_ready():
    fail("PG v3 OLTP not ready — apply ./scripts/apply_pg_ddl_v3.sh first")

if not pg_revenue_os_ai_prerequisites_ready():
    fail("Prerequisites missing — need clients, domain_events, crm_leads (v1 + v2/v3)")

ok("prerequisites: clients, domain_events, crm_leads")

already = pg_revenue_os_ai_migration_applied() and len(present_tables()) >= len(REVENUE_OS_AI_TABLES)
if already:
    ok(f"migration already applied ({MIGRATION_REVENUE_OS_AI})")
    if skip_apply:
        print("==> SKIP_APPLY=1 — verify only")
elif dry_run:
    ok("DRY_RUN — would apply DDL")
    sys.exit(0)

if not skip_apply:
    print("==> Applying DDL …")
    try:
        apply_ddl_revenue_os_ai()
    except Exception as exc:
        fail(f"apply DDL: {exc}")
    ok("DDL SQL executed")

if not pg_revenue_os_ai_migration_applied():
    fail(f"schema_migrations missing version {MIGRATION_REVENUE_OS_AI}")

ok(f"schema_migrations: {MIGRATION_REVENUE_OS_AI}")

found = present_tables()
missing = [t for t in REVENUE_OS_AI_TABLES if t not in found]
if missing:
    fail(f"tables missing after apply: {', '.join(missing)}")

ok(f"all {len(REVENUE_OS_AI_TABLES)} Revenue OS AI tables present")

core_missing = [t for t in REVENUE_OS_AI_R1_CORE_TABLES if t not in found]
if core_missing:
    fail(f"R1 core tables missing: {', '.join(core_missing)}")

ok(f"R1 core: {', '.join(REVENUE_OS_AI_R1_CORE_TABLES)}")

if not pg_revenue_os_ai_smoke_insert_ok():
    fail("ai_agent_runs smoke insert/delete failed")

ok("ai_agent_runs smoke insert/delete")

counts = pg_revenue_os_ai_table_counts()
for table, n in counts.items():
    print(f"      {table}: {n} rows")

print("")
print(f"Applied Revenue OS AI DDL ({MIGRATION_REVENUE_OS_AI})")
print("Next: RNOS-02 AiIntelligenceModule")
PY

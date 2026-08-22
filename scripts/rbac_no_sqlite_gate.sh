#!/usr/bin/env bash
# RBAC-R1 — fail if RBAC scripts use SQLite (policy: PostgreSQL-only permissions)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
ok() { echo "OK   $*"; }
bad() { echo "FAIL $*"; fail=1; }

RBAC_SCRIPTS=(
  scripts/rbac_permissions_pg.py
  scripts/migrate_staff_permissions_pg.py
  scripts/sync_super_admin_caps_pg.py
  scripts/migrate_presales_solution_permissions.py
  scripts/seed_staff_email_mkt_permissions.py
  scripts/seed_staff_meta_permissions.py
  scripts/seed_staff_meta_rbac_b81.py
  scripts/export_staff_section_permissions.py
  scripts/seed_super_admin_full_access.py
)

FORBIDDEN_PATTERNS=(
  'import sqlite3'
  'sqlite3\.connect'
  'crm_position_section_permissions'
  'ptt\.db'
  'data/crm\.db'
)

echo "== RBAC no-SQLite gate =="

for rel in "${RBAC_SCRIPTS[@]}"; do
  path="$ROOT/$rel"
  if [[ ! -f "$path" ]]; then
    bad "missing script $rel"
    continue
  fi
  ok "present $rel"
  for pat in "${FORBIDDEN_PATTERNS[@]}"; do
    if grep -qE "$pat" "$path"; then
      bad "$rel matches forbidden /$pat/"
    fi
  done
done

if [[ ! -x "$ROOT/scripts/rbac_no_sqlite_gate.sh" ]]; then
  bad "rbac_no_sqlite_gate.sh should be executable (chmod +x)"
fi

if [[ "$fail" -ne 0 ]]; then
  echo ""
  echo "RBAC scripts must use PostgreSQL only — see docs/specs/2026-08-06-rbac-enterprise-design.md §3.2"
  exit 1
fi

echo ""
echo "RBAC no-SQLite gate: PASS (${#RBAC_SCRIPTS[@]} scripts)"
exit 0

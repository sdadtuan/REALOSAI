#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
test -f "$ROOT/docs/specs/postgresql-ddl-hr-employee-file-p1.sql"
rg -q 'hr_staff_identity' "$ROOT/docs/specs/postgresql-ddl-hr-employee-file-p1.sql"
rg -q 'HR-UC-001|hr-employee-file-p1' "$ROOT/docs/superpowers/plans/2026-08-18-hr-employee-file-os.md"
echo "OK  P1 M3 docs + DDL present"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DDL="$ROOT/docs/specs/postgresql-ddl-hr-employee-file-p3.sql"
grep -q 'hr_staff_insurance' "$DDL"
grep -q 'hr_insurance_periods' "$DDL"
echo "OK  P3 M3 DDL insurance tables"

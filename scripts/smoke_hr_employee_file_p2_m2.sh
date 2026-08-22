#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/apply_pg_ddl_hr_employee_file_p2.sh"
echo "OK  P2 M2 DDL applied"

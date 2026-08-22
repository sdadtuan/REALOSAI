#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/smoke_hr_employee_file_p4_m1.sh"
bash "$ROOT/scripts/smoke_hr_employee_file_p4_m2.sh"
echo "OK  P4 M5 aggregated"

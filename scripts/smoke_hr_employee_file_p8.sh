#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/smoke_hr_employee_file_p8_m1.sh"
bash "$ROOT/scripts/smoke_hr_employee_file_p8_m2.sh"
echo "OK  HR Employee File P8 smoke"

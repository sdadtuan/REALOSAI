#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for s in m1 m2 m3 m4 m5; do
  bash "$ROOT/scripts/smoke_hr_employee_file_p3_${s}.sh"
done
echo "OK  smoke_hr_employee_file_p3"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "== HR Employee File P1 smoke (m1–m5) =="
for s in m1 m2 m3 m4 m5; do
  echo "==> $ROOT/scripts/smoke_hr_employee_file_p1_${s}.sh"
  bash "$ROOT/scripts/smoke_hr_employee_file_p1_${s}.sh"
done
echo "OK  smoke_hr_employee_file_p1"

#!/usr/bin/env bash
# Deploy HR Employee File P5 — dependents + lifecycle + hub expiry (HR-UC-005).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== HR Employee File P5 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  echo "== 1/2 apply DDL + ptt-crm-api =="
  bash "$ROOT/scripts/apply_pg_ddl_hr_employee_file_p5.sh"
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  export PTT_HR_EMPLOYEE_FILE="${PTT_HR_EMPLOYEE_FILE:-1}"
  npm run build
  npm test -- --testPathPattern='hr-employee-file|hr-staff-p5|hr-insurance|hr-labor-contract' --passWithNoTests --no-coverage
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sleep 3
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " api OK" || echo "WARN  api health check failed"

  echo "== 2/2 ops-web =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  bash "$ROOT/scripts/wave_b1_rebuild_ops_web.sh"
  sudo -n /usr/bin/systemctl restart ptt-ops-web 2>/dev/null || true
  sleep 2
  systemctl is-active ptt-ops-web >/dev/null 2>&1 && echo " ops-web OK" \
    || echo "WARN  ptt-ops-web restart failed or not on VPS"

  echo "== HR Employee File P5 deploy complete =="
  echo "UAT: bash scripts/smoke_hr_employee_file_p5.sh"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=120 \
    "${VPS_USER}@${VPS_HOST}" \
    "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_hr_employee_file_p5_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
fi

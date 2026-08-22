#!/usr/bin/env bash
# Deploy WIN-4-D (HR portal + collab notify) on VPS.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_win4d_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_win4d_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  cd "$ROOT"
  echo "== WIN-4-D deploy @ $(git rev-parse --short HEAD) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== Apply leave + notifications DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_staff_leave_r4.sh"

  RUNTIME_ENV="$ROOT/deploy/runtime.env"
  mkdir -p "$ROOT/deploy"
  touch "$RUNTIME_ENV"
  for kv in \
    "NEXT_PUBLIC_WIN_PAYSLIP_PORTAL=1" \
    "NEXT_PUBLIC_WIN_LEAVE_LITE=1"; do
    key="${kv%%=*}"
    if grep -q "^${key}=" "$RUNTIME_ENV" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${kv}|" "$RUNTIME_ENV"
    else
      echo "$kv" >>"$RUNTIME_ENV"
    fi
  done
  echo "Updated $RUNTIME_ENV"

  echo "== Nest ptt-crm-api =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  npm run build
  npm test -- --testPathPattern="staff-mention\\.util\\.spec"
  sudo -n /usr/bin/systemctl restart ptt-crm-api
  sleep 2
  curl -sf http://127.0.0.1:3000/health && echo " Nest OK"

  echo "== ops-web =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  export NEXT_PUBLIC_WIN_PAYSLIP_PORTAL="${NEXT_PUBLIC_WIN_PAYSLIP_PORTAL:-1}"
  export NEXT_PUBLIC_WIN_LEAVE_LITE="${NEXT_PUBLIC_WIN_LEAVE_LITE:-1}"
  export NEXT_PUBLIC_WIN_SSO="${NEXT_PUBLIC_WIN_SSO:-1}"
  export NEXT_PUBLIC_WIN_POLICY_OPA="${NEXT_PUBLIC_WIN_POLICY_OPA:-1}"
  export NEXT_PUBLIC_WIN_CPL_DIGEST="${NEXT_PUBLIC_WIN_CPL_DIGEST:-1}"
  "$ROOT/scripts/deploy_ops_web.sh" build
  sudo -n /usr/bin/systemctl restart ptt-ops-web
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK"

  echo "== WIN-4-D UAT =="
  bash "$ROOT/scripts/run_win4d_uat.sh" || true

  echo "== WIN-4-D deploy complete =="
  echo "Flags: NEXT_PUBLIC_WIN_PAYSLIP_PORTAL=1 NEXT_PUBLIC_WIN_LEAVE_LITE=1"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_win4d_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_win4d_vps.sh --local"
fi

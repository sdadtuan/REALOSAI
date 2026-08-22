#!/usr/bin/env bash
# Deploy WIN-4-B (Field ABAC + multi-module client scope) on VPS.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_win4b_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_win4b_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  cd "$ROOT"
  echo "== WIN-4-B deploy @ $(git rev-parse --short HEAD) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  RUNTIME_ENV="$ROOT/deploy/runtime.env"
  mkdir -p "$ROOT/deploy"
  touch "$RUNTIME_ENV"
  for kv in \
    "STAFF_SCOPE_PILOT=1" \
    "STAFF_MFA_REQUIRED_POSITIONS=gdkd,super-admin"; do
    key="${kv%%=*}"
    if grep -q "^${key}=" "$RUNTIME_ENV" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${kv}|" "$RUNTIME_ENV"
    else
      echo "$kv" >>"$RUNTIME_ENV"
    fi
  done
  echo "Updated $RUNTIME_ENV"

  echo "== RBAC field registry gate =="
  bash "$ROOT/scripts/rbac_field_registry_gate.sh"

  echo "== Nest ptt-crm-api =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  npm run build
  npm test -- --testPathPattern="field-level|client-scope-modules"
  sudo -n /usr/bin/systemctl restart ptt-crm-api
  sleep 2
  curl -sf http://127.0.0.1:3000/health && echo " Nest OK"

  echo "== ops-web =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  export NEXT_PUBLIC_WIN_SCOPE_PILOT="${NEXT_PUBLIC_WIN_SCOPE_PILOT:-1}"
  export NEXT_PUBLIC_WIN_FIELD_ABAC="${NEXT_PUBLIC_WIN_FIELD_ABAC:-1}"
  export NEXT_PUBLIC_WIN_SSO="${NEXT_PUBLIC_WIN_SSO:-1}"
  export NEXT_PUBLIC_WIN_ORG_UI="${NEXT_PUBLIC_WIN_ORG_UI:-1}"
  "$ROOT/scripts/deploy_ops_web.sh" build
  sudo -n /usr/bin/systemctl restart ptt-ops-web
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK"

  echo "== WIN-4-B UAT =="
  bash "$ROOT/scripts/run_win4b_uat.sh" || true

  echo "== WIN-4-B deploy complete =="
  echo "Flags: NEXT_PUBLIC_WIN_FIELD_ABAC=1 NEXT_PUBLIC_WIN_SCOPE_PILOT=1 STAFF_SCOPE_PILOT=1"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_win4b_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_win4b_vps.sh --local"
fi

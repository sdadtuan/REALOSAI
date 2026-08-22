#!/usr/bin/env bash
# Deploy S-LMP-2 — Lead Meeting Prep MVP UI + RBAC + gate flags on VPS.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_lmp_s2_vps.sh
#
# On VPS directly:
#   cd /var/www/rnosai && git pull origin main && bash scripts/deploy_lmp_s2_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

patch_runtime_env() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0
  [[ -w "$env_file" ]] || {
    echo "SKIP  $env_file (not writable)"
    return 0
  }
  for kv in \
    "PTT_LEAD_MEETING_PREP_ENABLED=1" \
    "PTT_JOBS_ENABLED=1" \
    "NEXT_PUBLIC_LEAD_MEETING_PREP=1"; do
    key="${kv%%=*}"
    if grep -q "^${key}=" "$env_file" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${kv}|" "$env_file"
    else
      echo "$kv" >> "$env_file"
    fi
  done
}

sync_worker_unit() {
  local unit="/etc/systemd/system/ptt-worker.service"
  if ! sudo -n cp "$ROOT/deploy/ptt-worker.service" "$unit" 2>/dev/null; then
    echo "SKIP  worker unit install (sudo cp blocked — run manually as root)"
    return 0
  fi
  if [[ ! -x "$ROOT/.venv/bin/python" && -x "/var/www/ptt/.venv/bin/python" ]]; then
    sudo -n sed -i 's|/var/www/rnosai/.venv|/var/www/ptt/.venv|g' "$unit"
  fi
  sudo -n systemctl daemon-reload
  echo "OK  ptt-worker unit synced to rnosai + runtime.env"
}

run_local() {
  cd "$ROOT"
  echo "== S-LMP-2 deploy @ $(git rev-parse --short HEAD) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi
  if [[ -f "$ROOT/deploy/runtime.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/deploy/runtime.env"
    set +a
  fi
  if [[ -z "${DATABASE_URL:-}" ]]; then
    export DATABASE_URL="postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb"
  fi

  PYTHON="${PYTHON:-python3}"
  if [[ -x "$ROOT/.venv/bin/python" ]]; then
    PYTHON="$ROOT/.venv/bin/python"
  elif [[ -x "/var/www/ptt/.venv/bin/python" ]]; then
    PYTHON="/var/www/ptt/.venv/bin/python"
  fi
  export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"

  echo "== DDL LMP (idempotent) =="
  bash "$ROOT/scripts/apply_pg_ddl_lead_meeting_prep.sh"

  echo "== RBAC seed crm_lmp =="
  "$PYTHON" "$ROOT/scripts/seed_staff_lmp_permissions.py" --apply

  echo "== runtime flags =="
  mkdir -p "$ROOT/deploy"
  touch "$ROOT/deploy/runtime.env"
  patch_runtime_env "$ROOT/deploy/runtime.env"
  patch_runtime_env "$ROOT/.env"
  patch_runtime_env "/etc/ptt/runtime.env" || true

  echo "== Nest ptt-crm-api =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  npm run build
  npm test -- --testPathPattern="lead-meeting-prep|staff-lmp" --passWithNoTests
  sudo -n /usr/bin/systemctl restart ptt-crm-api
  sleep 2
  curl -sf http://127.0.0.1:3000/health && echo " Nest OK"

  echo "== ops-web (LMP panel) =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  export NEXT_PUBLIC_LEAD_MEETING_PREP="${NEXT_PUBLIC_LEAD_MEETING_PREP:-1}"
  "$ROOT/scripts/deploy_ops_web.sh" build
  sudo -n /usr/bin/systemctl restart ptt-ops-web
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK"

  echo "== worker unit + restart =="
  sync_worker_unit
  sudo -n /usr/bin/systemctl restart ptt-worker && sleep 2 && systemctl is-active ptt-worker && echo " worker OK" \
    || echo "WARN  ptt-worker restart failed — check DATABASE_URL in /var/www/rnosai/.env"

  echo "== gate (unit, no Tavily) =="
  bash "$ROOT/scripts/lead_meeting_prep_gate.sh"

  echo "== S-LMP-2 deploy complete =="
  echo "Enable E2E on VPS: LMP_E2E=1 TAVILY_API_KEY=... bash scripts/lead_meeting_prep_gate.sh"
  echo "UAT: docs/runbooks/lmp-uat-p0.md"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_lmp_s2_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_lmp_s2_vps.sh --local"
fi

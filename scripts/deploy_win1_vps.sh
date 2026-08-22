#!/usr/bin/env bash
# Deploy WIN-1 (Competitive Win wave 1) on VPS: DDL R1.5 + Nest + ops-web.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_win1_vps.sh
#
# On VPS directly:
#   cd /var/www/rnosai && git pull origin main && sudo bash scripts/deploy_win1_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  cd "$ROOT"
  echo "== WIN-1 deploy @ $(git rev-parse --short HEAD) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi
  export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"

  echo "== backup =="
  if [[ -x "$ROOT/scripts/backup_ptt_data.sh" ]]; then
    "$ROOT/scripts/backup_ptt_data.sh" || true
  fi

  echo "== DDL R1.5 job functions =="
  "$ROOT/scripts/apply_pg_ddl_staff_job_functions_r1_5.sh"

  echo "== seed job functions =="
  PYTHON="${PYTHON:-python3}"
  if [[ -x "$ROOT/.venv/bin/python" ]]; then
    PYTHON="$ROOT/.venv/bin/python"
  fi
  export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
  if "$PYTHON" "$ROOT/scripts/seed_staff_job_functions_pg.py" --apply 2>/dev/null; then
    echo "seed via python OK"
  else
    echo "seed via python skipped — applying SQL fallback"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) AS functions FROM staff_job_functions;" >/dev/null
  fi

  if [[ "${WIN1_SEED_UAT_PERSONAS:-0}" == "1" ]]; then
    echo "== WIN-1 UAT personas =="
    if [[ -x "$ROOT/scripts/seed_win1_uat_personas.sh" ]]; then
      "$ROOT/scripts/seed_win1_uat_personas.sh" --apply
    else
      "$PYTHON" "$ROOT/scripts/seed_win1_uat_personas.py" --apply || true
    fi
  fi

  echo "== Nest ptt-crm-api =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  npm run build
  sudo -n /usr/bin/systemctl restart ptt-crm-api
  sleep 2
  curl -sf http://127.0.0.1:3000/health && echo " Nest OK"

  echo "== ops-web =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build
  sudo -n /usr/bin/systemctl restart ptt-ops-web
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK"

  echo ""
  echo "WIN-1 deploy complete."
  echo "Verify: https://ops.pttads.vn/admin/crm/permissions/functions"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

echo "==> WIN-1 VPS deploy → ${VPS_USER}@${VPS_HOST}:${VPS_ROOT} (APPLY=$APPLY)"
if [[ "$APPLY" != "1" ]]; then
  echo "Dry-run — set APPLY=1 to pull + deploy on VPS"
  exit 0
fi

ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${VPS_USER}@${VPS_HOST}" \
  "cd '$VPS_ROOT' && git pull --ff-only origin main && sudo bash scripts/deploy_win1_vps.sh --local"

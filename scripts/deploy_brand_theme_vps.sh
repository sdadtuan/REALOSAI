#!/usr/bin/env bash
# Deploy brand theme CSS (ops-web + portal-web) on VPS after git pull.
#
# Laptop:
#   PTT_VPS_HOST=rs.pttads.vn PTT_VPS_ROOT=/var/www/rnosai APPLY=1 ./scripts/deploy_brand_theme_vps.sh
#
# On VPS directly:
#   cd /var/www/rnosai && git pull origin main && sudo ./scripts/deploy_brand_theme_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-1}"

run_local() {
  cd "$ROOT"
  echo "== git pull =="
  git pull --ff-only origin main
  echo ""
  echo "== ops-web =="
  if [[ "$(id -u)" -eq 0 ]]; then
    "$ROOT/scripts/deploy_ops_web.sh" --all
  else
    "$ROOT/scripts/deploy_ops_web.sh" build
    echo "Run: sudo $ROOT/scripts/deploy_ops_web.sh --restart"
  fi
  echo ""
  echo "== portal-web =="
  bash "$ROOT/scripts/wave_p1_rebuild_portal_web.sh"
  if [[ "$(id -u)" -eq 0 ]]; then
    systemctl restart ptt-portal-web
    sleep 2
    systemctl is-active ptt-portal-web
  else
    echo "Run: sudo systemctl restart ptt-portal-web"
  fi
  echo ""
  echo "Theme deploy done. Hard-refresh browser (Cmd+Shift+R)."
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

echo "==> Brand theme VPS deploy → ${VPS_USER}@${VPS_HOST}:${VPS_ROOT} (APPLY=$APPLY)"
if [[ "$APPLY" != "1" ]]; then
  echo "Dry-run only — set APPLY=1 to execute"
  exit 0
fi

ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${VPS_USER}@${VPS_HOST}" \
  "cd '$VPS_ROOT' && git pull --ff-only origin main && sudo bash scripts/deploy_brand_theme_vps.sh --local"

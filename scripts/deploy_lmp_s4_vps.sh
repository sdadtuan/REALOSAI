#!/usr/bin/env bash
# Deploy S-LMP-4 — Deal Close bridge on VPS.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_lmp_s4_vps.sh
#
# On VPS directly:
#   cd /var/www/rnosai && git pull origin main && bash scripts/deploy_lmp_s4_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  bash "$ROOT/scripts/deploy_lmp_s3_vps.sh" --local

  echo ""
  echo "== S-LMP-4 P2 gate (Deal Close bridge) =="
  bash "$ROOT/scripts/lmp_p2_gate.sh"

  echo "== S-LMP-4 deploy complete =="
  echo "UAT: Deal Room → SCI panel + Tạo báo giá 3 gói từ SCI"
  echo "Tip: chạy prep M3 (prep_stage=m3_pre_close) để có deal_room_payload."
}

if [[ "${1:-}" == "--local" ]]; then
  echo "== S-LMP-4 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_lmp_s4_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_lmp_s4_vps.sh --local"
fi

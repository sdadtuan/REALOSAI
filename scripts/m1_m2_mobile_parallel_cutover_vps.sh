#!/usr/bin/env bash
# M1 (CSKH rs.pttads.vn) + M2 (Approver portal.pttads.vn) — one VPS session
# M2 chạy trước khi ưu tiên Approver; M1 sau (cùng change window).
#
#   LOCAL_SYNC=1 APPLY=0 ./scripts/m1_m2_mobile_parallel_cutover_vps.sh
#   LOCAL_SYNC=1 APPLY=1 ./scripts/m1_m2_mobile_parallel_cutover_vps.sh
#
# Chỉ M2 (Approver):
#   SKIP_M1=1 LOCAL_SYNC=1 APPLY=1 ./scripts/m1_m2_mobile_parallel_cutover_vps.sh
#
# Chỉ M1 (CSKH):
#   SKIP_M2=1 LOCAL_SYNC=1 APPLY=1 ./scripts/m1_m2_mobile_parallel_cutover_vps.sh
#
# Env: PTT_VPS_HOST, PTT_VPS_USER, PTT_VPS_ROOT, APPLY, ROLLBACK, LOCAL_SYNC, SKIP_M1, SKIP_M2
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPLY="${APPLY:-0}"
ROLLBACK="${ROLLBACK:-0}"
LOCAL_SYNC="${LOCAL_SYNC:-0}"
SKIP_M1="${SKIP_M1:-0}"
SKIP_M2="${SKIP_M2:-0}"
export PTT_VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
export PTT_VPS_USER="${PTT_VPS_USER:-deploy}"
export PTT_VPS_ROOT="${PTT_VPS_ROOT:-/var/www/ptt}"

echo "== M1 + M2 mobile parallel cutover (M2 Approver first) =="
echo "   VPS: ${PTT_VPS_USER}@${PTT_VPS_HOST}:${PTT_VPS_ROOT}"
echo "   APPLY=$APPLY ROLLBACK=$ROLLBACK LOCAL_SYNC=$LOCAL_SYNC SKIP_M1=$SKIP_M1 SKIP_M2=$SKIP_M2"
echo ""

_run() {
  local label="$1"
  shift
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "== $label"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  "$@"
}

if [[ "$SKIP_M2" != "1" ]]; then
  _run "M2 Portal PWA (Approver — portal.pttads.vn)" \
    env APPLY="$APPLY" ROLLBACK="$ROLLBACK" LOCAL_SYNC="$LOCAL_SYNC" \
    bash "$ROOT/scripts/m2_portal_pwa_staging_cutover_vps.sh"
  LOCAL_SYNC=0
fi

if [[ "$SKIP_M1" != "1" ]]; then
  _run "M1 Staff PWA (CSKH — rs.pttads.vn)" \
    env APPLY="$APPLY" ROLLBACK="$ROLLBACK" LOCAL_SYNC="$LOCAL_SYNC" \
    bash "$ROOT/scripts/m1_pwa_staging_cutover_vps.sh"
fi

echo ""
echo "All requested cutovers finished."
if [[ "$APPLY" == "1" && "$ROLLBACK" != "1" ]]; then
  echo "  Approver: https://portal.pttads.vn/creatives @ mobile + push"
  echo "  CSKH:     https://rs.pttads.vn/crm/leads @ mobile + Add to Home Screen"
fi

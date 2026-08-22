#!/usr/bin/env bash
# RNOS-MOB-P2 — Mobile polish VPS cutover (SSH from laptop, after M1/M2)
#
#   LOCAL_SYNC=1 APPLY=0 ./scripts/mob_p2_polish_staging_cutover_vps.sh
#   LOCAL_SYNC=1 APPLY=1 ./scripts/mob_p2_polish_staging_cutover_vps.sh
#
# Full mobile stack (M2→M1→P2):
#   LOCAL_SYNC=1 APPLY=1 ./scripts/m1_m2_mobile_parallel_cutover_vps.sh
#   LOCAL_SYNC=1 APPLY=1 ./scripts/mob_p2_polish_staging_cutover_vps.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/ptt}"
APPLY="${APPLY:-0}"
LOCAL_SYNC="${LOCAL_SYNC:-0}"
GIT_PULL="${GIT_PULL:-1}"

SSH=(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${VPS_USER}@${VPS_HOST}")
RSYNC=(rsync -avz --delete --exclude node_modules --exclude .next --exclude test-results \
  -e "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new")

echo "== RNOS-MOB-P2 VPS cutover → ${VPS_USER}@${VPS_HOST}:${VPS_ROOT} =="
echo "   APPLY=$APPLY LOCAL_SYNC=$LOCAL_SYNC GIT_PULL=$GIT_PULL"
echo ""

if [[ "$LOCAL_SYNC" == "1" ]]; then
  echo "==> LOCAL_SYNC: P2 polish artifacts"
  (
    cd "$ROOT"
    "${RSYNC[@]}" \
      ./scripts/mob_p2_polish_staging_cutover.sh \
      ./scripts/wave_b1_rebuild_ops_web.sh \
      ./scripts/wave_b2_rebuild_portal_web.sh \
      "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/"
    "${RSYNC[@]}" \
      ./services/ops-web/ \
      "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ops-web/"
    "${RSYNC[@]}" \
      ./services/portal-web/ \
      "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/portal-web/"
  )
  GIT_PULL=0
  echo "OK  LOCAL_SYNC complete"
fi

"${SSH[@]}" bash -s -- "$VPS_ROOT" "$APPLY" "$GIT_PULL" <<'EOS'
set -euo pipefail
VPS_ROOT="$1"
APPLY="$2"
GIT_PULL="$3"
cd "$VPS_ROOT"

test -f "$VPS_ROOT/scripts/mob_p2_polish_staging_cutover.sh" || {
  echo "FAIL: mob_p2_polish_staging_cutover.sh missing — LOCAL_SYNC=1 first"
  exit 1
}

if [[ "$GIT_PULL" == "1" ]]; then
  git pull --ff-only || git pull --ff-only origin HEAD
fi

chmod +x "$VPS_ROOT/scripts/mob_p2_polish_staging_cutover.sh" 2>/dev/null || true
export APPLY="$APPLY"
export M1_PWA_PUBLIC_URL="https://rs.pttads.vn"
export M2_PORTAL_PUBLIC_URL="https://portal.pttads.vn"
export PTT_ENV_FILE="${PTT_ENV_FILE:-/var/www/ptt/.env}"

bash "$VPS_ROOT/scripts/mob_p2_polish_staging_cutover.sh"

if [[ "$APPLY" == "1" ]]; then
  echo ""
  echo "==> P2 smoke"
  echo "  CSKH: lead detail AI tab → bottom sheet"
  echo "  CSKH: /crm/leads pull-to-refresh @ mobile"
  echo "  Approver: /creatives swipe card"
fi
EOS

echo ""
echo "Done. Run gate locally: bash scripts/rnos_mob_p2_polish_gate.sh"

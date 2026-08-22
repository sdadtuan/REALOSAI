#!/usr/bin/env bash
# M1 — PWA staff cutover on VPS rs.pttads.vn (RNOS-41)
#
# Usage (from dev laptop with SSH to VPS):
#   PTT_VPS_HOST=rs.pttads.vn APPLY=0 ./scripts/m1_pwa_staging_cutover_vps.sh
#   LOCAL_SYNC=1 PTT_VPS_HOST=rs.pttads.vn APPLY=1 ./scripts/m1_pwa_staging_cutover_vps.sh
#   APPLY=1 ROLLBACK=1 ./scripts/m1_pwa_staging_cutover_vps.sh
#
# Env:
#   PTT_VPS_HOST   SSH host (default: rs.pttads.vn)
#   PTT_VPS_USER   SSH user (default: deploy)
#   PTT_VPS_ROOT   Repo on VPS (default: /var/www/ptt)
#   LOCAL_SYNC     1 = rsync M1 ops-web + scripts before cutover (code chưa push git)
#   GIT_PULL       1 = git pull on VPS when LOCAL_SYNC=0 (default: 1)
#   APPLY          0 dry-run preflight on VPS | 1 apply cutover
#   ROLLBACK       1 disable PWA (pass-through to m1_pwa_prod_cutover.sh)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/ptt}"
APPLY="${APPLY:-0}"
ROLLBACK="${ROLLBACK:-0}"
GIT_PULL="${GIT_PULL:-1}"
LOCAL_SYNC="${LOCAL_SYNC:-0}"

SSH=(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${VPS_USER}@${VPS_HOST}")
RSYNC=(rsync -avz --delete --exclude node_modules --exclude .next --exclude test-results \
  -e "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new")

echo "== M1 PWA VPS cutover → ${VPS_USER}@${VPS_HOST}:${VPS_ROOT} =="
echo "   APPLY=$APPLY ROLLBACK=$ROLLBACK LOCAL_SYNC=$LOCAL_SYNC GIT_PULL=$GIT_PULL"
echo ""

if [[ "$LOCAL_SYNC" == "1" ]]; then
  echo "==> LOCAL_SYNC: rsync M1 PWA artifacts"
  (
    cd "$ROOT"
    "${RSYNC[@]}" \
      ./scripts/m1_pwa_prod_cutover.sh \
      ./scripts/generate_ops_pwa_icons.py \
      ./scripts/wave_b1_rebuild_ops_web.sh \
      ./deploy/nginx-pwa-sw-cache.snippet.conf \
      "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/"
    "${RSYNC[@]}" \
      ./services/ops-web/ \
      "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ops-web/"
  )
  GIT_PULL=0
  echo "OK  LOCAL_SYNC complete"
fi

"${SSH[@]}" bash -s -- "$VPS_ROOT" "$APPLY" "$ROLLBACK" "$GIT_PULL" "$VPS_HOST" <<'EOS'
set -euo pipefail
VPS_ROOT="$1"
APPLY="$2"
ROLLBACK="$3"
GIT_PULL="$4"
VPS_HOST="$5"
cd "$VPS_ROOT"

echo "==> VPS preflight"
test -d "$VPS_ROOT/.git" || { echo "FAIL: not a git repo: $VPS_ROOT"; exit 1; }
test -f "$VPS_ROOT/scripts/m1_pwa_prod_cutover.sh" || {
  echo "FAIL: scripts/m1_pwa_prod_cutover.sh missing — LOCAL_SYNC=1 or git pull first"
  exit 1
}

if [[ "$GIT_PULL" == "1" ]]; then
  echo "==> git pull --ff-only"
  git pull --ff-only || git pull --ff-only origin HEAD
fi

chmod +x "$VPS_ROOT/scripts/m1_pwa_prod_cutover.sh" 2>/dev/null || true

export NEXT_PUBLIC_PTT_API_URL="https://${VPS_HOST}"
export M1_PWA_PUBLIC_URL="https://${VPS_HOST}"
export PTT_ENV_FILE="${PTT_ENV_FILE:-/var/www/ptt/.env}"
export APPLY="$APPLY"
export ROLLBACK="$ROLLBACK"

if [[ "$APPLY" == "1" && "$ROLLBACK" != "1" ]]; then
  if [[ -x "$VPS_ROOT/scripts/backup_ptt_data.sh" ]]; then
    echo "==> Backup before cutover"
    "$VPS_ROOT/scripts/backup_ptt_data.sh" || echo "WARN backup failed — continue at your own risk"
  fi
fi

bash "$VPS_ROOT/scripts/m1_pwa_prod_cutover.sh"

if [[ "$APPLY" == "1" && "$ROLLBACK" != "1" ]]; then
  echo ""
  echo "==> Post-cutover smoke (HTTPS)"
  curl -sf "https://${VPS_HOST}/login" >/dev/null && echo "OK  /login"
  curl -sf "https://${VPS_HOST}/health" >/dev/null && echo "OK  /health"
  if curl -sf "https://${VPS_HOST}/manifest.webmanifest" | grep -q 'PTT CRM'; then
    echo "OK  /manifest.webmanifest"
  else
    echo "WARN /manifest.webmanifest not verified"
  fi
  if curl -sf "https://${VPS_HOST}/sw.js" | grep -q 'ptt-ops-pwa-v1'; then
    echo "OK  /sw.js"
  else
    echo "WARN /sw.js not verified — check nginx proxy + standalone/public/sw.js"
  fi
fi
EOS

echo ""
echo "Done. CSKH smoke: https://${VPS_HOST}/crm/leads @ mobile + Add to Home Screen"

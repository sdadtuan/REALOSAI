#!/usr/bin/env bash
# RNOS-M3 Phase 4 — Rollback Option A: block old app via min_version + force_update
#   bash scripts/m3_ga_rollback_min_version_block.sh [--apply] --min-version 1.0.1 [--force-update 1]
#
# Default: dry-run (print instructions)
# --apply: patch local deploy/env snippet or VPS via M3_VPS_SSH
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPLY=0
MIN_VER="${M3_MIN_VERSION:-}"
FORCE="${M3_FORCE_UPDATE:-1}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --min-version) MIN_VER="$2"; shift 2 ;;
    --force-update) FORCE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$MIN_VER" ]]; then
  echo "Usage: bash scripts/m3_ga_rollback_min_version_block.sh [--apply] --min-version 1.0.1 [--force-update 1]"
  exit 1
fi

echo "== RNOS-M3 rollback Option A — min_version block =="
echo "    PTT_MOBILE_MIN_VERSION=$MIN_VER"
echo "    PTT_MOBILE_FORCE_UPDATE=$FORCE"
echo ""

BLOCK_SNIPPET="# RNOS-M3 rollback $(date -u +%Y-%m-%dT%H:%M:%SZ)
PTT_MOBILE_MIN_VERSION=${MIN_VER}
PTT_MOBILE_FORCE_UPDATE=${FORCE}"

if [[ "$APPLY" -eq 0 ]]; then
  echo "DRY-RUN — add to VPS /var/www/rnosai/.env:"
  echo "$BLOCK_SNIPPET"
  echo ""
  echo "Then: sudo systemctl restart ptt-crm-api"
  echo "Verify: curl -H 'X-PTT-App-Version: 0.0.1' https://portal.pttads.vn/api/v1/mobile/config"
  exit 0
fi

VPS_SSH="${M3_VPS_SSH:-deploy@45.76.157.102}"
VPS_ENV="${M3_VPS_ENV_PATH:-/var/www/rnosai/.env}"

if [[ -n "${M3_VPS_SSH:-}" ]] && ssh -o BatchMode=yes -o ConnectTimeout=8 "$VPS_SSH" "test -f $VPS_ENV" 2>/dev/null; then
  echo "==> Patch VPS env via SSH ($VPS_SSH)"
  ssh "$VPS_SSH" "grep -q '^PTT_MOBILE_MIN_VERSION=' $VPS_ENV && sed -i.bak 's/^PTT_MOBILE_MIN_VERSION=.*/PTT_MOBILE_MIN_VERSION=${MIN_VER}/' $VPS_ENV || echo 'PTT_MOBILE_MIN_VERSION=${MIN_VER}' >> $VPS_ENV"
  ssh "$VPS_SSH" "grep -q '^PTT_MOBILE_FORCE_UPDATE=' $VPS_ENV && sed -i.bak 's/^PTT_MOBILE_FORCE_UPDATE=.*/PTT_MOBILE_FORCE_UPDATE=${FORCE}/' $VPS_ENV || echo 'PTT_MOBILE_FORCE_UPDATE=${FORCE}' >> $VPS_ENV"
  ssh "$VPS_SSH" "sudo systemctl restart ptt-crm-api || true"
  echo "OK  VPS env updated — verify mobile/config"
else
  LOCAL_SNIP="$ROOT/.local-dev/m3-rollback-min-version.env"
  mkdir -p "$(dirname "$LOCAL_SNIP")"
  printf '%s\n' "$BLOCK_SNIPPET" > "$LOCAL_SNIP"
  echo "OK  Wrote $LOCAL_SNIP (VPS SSH unavailable — merge manually)"
fi

#!/usr/bin/env bash
# Run WIN-3 UAT on VPS with PG precondition checks.
#
#   APPLY=1 ./scripts/vps_run_win3_uat.sh
set -euo pipefail

VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_remote() {
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && set -a && source .env && set +a && \
    export WIN3_UAT_PG=1 OPS_UAT_URL=http://127.0.0.1:3200 OPS_UAT_API=http://127.0.0.1:3000 && \
    bash scripts/run_win3_uat.sh"
}

if [[ "$APPLY" == "1" ]]; then
  run_remote
else
  echo "Dry-run. Set APPLY=1 to run WIN-3 UAT on ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
fi

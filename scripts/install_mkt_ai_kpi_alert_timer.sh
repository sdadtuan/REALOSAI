#!/usr/bin/env bash
# Install MKT-AI KPI drift alert systemd timer (WS-P2-03)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${SYSTEMD_DEST:-/etc/systemd/system}"
UNITS=(
  ptt-mkt-ai-kpi-alert.service
  ptt-mkt-ai-kpi-alert.timer
)
echo "==> Copy MKT-AI KPI alert timer → $DEST"
for u in "${UNITS[@]}"; do
  src="$ROOT/deploy/$u"
  if [[ ! -f "$src" ]]; then
    echo "missing: $src" >&2
    exit 1
  fi
  sudo cp "$src" "$DEST/"
done
sudo systemctl daemon-reload
echo "==> Enable timer"
sudo systemctl enable --now ptt-mkt-ai-kpi-alert.timer
echo "==> Status"
systemctl list-timers --no-pager 'ptt-mkt-ai-kpi-alert.timer' || true
echo "Done. Ensure .env: PTT_MKT_AI_KPI_ALERT_ENABLED=1 PTT_MKT_AI_PLANNER_ENABLED=1"

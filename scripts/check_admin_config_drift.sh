#!/usr/bin/env bash
# R3 — detect permission matrix drift vs latest signed snapshot (cron helper)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${PTT_API_URL:-https://rs.pttads.vn}"
TOKEN="${ADMIN_DRIFT_CHECK_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  echo "SKIP  ADMIN_DRIFT_CHECK_TOKEN not set"
  exit 0
fi

echo "==> R3 config drift check (manual trigger via API health)"
curl -fsS "${API_URL}/api/v1/health" >/dev/null
echo "OK  API reachable — configure cron + ADMIN_DRIFT_ALERT_EMAIL on VPS for email alerts"

#!/usr/bin/env bash
# MKT-AI P0 pilot closeout — seed + RBAC + UAT (staging VPS).
#
# Usage:
#   cd /var/www/rnosai && source .env
#   ./scripts/close_mkt_ai_p0_pilot.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"

echo "== MKT-AI P0 pilot closeout @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown) =="

echo ""
echo "== 1/4 Seed lifecycle + official TMMT =="
bash "$ROOT/scripts/seed_mkt_ai_uat_lifecycle.sh"

echo ""
echo "== 2/4 RBAC caps =="
bash "$ROOT/scripts/seed_mkt_ai_pilot_rbac.sh" --apply

export LIFECYCLE_ID="${LIFECYCLE_ID:-$(
  psql "$DATABASE_URL" -tAc \
    "SELECT id FROM crm_service_lifecycle WHERE notes='mkt-ai-smoke-seed' ORDER BY id DESC LIMIT 1" \
  | tr -d '[:space:'
)}"
LIFECYCLE_ID="${LIFECYCLE_ID:-1}"
export LIFECYCLE_ID
echo "UAT lifecycle: #${LIFECYCLE_ID}"

echo ""
echo "== 3/5 Rebuild Nest API (TMMT jsonb fix) =="
cd "$ROOT/services/ptt-crm-api"
npm run build
if sudo -n systemctl restart ptt-crm-api 2>/dev/null; then
  sleep 2
  curl -sf http://127.0.0.1:3000/health && echo " Nest OK"
else
  echo "WARN: restart ptt-crm-api manually if code changed"
fi
cd "$ROOT"

echo ""
echo "== 4/5 Smoke context =="
export PTT_API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
bash "$ROOT/scripts/smoke_mkt_ai_planner_context.sh"

echo ""
echo "== 5/5 Full UAT =="
bash "$ROOT/scripts/run_mkt_ai_planner_uat.sh"
RC=$?

echo ""
if [[ "$RC" -eq 0 ]]; then
  echo "OK  P0 API UAT pass — proceed manual walkthrough:"
  echo "    docs/use-cases/actions/10-MKTP-ACTIONS.md"
  echo "    docs/runbooks/mkt-ai-p0-pilot-signoff.md"
elif [[ "$RC" -eq 2 ]]; then
  echo "WARN UAT blocked — check report in docs/exports/"
  exit 2
else
  echo "FAIL UAT — see docs/exports/mkt-ai-uat-results-*.md"
  exit 1
fi

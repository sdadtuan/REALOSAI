#!/usr/bin/env bash
# MKT-AI prod pilot rollback — hide tab + disable API (≤5 min target).
#
# Usage (on VPS):
#   cd /var/www/rnosai && bash scripts/mkt_ai_prod_pilot_rollback.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RUNTIME_ENV="$ROOT/deploy/runtime.env"

echo "== MKT-AI prod pilot ROLLBACK @ $(date -Iseconds) =="

touch "$RUNTIME_ENV"
for kv in \
  "PTT_MKT_AI_PLANNER_ENABLED=0" \
  "NEXT_PUBLIC_MKT_AI_PLANNER=0"; do
  key="${kv%%=*}"
  if grep -q "^${key}=" "$RUNTIME_ENV" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${kv}|" "$RUNTIME_ENV"
  else
    echo "$kv" >>"$RUNTIME_ENV"
  fi
done
echo "Updated $RUNTIME_ENV (planner OFF, FE tab OFF)"

if sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null; then
  sleep 2
  curl -sf http://127.0.0.1:3000/health && echo " Nest restarted"
else
  echo "WARN: sudo systemctl restart ptt-crm-api manually"
fi

if [[ -x "$ROOT/scripts/deploy_ops_web.sh" ]]; then
  if sudo -n "$ROOT/scripts/deploy_ops_web.sh" --restart 2>/dev/null; then
    echo "OK  ops-web restarted (NEXT_PUBLIC_MKT_AI_PLANNER=0 in runtime.env — rebuild if tab still visible)"
  else
    echo "WARN: sudo ./scripts/deploy_ops_web.sh --restart manually"
    echo "      Or rebuild: NEXT_PUBLIC_MKT_AI_PLANNER=0 ./scripts/deploy_ops_web.sh"
  fi
fi

LIFECYCLE_ID="${MKT_AI_PILOT_LIFECYCLE_ID:-1}"
HTTP="$(curl -sS -o /tmp/mkt-ai-rollback.json -w "%{http_code}" \
  -H "x-ptt-internal-key: ${PTT_CRM_INTERNAL_KEY:-}" \
  "http://127.0.0.1:3000/api/crm/service-lifecycle/${LIFECYCLE_ID}/ai-planner/context" 2>/dev/null || echo 000)"
if [[ "$HTTP" == "404" ]]; then
  echo "OK  API returns 404 mkt_ai_planner_disabled (lifecycle #${LIFECYCLE_ID})"
else
  echo "WARN context HTTP ${HTTP} — verify PTT_MKT_AI_PLANNER_ENABLED=0 loaded"
fi

echo "Rollback complete — data retained (mkt_ai_* tables unchanged)"

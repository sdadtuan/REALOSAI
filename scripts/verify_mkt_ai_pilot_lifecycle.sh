#!/usr/bin/env bash
# Verify real client lifecycle is ready for MKT-AI prod pilot (read-only PG checks).
#
# Usage:
#   export DATABASE_URL=postgresql://...
#   export MKT_AI_PILOT_LIFECYCLE_ID=42
#   export MKT_AI_PILOT_SERVICE_SLUG=meta-lead-gen
#   ./scripts/verify_mkt_ai_pilot_lifecycle.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"
: "${MKT_AI_PILOT_LIFECYCLE_ID:?MKT_AI_PILOT_LIFECYCLE_ID required}"
MKT_AI_PILOT_SERVICE_SLUG="${MKT_AI_PILOT_SERVICE_SLUG:-meta-lead-gen}"

echo "== Verify MKT-AI prod pilot lifecycle #${MKT_AI_PILOT_LIFECYCLE_ID} (slug=${MKT_AI_PILOT_SERVICE_SLUG}) =="

ROW="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tA -F'|' -c \
  "SELECT id, COALESCE(service_slug,''), COALESCE(stage,''), COALESCE(status,''),
          COALESCE(notes,''), COALESCE(marketing_plan_id::text,''),
          COALESCE(lead_id::text,'')
   FROM crm_service_lifecycle WHERE id=${MKT_AI_PILOT_LIFECYCLE_ID}")"

if [[ -z "$ROW" ]]; then
  echo "FAIL lifecycle #${MKT_AI_PILOT_LIFECYCLE_ID} not found"
  exit 1
fi

IFS='|' read -r id slug stage status notes plan_id lead_id <<< "$ROW"
echo "OK  lifecycle #${id} slug=${slug} stage=${stage} status=${status} plan_id=${plan_id:-null}"

if [[ "$slug" != "$MKT_AI_PILOT_SERVICE_SLUG" ]]; then
  echo "FAIL service_slug=${slug} != expected ${MKT_AI_PILOT_SERVICE_SLUG}"
  exit 1
fi
echo "OK  service_slug matches pilot whitelist"

if [[ "$notes" == *mkt-ai-*seed* ]] || [[ "$notes" == *smoke-seed* ]]; then
  echo "WARN notes='${notes}' looks like UAT seed — use real client lifecycle for prod pilot"
fi

if [[ -z "$plan_id" || "$plan_id" == "null" ]]; then
  echo "FAIL no official marketing_plan — promote presales R5 or create official plan first"
  exit 1
fi
echo "OK  official marketing_plan_id=${plan_id}"

BRIEF_COUNT="$(psql "$DATABASE_URL" -tAc \
  "SELECT COUNT(*) FROM mkt_ai_briefs WHERE lifecycle_id=${MKT_AI_PILOT_LIFECYCLE_ID}" \
  | tr -d '[:space:]')"
echo "OK  mkt_ai_briefs rows=${BRIEF_COUNT:-0} (0 = SP will prefill on first open)"

echo "OK  pilot lifecycle verified"

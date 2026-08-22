#!/usr/bin/env bash
# E6 — migrate presales tasks from generic template → service slug template (pilot).
#
# Usage (VPS):
#   cd /var/www/rnosai && set -a && source .env && set +a
#   ./scripts/migrate_presales_workflow_template.sh --lead-id 900000002 --dry-run
#   ./scripts/migrate_presales_workflow_template.sh --lead-id 900000002 --apply
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LEAD_ID=""
DRY_RUN=1
PREFILL=1
API_BASE="${PTT_API_URL:-http://127.0.0.1:3000}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --lead-id) LEAD_ID="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --apply) DRY_RUN=0; shift ;;
    --no-prefill) PREFILL=0; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$LEAD_ID" ]]; then
  echo "Usage: $0 --lead-id <id> [--dry-run|--apply] [--no-prefill]"
  exit 1
fi

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${PTT_CRM_INTERNAL_KEY:?PTT_CRM_INTERNAL_KEY required in .env}"

BODY=$(python3 - <<PY
import json
print(json.dumps({
  "dry_run": bool(${DRY_RUN}),
  "prefill_consult": bool(${PREFILL}),
}))
PY
)

echo "==> POST ${API_BASE}/api/v1/leads/${LEAD_ID}/presales/upgrade-workflow-template (dry_run=${DRY_RUN})"
curl -sf \
  -H "Content-Type: application/json" \
  -H "x-ptt-internal-key: ${PTT_CRM_INTERNAL_KEY}" \
  -X POST \
  -d "$BODY" \
  "${API_BASE}/api/v1/leads/${LEAD_ID}/presales/upgrade-workflow-template" | python3 -m json.tool

echo ""
echo "==> Task snapshot"
psql "${DATABASE_URL:?DATABASE_URL required}" -c "
SELECT t.id, t.stage, t.title, t.is_done, t.ai_prompt_key,
       (SELECT string_agg(f->>'key', ', ' ORDER BY f->>'key')
        FROM jsonb_array_elements(COALESCE(t.form_fields, '[]'::jsonb)) f) AS field_keys
FROM crm_lead_presales_tasks t
JOIN crm_lead_presales ps ON ps.id = t.presales_id
WHERE ps.lead_id = ${LEAD_ID}
ORDER BY t.stage, t.step_index;
"

#!/usr/bin/env bash
# P2-TPL-01 — batch migrate presales generic → service template (Ops off-hours).
#
# Usage (VPS):
#   cd /var/www/rnosai && set -a && source .env && set +a
#   ./scripts/migrate_presales_workflow_batch.sh --dry-run
#   ./scripts/migrate_presales_workflow_batch.sh --dry-run --limit 20
#   ./scripts/migrate_presales_workflow_batch.sh --apply --limit 20 --confirm
#   ./scripts/migrate_presales_workflow_batch.sh --apply --lead-ids 900000002,900000003 --confirm
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DRY_RUN=1
PREFILL=1
LIMIT=""
LEAD_IDS=""
CONFIRM=0
API_BASE="${PTT_API_URL:-http://127.0.0.1:3000}"
CSV_OUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --apply) DRY_RUN=0; shift ;;
    --confirm) CONFIRM=1; shift ;;
    --no-prefill) PREFILL=0; shift ;;
    --limit) LIMIT="$2"; shift 2 ;;
    --lead-ids) LEAD_IDS="$2"; shift 2 ;;
    --csv-out) CSV_OUT="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${PTT_CRM_INTERNAL_KEY:?PTT_CRM_INTERNAL_KEY required in .env}"

if [[ "$DRY_RUN" -eq 0 ]]; then
  batch_flag="${PTT_PRESALES_BATCH_UPGRADE:-0}"
  if [[ "$batch_flag" != "1" && "$batch_flag" != "true" && "$batch_flag" != "yes" && "$batch_flag" != "on" ]]; then
    echo "ERROR: --apply requires PTT_PRESALES_BATCH_UPGRADE=1 on API (.env) after presales_p2_prod_gate PASS"
    exit 1
  fi
  if [[ "$CONFIRM" -ne 1 && "${PRESALES_BATCH_CONFIRM:-}" != "YES" ]]; then
    echo "ERROR: --apply requires --confirm or PRESALES_BATCH_CONFIRM=YES (Ops off-hours batch)"
    exit 1
  fi
  echo "==> APPLY batch upgrade (off-hours) — limit=${LIMIT:-all} lead_ids=${LEAD_IDS:-cohort}"
fi

BODY=$(python3 - <<PY
import json
body = {
  "dry_run": bool(${DRY_RUN}),
  "prefill_consult": bool(${PREFILL}),
}
limit = "${LIMIT}".strip()
if limit:
    body["limit"] = int(limit)
lead_ids = "${LEAD_IDS}".strip()
if lead_ids:
    body["lead_ids"] = [int(x.strip()) for x in lead_ids.split(",") if x.strip()]
print(json.dumps(body))
PY
)

echo "==> POST ${API_BASE}/api/v1/leads/presales/batch-upgrade-workflow (dry_run=${DRY_RUN})"
RESP=$(curl -sf \
  -H "Content-Type: application/json" \
  -H "x-ptt-internal-key: ${PTT_CRM_INTERNAL_KEY}" \
  -X POST \
  -d "$BODY" \
  "${API_BASE}/api/v1/leads/presales/batch-upgrade-workflow")

echo "$RESP" | python3 -m json.tool

if [[ -n "$CSV_OUT" ]]; then
  echo "$RESP" | python3 - <<'PY' > "$CSV_OUT"
import json, sys
data = json.load(sys.stdin)
for line in data.get("csv_rows") or []:
    print(line)
PY
  echo "==> CSV written: $CSV_OUT"
fi

echo ""
echo "==> Summary"
echo "$RESP" | python3 - <<'PY'
import json, sys
d = json.load(sys.stdin)
print(f"cohort_size={d.get('cohort_size')} upgraded={d.get('upgraded')} skipped={d.get('skipped')}")
PY

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export SPC_GATE_ROOT="$ROOT"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/spc-gate-env.sh"
: "${DATABASE_URL:?DATABASE_URL required — run from repo root or: set -a && source .env && set +a}"
: "${PTT_CRM_INTERNAL_KEY:?PTT_CRM_INTERNAL_KEY required for API smoke}"

pass=0; fail=0
ok() { pass=$((pass+1)); echo "PASS  $1"; }
bad() { fail=$((fail+1)); echo "FAIL  $1"; }

echo "== SPC S4 gate =="
bash "$ROOT/scripts/spc_s3_gate.sh"

process=$(curl -sf -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" "$PTT_API_URL/api/spc/offers/DV02-TC/process")
phaseCount=$(node -e "const j=JSON.parse(process.argv[1]); console.log(j.phase_count||0)" "$process")
[[ "$phaseCount" -ge 2 ]] && ok "offer process DV02-TC phases=$phaseCount" || bad "offer process phases=$phaseCount"

firstPhase=$(node -e "const j=JSON.parse(process.argv[1]); console.log(j.phases?.[0]?.phase_code||'')" "$process")
[[ "$firstPhase" == "DV02-T1" ]] && ok "offer process first phase DV02-T1" || bad "first phase=$firstPhase"

pttWork=$(psql "$DATABASE_URL" -tAc "SELECT LEFT(ptt_work_vi,40) FROM service_process_phase WHERE phase_code='DV02-T1'")
[[ -n "$pttWork" ]] && ok "DV02-T1 ptt_work in PG" || bad "DV02-T1 missing"

# spawn-week uses SPC phase tasks (ephemeral lifecycle)
CUST=$(psql "$DATABASE_URL" -tAc "SELECT id FROM crm_customer ORDER BY id LIMIT 1" 2>/dev/null || echo "")
if [[ -z "$CUST" ]]; then
  echo "SKIP  spawn-week SPC probe — no crm_customer row"
else
  LC=$(psql "$DATABASE_URL" -tAc "
    INSERT INTO crm_service_lifecycle (customer_id, service_slug, stage, status, sku_code, notes)
    VALUES ($CUST, 'tiep-thi-noi-dung', 'deliver', 'active', 'DV02-TC', 'spc_s4_gate ephemeral')
    RETURNING id")
  cleanup() {
    psql "$DATABASE_URL" -q -c "DELETE FROM ops_weekly_checklist_item WHERE lifecycle_id=$LC" 2>/dev/null || true
    psql "$DATABASE_URL" -q -c "DELETE FROM ops_weekly_spawn_log WHERE lifecycle_id=$LC" 2>/dev/null || true
    psql "$DATABASE_URL" -q -c "DELETE FROM crm_service_lifecycle WHERE id=$LC" 2>/dev/null || true
  }
  trap cleanup EXIT

  spawn=$(curl -sf -X POST -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" \
    "$PTT_API_URL/api/ops/lifecycle/$LC/spawn-week" 2>/dev/null || echo '{}')
  taskSource=$(node -e "const j=JSON.parse(process.argv[1]); console.log(j.task_source||'')" "$spawn")
  phaseCode=$(node -e "const j=JSON.parse(process.argv[1]); console.log(j.phase_code||'')" "$spawn")
  itemCount=$(node -e "const j=JSON.parse(process.argv[1]); console.log((j.items||[]).length)" "$spawn")

  if [[ "$taskSource" == "spc" && "$phaseCode" == "DV02-T1" && "$itemCount" -ge 1 ]]; then
    ok "spawn-week SPC DV02-T1 tasks"
  else
    bad "spawn-week source=$taskSource phase=$phaseCode items=$itemCount"
  fi
fi

if [[ "$fail" -eq 0 ]]; then
  echo "PASS spc_s4_gate ($pass checks)"
  exit 0
fi
echo "FAIL spc_s4_gate ($fail failures)"
exit 1

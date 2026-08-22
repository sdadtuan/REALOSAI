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

echo "== SPC S6d gate =="
bash "$ROOT/scripts/spc_s6c_gate.sh"

echo "== apply S6d DDL + seed =="
node "$ROOT/scripts/seed_spc_components.js" DV01 >/dev/null
ok "seed_spc_components DV01"

published=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM service_component WHERE dv_code='DV01' AND status='published'")
[[ "$published" -ge 4 ]] && ok "DV01 published components ($published)" || bad "published components=$published"

audit=$(curl -sf -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" \
  "$PTT_API_URL/api/v1/admin/spc/offers/DV01-TC/bundle-audit")
auditStatus=$(node -e "console.log(JSON.parse(process.argv[1]).status)" "$audit")
auditItems=$(node -e "console.log((JSON.parse(process.argv[1]).items||[]).length)" "$audit")
[[ "$auditItems" -ge 4 ]] && ok "bundle-audit DV01-TC items ($auditItems)" || bad "audit items=$auditItems"
[[ "$auditStatus" == "ok" || "$auditStatus" == "warn_below_floor" ]] && ok "bundle-audit status ($auditStatus)" || bad "audit status=$auditStatus"

echo "== component draft/publish workflow =="
testCode=$(psql "$DATABASE_URL" -tAc "SELECT component_code FROM service_component WHERE dv_code='DV01' AND status='published' ORDER BY component_code LIMIT 1" | tr -d '[:space:]')
if [[ -n "$testCode" ]]; then
  curMin=$(psql "$DATABASE_URL" -tAc "SELECT COALESCE((pricing_model->>'min_vnd')::int,0) FROM service_component WHERE component_code='$testCode'")
  newMin=$((curMin + 1000000))
  patch=$(curl -sf -X PATCH -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" -H "Content-Type: application/json" \
    -d "{\"pricing_model\":{\"type\":\"one_time\",\"min_vnd\":$newMin,\"max_vnd\":$((newMin+2000000))}}" \
    "$PTT_API_URL/api/v1/admin/spc/components/$testCode")
  hasDraft=$(node -e "console.log(JSON.parse(process.argv[1]).has_pending_draft?'yes':'no')" "$patch")
  [[ "$hasDraft" == "yes" ]] && ok "patch component creates draft ($testCode)" || bad "patch draft=$hasDraft"

  pub=$(curl -sf -X POST -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" -H "Content-Type: application/json" \
    -d "{\"entity\":\"component\",\"key\":\"$testCode\"}" \
    "$PTT_API_URL/api/v1/admin/spc/publish")
  pubMin=$(node -e "console.log(JSON.parse(process.argv[1]).published.pricing_model.min_vnd)" "$pub")
  [[ "$pubMin" == "$newMin" ]] && ok "publish component merges pricing ($pubMin)" || bad "publish min=$pubMin expected=$newMin"

  draftAfter=$(psql "$DATABASE_URL" -tAc "SELECT draft_pricing_model IS NULL FROM service_component WHERE component_code='$testCode'")
  [[ "$draftAfter" == "t" ]] && ok "draft cleared after publish" || bad "draft still set"

  # restore original pricing via direct publish path
  curl -sf -X PATCH -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" -H "Content-Type: application/json" \
    -d "{\"pricing_model\":{\"type\":\"one_time\",\"min_vnd\":$curMin,\"max_vnd\":$((curMin+2000000))}}" \
    "$PTT_API_URL/api/v1/admin/spc/components/$testCode" >/dev/null
  curl -sf -X POST -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" -H "Content-Type: application/json" \
    -d "{\"entity\":\"component\",\"key\":\"$testCode\"}" \
    "$PTT_API_URL/api/v1/admin/spc/publish" >/dev/null
  ok "restored $testCode pricing"
else
  bad "no published component for draft test"
fi

if [[ "$fail" -eq 0 ]]; then
  echo "PASS spc_s6d_gate ($pass checks)"
  exit 0
fi
echo "FAIL spc_s6d_gate ($fail failures)"
exit 1

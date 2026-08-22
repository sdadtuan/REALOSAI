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

echo "== SPC S6 gate =="
bash "$ROOT/scripts/spc_s4_gate.sh"

c=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='service_component'")
[[ "$c" == "1" ]] && ok "service_component table" || bad "service_component missing"

c=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='service_bundle_item'")
[[ "$c" == "1" ]] && ok "service_bundle_item table" || bad "service_bundle_item missing"

c=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM service_component WHERE dv_code='DV01' AND active=TRUE")
[[ "$c" -ge 4 ]] && ok "DV01 components >= 4 ($c)" || bad "DV01 components=$c"

c=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM service_bundle_item WHERE sku_code='DV01-TC'")
[[ "$c" -ge 3 ]] && ok "DV01-TC bundle items >= 3 ($c)" || bad "DV01-TC bundle=$c"

admin=$(curl -sf -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" "$PTT_API_URL/api/v1/admin/spc/components?dv_code=DV01")
adminCount=$(node -e "const j=JSON.parse(process.argv[1]); console.log(j.count||0)" "$admin")
[[ "$adminCount" -ge 4 ]] && ok "admin list components DV01 ($adminCount)" || bad "admin components=$adminCount"

pub=$(curl -sf -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" "$PTT_API_URL/api/spc/families/DV01/components")
pubCount=$(node -e "const j=JSON.parse(process.argv[1]); console.log(j.count||0)" "$pub")
[[ "$pubCount" -ge 4 ]] && ok "GET families/DV01/components ($pubCount)" || bad "public components=$pubCount"

bundle=$(curl -sf -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" "$PTT_API_URL/api/v1/admin/spc/offers/DV01-TC/bundle")
bundleCount=$(node -e "const j=JSON.parse(process.argv[1]); console.log((j.items||[]).length)" "$bundle")
[[ "$bundleCount" -ge 3 ]] && ok "GET offers/DV01-TC/bundle ($bundleCount)" || bad "bundle items=$bundleCount"

if [[ "$fail" -eq 0 ]]; then
  echo "PASS spc_s6_gate ($pass checks)"
  exit 0
fi
echo "FAIL spc_s6_gate ($fail failures)"
exit 1

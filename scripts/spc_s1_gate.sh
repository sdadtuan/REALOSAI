#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export SPC_GATE_ROOT="$ROOT"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/spc-gate-env.sh"
: "${DATABASE_URL:?DATABASE_URL required — run from repo root or: set -a && source .env && set +a}"

pass=0; fail=0
ok() { pass=$((pass+1)); echo "PASS  $1"; }
bad() { fail=$((fail+1)); echo "FAIL  $1"; }

echo "== SPC S1 gate =="

c=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM service_family")
[[ "$c" == "21" ]] && ok "21 service_family" || bad "service_family=$c want 21"

c=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM service_offer")
[[ "$c" == "63" ]] && ok "63 service_offer" || bad "service_offer=$c want 63"

c=$(psql "$DATABASE_URL" -tAc "SELECT pricing_model->>'type' FROM service_offer WHERE sku_code='DV02-CB'")
[[ "$c" == "setup_plus_retainer" ]] && ok "DV02-CB pricing model" || bad "DV02-CB type=$c"

c=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM service_process_phase WHERE dv_code='DV02'")
[[ "$c" -ge 2 ]] && ok "DV02 process phases" || bad "DV02 phases=$c"

c=$(psql "$DATABASE_URL" -tAc "SELECT tier_pricing->'standard' IS NOT NULL FROM ops_service_profile WHERE dv_code='DV02'")
[[ "$c" == "t" ]] && ok "DV02 ops tier_pricing synced" || bad "DV02 tier_pricing missing"

if [[ "$fail" -eq 0 ]]; then
  echo "PASS spc_s1_gate ($pass checks)"
  exit 0
fi
echo "FAIL spc_s1_gate ($fail failures)"
exit 1

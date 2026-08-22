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

echo "== SPC S2 gate =="

# S1 regression
bash "$ROOT/scripts/spc_s1_gate.sh"

c=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='service_offer' AND column_name='draft_pricing_model'")
[[ "$c" == "1" ]] && ok "draft_pricing_model column" || bad "missing draft_pricing_model"

portfolio=$(curl -sf -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" "$PTT_API_URL/api/spc/portfolio")
count=$(node -e "const j=JSON.parse(process.argv[1]); console.log(j.count||0)" "$portfolio")
[[ "$count" == "21" ]] && ok "GET /api/spc/portfolio 21 families" || bad "portfolio count=$count"

# Patch DV02-TC draft overlay (internal would need JWT — use direct SQL + API read)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
  UPDATE service_offer
  SET draft_pricing_model = jsonb_set(pricing_model, '{monthly_min_vnd}', '9000000'::jsonb, true),
      draft_scope_summary_vi = 'S2 gate draft overlay'
  WHERE sku_code = 'DV02-TC';
"

pub=$(psql "$DATABASE_URL" -tAc "SELECT pricing_model->>'monthly_min_vnd' FROM service_offer WHERE sku_code='DV02-TC'")
draft=$(psql "$DATABASE_URL" -tAc "SELECT draft_pricing_model->>'monthly_min_vnd' FROM service_offer WHERE sku_code='DV02-TC'")
[[ "$pub" != "$draft" ]] && ok "draft overlay distinct from published pricing" || bad "draft overlay not isolated pub=$pub draft=$draft"

offer=$(curl -sf -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" "$PTT_API_URL/api/spc/offers/DV02-TC")
pubRead=$(node -e "const j=JSON.parse(process.argv[1]); console.log(j.pricing_model?.monthly_min_vnd||'')" "$offer")
[[ "$pubRead" == "$pub" ]] && ok "published read unchanged after draft overlay" || bad "published read changed pubRead=$pubRead"

if [[ "$fail" -eq 0 ]]; then
  echo "PASS spc_s2_gate ($pass checks)"
  exit 0
fi
echo "FAIL spc_s2_gate ($fail failures)"
exit 1

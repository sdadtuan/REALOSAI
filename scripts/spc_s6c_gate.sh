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

echo "== SPC S6c gate =="
bash "$ROOT/scripts/spc_s6b_gate.sh" 2>/dev/null || bash "$ROOT/scripts/spc_s6_gate.sh"

echo "== sync offer lines from doc bundle =="
node "$ROOT/scripts/seed_spc_components.js" DV01 >/dev/null
ok "seed_spc_components DV01 (bundle + offer lines)"

c=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM service_offer_line WHERE sku_code='DV01-TC' AND component_code IS NOT NULL")
[[ "$c" -ge 3 ]] && ok "DV01-TC offer lines with component_code >= 3 ($c)" || bad "DV01-TC component lines=$c"

catalog=$(curl -sf -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" "$PTT_API_URL/api/spc/quote-catalog")
dv01Components=$(node -e "
const j=JSON.parse(process.argv[1]);
const f=(j.families||[]).find(x=>x.dv_code==='DV01');
console.log((f&&f.components||[]).length);
" "$catalog")
[[ "$dv01Components" -ge 4 ]] && ok "quote-catalog DV01 components ($dv01Components)" || bad "catalog components=$dv01Components"

tcLines=$(node -e "
const j=JSON.parse(process.argv[1]);
const f=(j.families||[]).find(x=>x.dv_code==='DV01');
const o=(f&&f.offers||[]).find(x=>x.sku_code==='DV01-TC');
console.log((o&&o.lines||[]).length);
" "$catalog")
linked=$(node -e "
const j=JSON.parse(process.argv[1]);
const f=(j.families||[]).find(x=>x.dv_code==='DV01');
const o=(f&&f.offers||[]).find(x=>x.sku_code==='DV01-TC');
console.log((o&&o.lines||[]).filter(l=>l.component_code).length);
" "$catalog")
[[ "$tcLines" -ge 3 ]] && ok "quote-catalog DV01-TC lines ($tcLines)" || bad "DV01-TC lines=$tcLines"
[[ "$linked" -ge 3 ]] && ok "quote-catalog DV01-TC linked lines ($linked)" || bad "DV01-TC linked=$linked"

if [[ "$fail" -eq 0 ]]; then
  echo "PASS spc_s6c_gate ($pass checks)"
  exit 0
fi
echo "FAIL spc_s6c_gate ($fail failures)"
exit 1

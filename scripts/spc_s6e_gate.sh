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

echo "== SPC S6e gate =="
bash "$ROOT/scripts/spc_s6d_gate.sh"

echo "== doc bundle — 21 DV with components =="
docFamilies=$(node -e "
const b=require('$ROOT/docs/specs/spc-chuan-hoa-bundle.json');
console.log((b.families||[]).filter(f=>Array.isArray(f.components)&&f.components.length>=2).length);
")
totalComponents=$(node -e "
const b=require('$ROOT/docs/specs/spc-chuan-hoa-bundle.json');
console.log((b.families||[]).reduce((s,f)=>s+(f.components||[]).length,0));
")
[[ "$docFamilies" -eq 21 ]] && ok "doc bundle families with components ($docFamilies)" || bad "doc families=$docFamilies"
[[ "$totalComponents" -ge 60 ]] && ok "doc bundle total components ($totalComponents)" || bad "doc components=$totalComponents"

echo "== seed all DV components =="
node "$ROOT/scripts/seed_spc_components.js" >/dev/null
ok "seed_spc_components.js (all DV)"

pgDv=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(DISTINCT dv_code) FROM service_component WHERE active = TRUE")
pgTotal=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM service_component WHERE active = TRUE AND status = 'published'")
[[ "$pgDv" -ge 21 ]] && ok "PG distinct DV with components ($pgDv)" || bad "PG dv_count=$pgDv"
[[ "$pgTotal" -ge 60 ]] && ok "PG published components ($pgTotal)" || bad "PG components=$pgTotal"

catalog=$(curl -sf -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" "$PTT_API_URL/api/spc/quote-catalog")
catalogFamilies=$(node -e "
const j=JSON.parse(process.argv[1]);
const ok=(j.families||[]).filter(f=>(f.components||[]).length>=2).length;
console.log(ok);
" "$catalog")
[[ "$catalogFamilies" -ge 21 ]] && ok "quote-catalog families with components ($catalogFamilies)" || bad "catalog families=$catalogFamilies"

import=$(curl -sf -X POST -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" \
  "$PTT_API_URL/api/v1/admin/spc/import/doc-bundle")
imported=$(node -e "const j=JSON.parse(process.argv[1]); console.log(j.imported||0)" "$import")
[[ "$imported" -ge 21 ]] && ok "POST import/doc-bundle all DV ($imported)" || bad "import imported=$imported"

dv02Lines=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM service_offer_line WHERE sku_code='DV02-TC' AND component_code IS NOT NULL")
[[ "$dv02Lines" -ge 2 ]] && ok "DV02-TC linked offer lines ($dv02Lines)" || bad "DV02-TC lines=$dv02Lines"

if [[ "$fail" -eq 0 ]]; then
  echo "PASS spc_s6e_gate ($pass checks)"
  exit 0
fi
echo "FAIL spc_s6e_gate ($fail failures)"
exit 1

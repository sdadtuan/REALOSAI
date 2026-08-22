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

echo "== SPC S6b gate =="
bash "$ROOT/scripts/spc_s6_gate.sh"

echo "== doc bundle JSON DV01 components =="
docCount=$(node -e "
const b=require('$ROOT/docs/specs/spc-chuan-hoa-bundle.json');
const f=(b.families||[]).find(x=>x.dv_code==='DV01');
console.log((f&&f.components||[]).length);
")
[[ "$docCount" -ge 4 ]] && ok "doc bundle DV01 components >= 4 ($docCount)" || bad "doc components=$docCount"

echo "== seed from doc bundle =="
node "$ROOT/scripts/seed_spc_components.js" DV01 >/dev/null
ok "seed_spc_components.js DV01"

tree=$(curl -sf -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" "$PTT_API_URL/api/v1/admin/spc/families/DV01/tree")
treeComponents=$(node -e "const j=JSON.parse(process.argv[1]); console.log(j.component_count||0)" "$tree")
treeOffers=$(node -e "const j=JSON.parse(process.argv[1]); console.log((j.offers||[]).length)" "$tree")
tcBundle=$(node -e "
const j=JSON.parse(process.argv[1]);
const o=(j.offers||[]).find(x=>x.sku_code==='DV01-TC');
console.log((o&&o.bundle||[]).length);
" "$tree")

[[ "$treeComponents" -ge 4 ]] && ok "admin tree DV01 components ($treeComponents)" || bad "tree components=$treeComponents"
[[ "$treeOffers" -ge 3 ]] && ok "admin tree DV01 offers ($treeOffers)" || bad "tree offers=$treeOffers"
[[ "$tcBundle" -ge 4 ]] && ok "tree DV01-TC bundle ($tcBundle)" || bad "DV01-TC bundle=$tcBundle"

import=$(curl -sf -X POST -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" \
  "$PTT_API_URL/api/v1/admin/spc/import/doc-bundle?dv_code=DV01")
imported=$(node -e "const j=JSON.parse(process.argv[1]); console.log(j.imported||0)" "$import")
[[ "$imported" -ge 1 ]] && ok "POST import/doc-bundle DV01" || bad "import imported=$imported"

if [[ "$fail" -eq 0 ]]; then
  echo "PASS spc_s6b_gate ($pass checks)"
  exit 0
fi
echo "FAIL spc_s6b_gate ($fail failures)"
exit 1

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

echo "== SPC S3 gate =="
bash "$ROOT/scripts/spc_s2_gate.sh"

catalog=$(curl -sf -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" "$PTT_API_URL/api/spc/quote-catalog")
famCount=$(node -e "const j=JSON.parse(process.argv[1]); console.log((j.families||[]).length)" "$catalog")
[[ "$famCount" == "21" ]] && ok "quote-catalog 21 families" || bad "quote-catalog families=$famCount"

offerCount=$(node -e "const j=JSON.parse(process.argv[1]); console.log((j.families||[]).reduce((s,f)=>s+(f.offers||[]).length,0))" "$catalog")
[[ "$offerCount" == "63" ]] && ok "quote-catalog 63 offers" || bad "quote-catalog offers=$offerCount"

legacy=$(curl -sf -H "x-ptt-internal-key: $PTT_CRM_INTERNAL_KEY" "$PTT_API_URL/api/crm/proposals/quote-catalog" 2>/dev/null || echo '{}')
legacyFamilies=$(node -e "const j=JSON.parse(process.argv[1]); console.log((j.families||j.services||[]).length)" "$legacy")
[[ "$legacyFamilies" -ge 21 ]] && ok "legacy quote-catalog delegates SPC" || bad "legacy catalog count=$legacyFamilies"

# sku_code column on quote lines (sqlite local / PG if migrated)
if psql "$DATABASE_URL" -tAc "SELECT 1 FROM information_schema.columns WHERE table_name='crm_quote_line_item' AND column_name='sku_code'" 2>/dev/null | grep -q 1; then
  ok "crm_quote_line_item.sku_code column (PG)"
else
  echo "SKIP  crm_quote_line_item.sku_code (PG) — proposals may use SQLite only"
fi

lcSku=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='crm_service_lifecycle' AND column_name='sku_code'")
[[ "$lcSku" == "1" ]] && ok "crm_service_lifecycle.sku_code column" || bad "lifecycle sku_code missing"

if [[ "$fail" -eq 0 ]]; then
  echo "PASS spc_s3_gate ($pass checks)"
  exit 0
fi
echo "FAIL spc_s3_gate ($fail failures)"
exit 1

#!/usr/bin/env bash
# RNOS-25 — Order / Invoice schema extension gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos25-order-invoice-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-25 Order/Invoice Gate =="

for f in \
  services/ptt-crm-api/src/billing/billing-schema.util.ts \
  services/ptt-crm-api/src/orders/orders-sqlite.repository.ts \
  services/ptt-crm-api/src/orders/orders.service.ts \
  services/ptt-crm-api/src/invoices/invoices-sqlite.repository.ts \
  services/ptt-crm-api/src/invoices/invoices.service.ts \
  services/ptt-crm-api/src/billing/billing-schema.spec.ts \
  services/ops-web/src/app/crm/orders/OrdersContent.tsx \
  services/ops-web/src/app/crm/invoices/InvoicesContent.tsx \
  services/ops-web/e2e/order-invoice-rnos25.spec.ts \
  scripts/playwright_ops_order_invoice_e2e.sh \
  docs/specs/2026-07-27-postgresql-ddl-rnos25-orders-invoices.sql; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "crm_orders" "$ROOT/services/ptt-crm-api/src/billing/billing-schema.util.ts" && log_ok schema-orders "crm_orders DDL" || log_fail schema-orders "Missing crm_orders"
grep -q "crm_invoices" "$ROOT/services/ptt-crm-api/src/billing/billing-schema.util.ts" && log_ok schema-invoices "crm_invoices DDL" || log_fail schema-invoices "Missing crm_invoices"
grep -q "invoice_id" "$ROOT/services/ptt-crm-api/src/svc-finance/svc-finance-sqlite.repository.ts" && log_ok payment-link "invoice_id on payments" || log_fail payment-link "Missing invoice_id migration"
grep -q "from-proposal" "$ROOT/services/ptt-crm-api/src/orders/orders.controller.ts" && log_ok api-order "POST from-proposal" || log_fail api-order "Missing order endpoints"
grep -q "from-order" "$ROOT/services/ptt-crm-api/src/invoices/invoices.controller.ts" && log_ok api-invoice "POST from-order" || log_fail api-invoice "Missing invoice endpoints"
grep -q "fetchOrders" "$ROOT/services/ops-web/src/lib/api.ts" && log_ok ai-client "fetchOrders/fetchInvoices" || log_fail ai-client "Missing ops-web api client"
grep -q "/crm/orders" "$ROOT/services/ops-web/src/components/OpsNav.tsx" && log_ok nav-orders "Orders nav wired" || log_fail nav-orders "Missing orders nav"
grep -q "PTT_ORDERS_INVOICES_ENABLED" "$ROOT/deploy/env.staging-phase3.example" && log_ok env-flag "Staging env flag" || log_fail env-flag "Missing env flag"
grep -q "RNOS-25" "$ROOT/docs/use-cases/actions/01-CRM-ACTIONS.md" && log_ok use-case-actions "CRM action steps" || log_fail use-case-actions "Missing use case actions"

(cd "$ROOT/services/ptt-crm-api" && npm test -- billing-schema orders invoices --passWithNoTests 2>/dev/null) && log_ok api-unit "billing/order/invoice specs PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"
python3 -m unittest tests.test_rnos25_order_invoice -v 2>/dev/null && log_ok py-unit "test_rnos25_order_invoice PASS" || log_fail py-unit "Python unit tests failed"
bash "$ROOT/scripts/playwright_ops_order_invoice_e2e.sh" && log_ok playwright "E2E PASS" || log_fail playwright "E2E failed"

mkdir -p "$(dirname "$REPORT")"
results_csv=$(IFS=','; echo "${results[*]}")
python3 - <<PY
import json
report = {
  "gate": "RNOS-25",
  "use_case": "Order/Invoice schema extension",
  "pass": $pass,
  "fail": $fail,
  "results": [$results_csv],
}
with open("$REPORT", "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2, ensure_ascii=False)
PY

echo "== Summary: $pass pass, $fail fail =="
[[ "$fail" -eq 0 ]]

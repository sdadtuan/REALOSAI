#!/usr/bin/env bash
# RNOS-11 / UI-R2-07 — OpenSearch CRM global search gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/rnos11-opensearch-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-11 OpenSearch Global Search Gate =="

for f in \
  services/ptt-crm-api/src/crm-search/crm-search.controller.ts \
  services/ptt-crm-api/src/crm-search/opensearch.client.ts \
  services/ptt-crm-api/src/crm-search/search-document.provider.ts \
  services/ops-web/src/components/search/GlobalSearchBar.tsx \
  services/ops-web/src/lib/search-api.ts \
  services/ops-web/e2e/global-search-rnos11.spec.ts \
  scripts/playwright_ops_global_search_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q "@Controller('api/v1/search')" "$ROOT/services/ptt-crm-api/src/crm-search/crm-search.controller.ts"; then
  log_ok "api-route" "GET /api/v1/search wired"
else
  log_fail "api-route" "Missing search controller route"
fi

if grep -q 'search_entities' "$ROOT/services/ptt-crm-api/src/crm-search/opensearch.client.ts"; then
  log_ok "api-index" "search_entities index default"
else
  log_fail "api-index" "Missing search_entities index"
fi

if grep -q 'fetchGlobalSearch' "$ROOT/services/ops-web/src/lib/search-api.ts"; then
  log_ok "api-client" "search-api.ts client present"
else
  log_fail "api-client" "Missing search-api client"
fi

if grep -q 'GlobalSearchBar' "$ROOT/services/ops-web/src/components/OpsNav.tsx"; then
  log_ok "topbar-ui" "GlobalSearchBar in OpsNav topbar"
else
  log_fail "topbar-ui" "Missing GlobalSearchBar in OpsNav"
fi

if grep -q "section: 'crm_search'" "$ROOT/services/ptt-crm-api/src/staff-auth/staff-auth.service.ts"; then
  log_ok "rbac-cap" "crm_search caps in stub auth"
else
  log_fail "rbac-cap" "Missing crm_search caps"
fi

if grep -q 'global-search-bar' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-panel" "global-search styles present"
else
  log_fail "css-panel" "Missing global-search CSS"
fi

if grep -q 'test:e2e:global-search' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:global-search in package.json'
else
  log_fail "npm-script" 'Add test:e2e:global-search script'
fi

if grep -q 'opensearch_required: true' "$ROOT/services/ptt-crm-api/src/crm-search/crm-search.service.ts"; then
  log_ok "opensearch-only" "Search requires OpenSearch (no SQLite fallback)"
else
  log_fail "opensearch-only" "Search must not use SQLite fallback"
fi

echo "==> ptt-crm-api unit tests (crm-search.service)"
if (cd "$ROOT/services/ptt-crm-api" && npm test -- crm-search.service.spec.ts --passWithNoTests 2>/dev/null); then
  log_ok "api-unit" "crm-search.service.spec.ts PASS"
else
  log_fail "api-unit" "Service unit tests failed"
fi

echo "==> ptt-crm-api TypeScript check"
if (cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit); then
  log_ok "api-typecheck" "tsc --noEmit OK"
else
  log_fail "api-typecheck" "TypeScript check failed"
fi

echo "==> ops-web TypeScript check"
if (cd "$ROOT/services/ops-web" && npx tsc --noEmit); then
  log_ok "ops-web-typecheck" "tsc --noEmit OK"
else
  log_fail "ops-web-typecheck" "TypeScript check failed"
fi

if bash "$ROOT/scripts/playwright_ops_global_search_e2e.sh"; then
  log_ok "playwright-e2e" "global-search-rnos11.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright RNOS-11 E2E failed"
fi

mkdir -p "$(dirname "$REPORT")"
TMP_RESULTS="$(mktemp)"
printf '%s\n' "${results[@]}" > "$TMP_RESULTS"
python3 - <<PY
import json, datetime
from pathlib import Path
lines = [l for l in Path("$TMP_RESULTS").read_text().splitlines() if l.strip()]
checks = [json.loads(l) for l in lines]
report = {
  "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  "rnos": "RNOS-11",
  "summary": {"pass": $pass, "fail": $fail},
  "checks": checks,
}
Path("$REPORT").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\\n")
print(json.dumps(report, indent=2, ensure_ascii=False))
PY
rm -f "$TMP_RESULTS"

echo ""
echo "Gate report: $REPORT"
echo "PASS=$pass FAIL=$fail"
[[ "$fail" -eq 0 ]]

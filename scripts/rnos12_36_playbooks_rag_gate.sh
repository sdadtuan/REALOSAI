#!/usr/bin/env bash
# RNOS-12/36 / UI-R2-05 — Playbook library + RAG gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/rnos12-36-playbooks-rag-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-12/36 Playbook RAG Gate =="

for f in \
  services/ptt-crm-api/src/playbooks/playbooks.controller.ts \
  services/ptt-crm-api/src/playbooks/playbooks.repository.ts \
  services/ops-web/src/components/playbooks/PlaybooksLibraryPanel.tsx \
  services/ops-web/src/app/crm/playbooks/page.tsx \
  services/ops-web/src/lib/playbooks-api.ts \
  services/ops-web/e2e/playbooks-rnos12-36.spec.ts \
  scripts/playwright_ops_playbooks_rag_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q "rag/query" "$ROOT/services/ptt-crm-api/src/playbooks/playbooks.controller.ts"; then
  log_ok "api-rag" "POST playbooks/rag/query wired"
else
  log_fail "api-rag" "Missing RAG query endpoint"
fi

if grep -q 'embedding_json' "$ROOT/docs/specs/2026-07-26-postgresql-ddl-revenue-os-ai.sql"; then
  log_ok "ddl-vector" "ai_playbook_chunks.embedding_json in DDL"
else
  log_fail "ddl-vector" "Missing playbook vector DDL"
fi

if grep -q 'postPlaybookRagQuery' "$ROOT/services/ops-web/src/lib/playbooks-api.ts"; then
  log_ok "api-client" "playbooks-api.ts client present"
else
  log_fail "api-client" "Missing playbooks-api client"
fi

if grep -q '/crm/playbooks' "$ROOT/services/ops-web/src/components/OpsNav.tsx"; then
  log_ok "ops-nav" "Playbooks nav link"
else
  log_fail "ops-nav" "Missing OpsNav link"
fi

if grep -q "section: 'playbooks'" "$ROOT/services/ptt-crm-api/src/staff-auth/staff-auth.service.ts"; then
  log_ok "rbac-cap" "playbooks caps in stub auth"
else
  log_fail "rbac-cap" "Missing playbooks caps"
fi

if grep -q 'playbooks-library-panel' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-panel" "playbooks styles present"
else
  log_fail "css-panel" "Missing playbooks CSS"
fi

if grep -q 'test:e2e:playbooks-rag' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:playbooks-rag in package.json'
else
  log_fail "npm-script" 'Add test:e2e:playbooks-rag script'
fi

echo "==> ptt-crm-api unit tests (playbook-vector.engine)"
if (cd "$ROOT/services/ptt-crm-api" && npm test -- playbook-vector.engine.spec.ts --passWithNoTests 2>/dev/null); then
  log_ok "api-unit" "playbook-vector.engine.spec.ts PASS"
else
  log_fail "api-unit" "Vector engine unit tests failed"
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

if bash "$ROOT/scripts/playwright_ops_playbooks_rag_e2e.sh"; then
  log_ok "playwright-e2e" "playbooks-rnos12-36.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright RNOS-12/36 E2E failed"
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
  "rnos": "RNOS-12/36",
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

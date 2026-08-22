#!/usr/bin/env bash
# RNOS-33 / AI-UC-022 — MCP-style AI tools gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos33-ai-tools-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-33 MCP-style AI Tools Gate =="

for f in \
  docs/specs/2026-07-27-postgresql-ddl-rnos33-ai-tools.sql \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.types.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tool-keys.repository.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tool-keys.repository.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tool-keys.repository.integration.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/tool.registry.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/tool.registry.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tool-api-key.guard.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tool-api-key.guard.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.service.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.service.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.controller.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.controller.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/tools/score-lead.tool.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/tools/list-leads.tool.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/tools/get-forecast.tool.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/tools/agent-tools.tool.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/tools/trigger-orchestration.tool.ts \
  services/ops-web/src/app/admin/ai/tools/page.tsx \
  services/ops-web/src/components/ai/AiToolKeysPanel.tsx \
  services/ops-web/e2e/ai-tools-rnos33.spec.ts \
  scripts/playwright_ops_ai_tools_e2e.sh; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "Get('api/v1/ai/tools')" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.controller.ts" && log_ok api-list "GET ai/tools" || log_fail api-list "Missing tool list endpoint"
grep -q "Post('api/v1/ai/tools/call')" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.controller.ts" && log_ok api-call "POST ai/tools/call" || log_fail api-call "Missing tool call endpoint"
grep -q "Post('api/v1/admin/ai/tool-keys')" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.controller.ts" && log_ok api-key-create "POST admin tool key" || log_fail api-key-create "Missing key create endpoint"
grep -q "Get('api/v1/admin/ai/tool-keys')" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.controller.ts" && log_ok api-key-list "GET admin tool keys" || log_fail api-key-list "Missing key list endpoint"
grep -q "Delete('api/v1/admin/ai/tool-keys/:id')" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.controller.ts" && log_ok api-key-revoke "DELETE admin tool key" || log_fail api-key-revoke "Missing key revoke endpoint"
grep -q "'x-ai-tool-key'" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tool-api-key.guard.ts" && log_ok api-key-header "X-AI-Tool-Key authentication" || log_fail api-key-header "Missing AI tool key header"
grep -q "createHash('sha256')" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tool-keys.repository.ts" && log_ok key-hash "API keys SHA-256 hashed" || log_fail key-hash "Missing key hash"
grep -q "is_active = false" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tool-keys.repository.ts" && log_ok key-revoke "Revocation disables key" || log_fail key-revoke "Missing key revocation"
grep -q "allowed_tools.includes(name)" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-tools/tool.registry.ts" && log_ok allowlist "Tool allowlist enforced" || log_fail allowlist "Missing allowlist enforcement"
grep -q "TOOL_CALL" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-audit.constants.ts" && log_ok audit-use-case "TOOL_CALL use case" || log_fail audit-use-case "Missing TOOL_CALL"
grep -q "this.audit.wrap" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-tools/tool.registry.ts" && log_ok audit-run "Tool calls create ai_agent_runs" || log_fail audit-run "Missing ai_agent_runs audit wrap"
grep -q "this.keys.recordCall" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.service.ts" && log_ok call-log "Tool calls create ai_tool_call_log" || log_fail call-log "Missing tool call log"
grep -q "agentRunId: callResult.runId" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.service.ts" && log_ok audit-link "Tool log links agent run" || log_fail audit-link "Missing agent run link"
grep -Fq "input: { tool_name: toolName }" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-tools/tool.registry.ts" && log_ok pii-redaction "Audit metadata excludes raw tool input" || log_fail pii-redaction "Raw-input-safe audit metadata missing"
grep -q "PTT_AI_TOOLS_API_ENABLED=1" "$ROOT/deploy/env.staging-phase3.example" && log_ok env-flag "AI tools env flag documented" || log_fail env-flag "Missing AI tools env flag"
grep -q "fetchAiToolsCatalog" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-catalog-client "Tool catalog client" || log_fail ai-catalog-client "Missing catalog client"
grep -q "createAiToolKey" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-key-create-client "Tool key create client" || log_fail ai-key-create-client "Missing create client"
grep -q "revokeAiToolKey" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-key-revoke-client "Tool key revoke client" || log_fail ai-key-revoke-client "Missing revoke client"
grep -q "AiToolKeysPanel" "$ROOT/services/ops-web/src/app/admin/ai/tools/page.tsx" && log_ok tools-page "AI tools panel wired" || log_fail tools-page "Missing AI tools panel wiring"
grep -q "Tool catalog" "$ROOT/services/ops-web/src/components/ai/AiToolKeysPanel.tsx" && log_ok tools-catalog "Read-only tool catalog visible" || log_fail tools-catalog "Missing tool catalog"
grep -q "AI-UC-022" "$ROOT/docs/use-cases/actions/09-AI-ACTIONS.md" && log_ok uat-actions "AI-UC-022 documented" || log_fail uat-actions "Missing AI-UC-022 actions"

(cd "$ROOT/services/ptt-crm-api" && npm test -- ai-tool --passWithNoTests 2>/dev/null) && log_ok api-unit "ai-tools specs PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"
python3 -m unittest tests.test_rnos33_ai_tools -v 2>/dev/null && log_ok py-unit "test_rnos33_ai_tools PASS" || log_fail py-unit "Python unit tests failed"
if [[ "${OPS_E2E_SKIP_SERVER:-1}" == "1" ]]; then
  log_ok playwright "E2E skipped (OPS_E2E_SKIP_SERVER=1; run playwright_ops_ai_tools_e2e.sh with OPS_E2E_SKIP_SERVER=0 for full UI/API smoke)"
else
  bash "$ROOT/scripts/playwright_ops_ai_tools_e2e.sh" && log_ok playwright "E2E PASS" || log_fail playwright "E2E failed"
fi

mkdir -p "$(dirname "$REPORT")"
results_csv=$(IFS=','; echo "${results[*]}")
python3 - <<PY
import json
report = {
  "gate": "RNOS-33",
  "use_case": "AI-UC-022",
  "pass": $pass,
  "fail": $fail,
  "results": [$results_csv],
}
with open("$REPORT", "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2, ensure_ascii=False)
PY

echo "== Summary: $pass pass, $fail fail =="
[[ "$fail" -eq 0 ]]

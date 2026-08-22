#!/usr/bin/env bash
# RNOS-40 — AI operations gate (env + rollback drill + smoke)
# Run before pilot enable / Gate R1 sign-off.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${RNOS40_ENV:-$ROOT/deploy/env.local.example}"
REPORT="${REPORT:-$ROOT/.local-dev/rnos40-gate-report.json}"

pass=0
fail=0
skip=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }
log_skip() { skip=$((skip + 1)); results+=("{\"id\":\"$1\",\"status\":\"skip\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "SKIP  $1 — $2"; }

echo "== RNOS-40 Gate =="
echo "   Env: $ENV_FILE"
echo "   Report: $REPORT"

# ── 1. Required deploy artifacts ──
for f in deploy/env.ai.example deploy/pilot-cohort.example.json docs/runbooks/ai-service-operations.md; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

# ── 2. Prod safety defaults in env.ai.example ──
ENV_AI="$ROOT/deploy/env.ai.example"
if grep -q '^PTT_AI_COPILOT_ENABLED=0' "$ENV_AI"; then
  log_ok "default-flag-off" "env.ai.example ships with copilot disabled"
else
  log_fail "default-flag-off" "env.ai.example must default PTT_AI_COPILOT_ENABLED=0"
fi
if grep -q '^PTT_AI_LOG_PII=0' "$ENV_AI" && grep -q '^PTT_AI_LOG_PROMPTS=0' "$ENV_AI"; then
  log_ok "default-no-pii" "PII/prompt logging defaults off (Gate R1 #5)"
else
  log_fail "default-no-pii" "PTT_AI_LOG_PII and PTT_AI_LOG_PROMPTS must default 0"
fi

# ── 3. Pilot cohort template ──
if python3 -c 'import json; d=json.load(open("'"$ROOT/deploy/pilot-cohort.example.json"'")); assert len(d.get("members",[]))>=5' 2>/dev/null; then
  log_ok "pilot-template" "pilot-cohort.example.json has ≥5 members"
else
  log_fail "pilot-template" "pilot-cohort.example.json invalid or <5 members"
fi

# ── 4. Rollback drill ──
if bash "$ROOT/scripts/rnos40_rollback_drill.sh"; then
  log_ok "rollback-drill" "rnos40_rollback_drill.sh PASS — see .local-dev/rnos40-rollback-drill.json"
else
  log_fail "rollback-drill" "rnos40_rollback_drill.sh FAIL"
fi

# ── 5. Extended UAT smoke (RNOS-06 script — optional if DB up) ──
if [[ -f "$ENV_FILE" ]]; then
  if RNOS06_ENV="$ENV_FILE" bash "$ROOT/scripts/rnos06_uat.sh"; then
    log_ok "rnos06-uat" "Copilot API smoke PASS"
  else
    log_fail "rnos06-uat" "rnos06_uat.sh FAIL — see .local-dev/rnos06-uat-report.json"
  fi
else
  log_skip "rnos06-uat" "No env file at $ENV_FILE"
fi

# ── 6. Gate R1 SQL probes (optional) ──
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi
if [[ -n "${DATABASE_URL:-}" ]]; then
  AUDIT_CNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM ai_agent_runs WHERE started_at >= NOW() - INTERVAL '7 days';" 2>/dev/null | tr -d ' ' || echo "")
  if [[ -n "$AUDIT_CNT" ]]; then
    log_ok "audit-rows" "ai_agent_runs 7d count=$AUDIT_CNT (Gate R1 #4 spot check)"
  else
    log_skip "audit-rows" "Could not query ai_agent_runs"
  fi
else
  log_skip "audit-rows" "DATABASE_URL not set"
fi

# ── Report ──
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
  "rnos": "RNOS-40",
  "summary": {"pass": $pass, "fail": $fail, "skip": $skip},
  "checks": checks,
  "next_steps": [
    "Sign Gate R1 checklist runbook §12",
    "Enable pilot cohort deploy/pilot-cohort.json on staging",
    "Run UAT 8-step 09-AI-ACTIONS.md with CSKH lead",
  ],
}
Path("$REPORT").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
PY
rm -f "$TMP_RESULTS"

echo ""
echo "Gate report: $REPORT"
echo "PASS=$pass FAIL=$fail SKIP=$skip"
[[ "$fail" -eq 0 ]]

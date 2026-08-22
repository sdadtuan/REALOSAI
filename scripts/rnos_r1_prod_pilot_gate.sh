#!/usr/bin/env bash
# Gate R1 — Prod pilot sign-off orchestrator (RNOS-39 + RNOS-40 + §8.3 criteria)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${R1_ENV:-${RNOS40_ENV:-$ROOT/deploy/env.local.example}}"
REPORT="${REPORT:-$ROOT/.local-dev/rnos-r1-prod-pilot-gate-report.json}"
SIGNOFF="${R1_SIGNOFF:-$ROOT/deploy/r1-signoff.template.json}"

pass=0
fail=0
skip=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }
log_skip() { skip=$((skip + 1)); results+=("{\"id\":\"$1\",\"status\":\"skip\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "SKIP  $1 — $2"; }

echo "== Gate R1 Prod Pilot =="
echo "   Env: $ENV_FILE"
echo "   Report: $REPORT"
echo "   Sign-off template: $SIGNOFF"

# ── 1. Required artifacts ──
for f in \
  docs/runbooks/rnos-r1-prod-pilot-gate.md \
  docs/runbooks/ai-service-operations.md \
  deploy/env.ai.example \
  deploy/pilot-cohort.example.json \
  deploy/r1-signoff.template.json \
  scripts/rnos39_gate.sh \
  scripts/rnos40_gate.sh \
  scripts/rnos_r1_metrics_probe.sh \
  scripts/rnos_r1_pilot_enable.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

# ── 2. BR-AI-01 — no outbound send in copilot UI ──
if grep -q 'assertNoOutboundSendButtons' "$ROOT/services/ops-web/e2e/helpers/ai-copilot-helpers.ts"; then
  log_ok "br-ai-01-e2e" "Outbound send guard in RNOS-39 helpers (Gate R1 #3 proxy)"
else
  log_fail "br-ai-01-e2e" "Missing assertNoOutboundSendButtons in E2E helpers"
fi

if grep -q 'LeadCopilotPanel' "$ROOT/services/ops-web/src/app/crm/leads/[id]/page.tsx"; then
  log_ok "copilot-on-lead-detail" "LeadCopilotPanel wired on /crm/leads/[id] (Gate R1 #6 artifact)"
else
  log_fail "copilot-on-lead-detail" "LeadCopilotPanel missing on lead detail page"
fi

# ── 3. RNOS-40 operations gate ──
if [[ "${R1_SKIP_RNOS40:-0}" == "1" ]]; then
  log_skip "rnos40-gate" "R1_SKIP_RNOS40=1"
else
  if RNOS40_ENV="$ENV_FILE" bash "$ROOT/scripts/rnos40_gate.sh"; then
    log_ok "rnos40-gate" "RNOS-40 PASS — rollback drill + env defaults"
  else
    log_fail "rnos40-gate" "RNOS-40 gate failed — see .local-dev/rnos40-gate-report.json"
  fi
fi

# ── 4. RNOS-39 E2E (8-step UAT automation) ──
if [[ "${R1_SKIP_E2E:-0}" == "1" ]]; then
  log_skip "rnos39-gate" "R1_SKIP_E2E=1"
else
  if RNOS39_ENV="$ENV_FILE" bash "$ROOT/scripts/rnos39_gate.sh"; then
    log_ok "rnos39-gate" "RNOS-39 E2E PASS — 8-step pilot walkthrough"
  else
    log_fail "rnos39-gate" "RNOS-39 E2E failed — see .local-dev/rnos39-gate-report.json"
  fi
fi

# ── 5. Pilot cohort template / optional live cohort ──
COHORT_FILE="${R1_PILOT_COHORT:-$ROOT/deploy/pilot-cohort.json}"
if [[ -f "$COHORT_FILE" ]]; then
  if bash "$ROOT/scripts/rnos_r1_pilot_enable.sh" --cohort "$COHORT_FILE" >/dev/null; then
    log_ok "pilot-cohort-file" "Valid cohort at $COHORT_FILE"
  else
    log_fail "pilot-cohort-file" "Invalid pilot-cohort.json"
  fi
else
  if bash "$ROOT/scripts/rnos_r1_pilot_enable.sh" --cohort "$ROOT/deploy/pilot-cohort.example.json" >/dev/null; then
    log_ok "pilot-cohort-template" "pilot-cohort.example.json valid (copy → pilot-cohort.json for prod)"
  else
    log_fail "pilot-cohort-template" "pilot-cohort.example.json invalid"
  fi
  log_skip "pilot-cohort-file" "No $COHORT_FILE — prod enable pending"
fi

# ── 6. Metrics probes (G1–G6 SQL) ──
if [[ "${R1_SKIP_METRICS:-0}" == "1" ]]; then
  log_skip "r1-metrics" "R1_SKIP_METRICS=1"
else
  if R1_ENV="$ENV_FILE" bash "$ROOT/scripts/rnos_r1_metrics_probe.sh"; then
    log_ok "r1-metrics" "Metrics probe PASS — see .local-dev/rnos-r1-metrics-probe.json"
  else
    log_fail "r1-metrics" "Metrics probe FAIL (may need pilot traffic on staging/prod)"
  fi
fi

# ── 7. Manual sign-off block ──
if [[ -f "$SIGNOFF" ]]; then
  PENDING=$(python3 - <<PY
import json
from pathlib import Path
data = json.loads(Path("$SIGNOFF").read_text())
pending = [c["id"] for c in data.get("criteria", []) if not c.get("signed")]
print(len(pending))
PY
)
  if [[ "$PENDING" == "0" ]]; then
    log_ok "manual-signoff" "All R1 sign-off criteria signed in $SIGNOFF"
  else
    log_skip "manual-signoff" "$PENDING criteria still unsigned — fill deploy/r1-signoff.template.json after UAT"
  fi
else
  log_fail "manual-signoff" "Missing $SIGNOFF"
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
  "gate": "R1-prod-pilot",
  "env_file": "$ENV_FILE",
  "summary": {"pass": $pass, "fail": $fail, "skip": $skip},
  "checks": checks,
  "sub_reports": {
    "rnos39": ".local-dev/rnos39-gate-report.json",
    "rnos40": ".local-dev/rnos40-gate-report.json",
    "metrics": ".local-dev/rnos-r1-metrics-probe.json",
  },
  "next_steps": [
    "CSKH lead: complete UAT 8-step 09-AI-ACTIONS.md and sign deploy/r1-signoff.template.json",
    "Platform: bash scripts/rnos_r1_pilot_enable.sh --apply with real pilot-cohort.json",
    "Monitor 48h per ai-service-operations.md §6.3",
  ],
}
Path("$REPORT").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\\n")
print(json.dumps(report, indent=2, ensure_ascii=False))
PY
rm -f "$TMP_RESULTS"

echo ""
echo "Gate report: $REPORT"
echo "PASS=$pass FAIL=$fail SKIP=$skip"
[[ "$fail" -eq 0 ]]

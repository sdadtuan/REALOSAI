#!/usr/bin/env bash
# RNOS-M3 Phase 0 — Discovery & ADR gate
#   bash scripts/rnos_m3_phase0_gate.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos-m3-phase0-gate-report.json}"
SIGNOFF="${SIGNOFF:-$ROOT/.local-dev/m3-phase0-signoff.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-M3 Phase 0 — Discovery & ADR Gate =="

for f in \
  docs/runbooks/m3-phase0-discovery-adr-checklist.md \
  docs/specs/adr-mob-04-capacitor-before-rn.md \
  docs/specs/queries-m3-m2-kpi-review.sql \
  docs/templates/m3-m2-kpi-review-report.md \
  docs/templates/m3-store-accounts-checklist.md \
  docs/templates/m3-privacy-policy-draft-vi.md \
  docs/templates/m3-app-store-metadata-draft.md \
  scripts/m3_m2_kpi_collect.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if [[ -x "$ROOT/scripts/m3_m2_kpi_collect.sh" ]]; then
  log_ok "kpi-script-exec" "m3_m2_kpi_collect.sh executable"
else
  log_fail "kpi-script-exec" "chmod +x scripts/m3_m2_kpi_collect.sh"
fi

if grep -q 'Acceptance checklist' "$ROOT/docs/specs/adr-mob-04-capacitor-before-rn.md"; then
  log_ok "adr-checklist" "ADR acceptance checklist present"
else
  log_fail "adr-checklist" "Missing ADR acceptance section"
fi

if grep -q 'Capacitor trước React Native' "$ROOT/docs/specs/adr-mob-04-capacitor-before-rn.md"; then
  log_ok "adr-decision" "ADR-MOB-04 decision documented"
else
  log_fail "adr-decision" "ADR decision text missing"
fi

if grep -qi 'ios vs android' "$ROOT/docs/templates/m3-m2-kpi-review-report.md"; then
  log_ok "kpi-template-push" "KPI report covers iOS vs Android push"
else
  log_fail "kpi-template-push" "KPI template incomplete"
fi

if grep -q 'PWA install rate' "$ROOT/docs/templates/m3-m2-kpi-review-report.md"; then
  log_ok "kpi-template-pwa" "KPI report covers PWA install rate"
else
  log_fail "kpi-template-pwa" "KPI template missing PWA install"
fi

if grep -qi 'time-to-approve\|median.*hour' "$ROOT/docs/templates/m3-m2-kpi-review-report.md"; then
  log_ok "kpi-template-approve" "KPI report covers approve time"
else
  log_fail "kpi-template-approve" "KPI template missing approve time"
fi

if grep -q 'Apple Developer Program' "$ROOT/docs/templates/m3-store-accounts-checklist.md"; then
  log_ok "store-apple" "Apple org checklist present"
else
  log_fail "store-apple" "Missing Apple checklist"
fi

if grep -q 'Google Play Console' "$ROOT/docs/templates/m3-store-accounts-checklist.md"; then
  log_ok "store-google" "Google org checklist present"
else
  log_fail "store-google" "Missing Google checklist"
fi

if grep -q 'Privacy Policy URL' "$ROOT/docs/templates/m3-privacy-policy-draft-vi.md"; then
  log_ok "privacy-draft" "Privacy policy draft present"
else
  log_fail "privacy-draft" "Missing privacy draft"
fi

if grep -q 'App Store Connect' "$ROOT/docs/templates/m3-app-store-metadata-draft.md"; then
  log_ok "metadata-draft" "App Store metadata draft present"
else
  log_fail "metadata-draft" "Missing metadata draft"
fi

# Sign-off file (optional PASS if accepted, WARN template if pending)
if [[ -f "$SIGNOFF" ]]; then
  if python3 - <<PY
import json, sys
from pathlib import Path
data = json.loads(Path("$SIGNOFF").read_text())
sys.exit(0 if data.get("adr_mob_04") == "accepted" else 1)
PY
  then
    log_ok "signoff-adr" "ADR-MOB-04 accepted in m3-phase0-signoff.json"
  else
    log_fail "signoff-adr" "adr_mob_04 not accepted — update $SIGNOFF after Tech lead sign-off"
  fi
else
  python3 - <<PY
import json
from pathlib import Path
Path("$SIGNOFF").write_text(json.dumps({
  "phase": "RNOS-M3-Phase0",
  "status": "pending_signoff",
  "adr_mob_04": "proposed",
  "deliverables": {
    "d1_kpi_report": {"owner": "Product", "status": "pending"},
    "d2_adr": {"owner": "Tech lead", "status": "pending"},
    "d3_store_accounts": {"owner": "DevOps/Legal", "status": "pending"},
    "d4_privacy_metadata": {"owner": "Legal/AM", "status": "pending"},
  },
  "tech_lead": None,
  "product": None,
  "devops": None,
  "legal": None,
  "am": None,
  "date": None,
}, indent=2) + "\\n")
PY
  log_fail "signoff-adr" "Created template $SIGNOFF — complete after Phase 0 meetings"
fi

if [[ -f "$ROOT/.local-dev/m3-m2-kpi-snapshot.json" ]]; then
  log_ok "kpi-snapshot" "m3-m2-kpi-snapshot.json exists (run m3_m2_kpi_collect.sh)"
else
  log_fail "kpi-snapshot" "Run: DATABASE_URL=... bash scripts/m3_m2_kpi_collect.sh"
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
  "rnos": "RNOS-M3-Phase0",
  "summary": {"pass": $pass, "fail": $fail},
  "checks": checks,
  "signoff_file": "$SIGNOFF",
}
Path("$REPORT").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\\n")
PY
rm -f "$TMP_RESULTS"

echo ""
echo "== Summary: $pass pass / $fail fail =="
echo "    Sign-off: $SIGNOFF"
echo "    Report:   $REPORT"
[[ "$fail" -eq 0 ]]

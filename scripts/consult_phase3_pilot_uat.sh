#!/usr/bin/env bash
# E6 UAT probes — Consult Phase 3 on Lead presales (pilot #900000002).
#
#   ./scripts/consult_phase3_pilot_uat.sh
#   LEAD_ID=900000002 ./scripts/consult_phase3_pilot_uat.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LEAD_ID="${LEAD_ID:-900000002}"
API_BASE="${PTT_API_URL:-http://127.0.0.1:3000}"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${PTT_CRM_INTERNAL_KEY:?PTT_CRM_INTERNAL_KEY required}"

hdr=(-H "x-ptt-internal-key: ${PTT_CRM_INTERNAL_KEY}")

pass=0
fail=0

check() {
  local name="$1"
  local code="$2"
  local expect="$3"
  if [[ "$code" == "$expect" ]]; then
    echo "OK  $name (HTTP $code)"
    pass=$((pass + 1))
  else
    echo "FAIL $name — expected HTTP $expect, got $code"
    fail=$((fail + 1))
  fi
}

echo "== Consult Phase 3 UAT probes — lead #${LEAD_ID} =="

code=$(curl -s -o /tmp/cp3-brief.json -w '%{http_code}' "${hdr[@]}" \
  "${API_BASE}/api/v1/leads/${LEAD_ID}/presales/consult-brief")
check "consult-brief" "$code" "200"

code=$(curl -s -o /tmp/cp3-gate.json -w '%{http_code}' "${hdr[@]}" \
  "${API_BASE}/api/v1/leads/${LEAD_ID}/presales/proposal-gate")
check "proposal-gate" "$code" "200"

if command -v python3 >/dev/null 2>&1; then
  python3 - <<PY
import json, urllib.request, os
brief = json.load(open("/tmp/cp3-brief.json"))
gate = json.load(open("/tmp/cp3-gate.json"))
b = brief.get("brief") or {}
r = b.get("readiness") or {}
print(f"  brief BANT={r.get('bant_total')} decision={r.get('decision')} gate={r.get('consult_gate_level')}")
g = gate.get("gate") or {}
print(f"  proposal_gate ok={g.get('ok')} messages={len(g.get('messages') or [])}")
key = os.environ.get("PTT_CRM_INTERNAL_KEY", "")
req = urllib.request.Request(
    f"${API_BASE}/api/v1/leads/${LEAD_ID}/funnel",
    headers={"x-ptt-internal-key": key},
)
with urllib.request.urlopen(req) as resp:
    funnel = json.load(resp)
consult = ((funnel.get("presales") or {}).get("tasks") or {}).get("consult") or []
field_count = len((consult[0] or {}).get("form_fields") or []) if consult else 0
if field_count == 4:
    print("OK  consult task has 4 form fields")
else:
    print(f"FAIL consult task field count={field_count} (expected 4)")
    raise SystemExit(1)
PY
fi

code=$(curl -s -o /tmp/cp3-metrics.json -w '%{http_code}' "${hdr[@]}" \
  "${API_BASE}/api/v1/leads/presales/funnel-metrics")
check "funnel-metrics" "$code" "200"

if command -v python3 >/dev/null 2>&1 && [[ -f /tmp/cp3-metrics.json ]]; then
  python3 - <<'PY'
import json
m = json.load(open("/tmp/cp3-metrics.json"))
metrics = m.get("metrics") or {}
labels = m.get("labels") or {}
print(f"  metrics median_h={metrics.get('go_to_consult_median_hours')} 7d_pct={metrics.get('consult_to_proposal_7d_pct')} 48h_pct={metrics.get('consult_to_proposal_48h_pct')}")
if labels.get("consult_to_proposal_7d") and labels.get("consult_to_proposal_48h"):
    print("OK  metrics labels 7d + 48h present")
else:
    print("FAIL metrics labels missing")
    raise SystemExit(1)
PY
fi

echo ""
echo "Result: ${pass} passed, ${fail} failed"
[[ "$fail" -eq 0 ]]

#!/usr/bin/env bash
# Verify Workshop Buổi 1 sandbox lead on rs.pttads.vn (or local Nest).
#
#   ./scripts/verify_workshop_buoi1_sandbox.sh
#   WORKSHOP_MODE=consult ./scripts/verify_workshop_buoi1_sandbox.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

WORKSHOP_LEAD_ID="${WORKSHOP_LEAD_ID:-900000910}"
WORKSHOP_MODE="${WORKSHOP_MODE:-reset}"
BASE="${PTT_API_URL:-http://127.0.0.1:3000}"
: "${PTT_CRM_INTERNAL_KEY:?PTT_CRM_INTERNAL_KEY required}"

HDR=(-H "x-ptt-internal-key: ${PTT_CRM_INTERNAL_KEY}")

echo "== Verify workshop sandbox #${WORKSHOP_LEAD_ID} mode=${WORKSHOP_MODE} =="

code="$(curl -s -o /tmp/ws-b1-verify-funnel.json -w '%{http_code}' \
  "$BASE/api/v1/leads/${WORKSHOP_LEAD_ID}/funnel" "${HDR[@]}")"
[[ "$code" =~ ^2 ]] || { echo "FAIL GET funnel HTTP $code"; exit 1; }

python3 - <<PY
import json, os, sys

mode = os.environ.get("WORKSHOP_MODE", "reset")
funnel = json.load(open("/tmp/ws-b1-verify-funnel.json"))
gate = funnel.get("presales_care_gate") or {}
ps = funnel.get("presales")
flow = funnel.get("lead_flow_kind") or ""

checks = []
checks.append(("lead_flow_b2b", flow in ("b2b_prospect", "b2b")))
checks.append(("care_gate", bool(gate.get("complete"))))
if mode == "reset":
    checks.append(("no_presales", ps is None))
elif mode == "consult":
    checks.append(("presales_consult", (ps or {}).get("stage") == "consult"))
    checks.append(("service_slug", (ps or {}).get("service_slug") == "meta-lead-gen"))

fail = False
for name, ok in checks:
    print(("OK  " if ok else "FAIL ") + name)
    if not ok:
        fail = True

if fail:
    sys.exit(1)
print("OK  workshop sandbox verify PASSED")
PY

#!/usr/bin/env bash
# M2 kickoff — RNOS-M2 Portal PWA staging gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${RNOS_M2_ENV:-$ROOT/deploy/env.staging-m2-portal-pwa.example}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export NEXT_PUBLIC_PWA_ENABLED=1

echo "== M2 Portal PWA Kickoff (RNOS-M2) =="
echo "ENV: $ENV_FILE"
echo "NEXT_PUBLIC_PWA_ENABLED=$NEXT_PUBLIC_PWA_ENABLED"
echo "PORTAL_E2E_URL=${PORTAL_E2E_URL:-http://127.0.0.1:3100}"
echo ""

python3 "$ROOT/scripts/generate_portal_pwa_icons.py"

if [[ "${SKIP_M2_DDL:-0}" != "1" ]]; then
  bash "$ROOT/scripts/apply_pg_ddl_portal_push_m2.sh" || echo "WARN  push DDL apply skipped/failed (non-fatal for gate artifacts)"
fi

bash "$ROOT/scripts/rnos_m2_portal_pwa_gate.sh"

echo ""
echo "OK  M2 kickoff gate complete — see .local-dev/rnos-m2-portal-pwa-gate-report.json"

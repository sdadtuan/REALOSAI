#!/usr/bin/env bash
# RNOS-M3 kickoff — apply native device DDL + run Capacitor gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== RNOS-M3 Capacitor kickoff =="

if [[ "${SKIP_DDL:-0}" != "1" ]]; then
  bash "$ROOT/scripts/apply_pg_ddl_portal_native_m3.sh" || echo "WARN  M3 DDL apply skipped/failed (non-fatal for artifact gate)"
fi

bash "$ROOT/scripts/rnos_m3_capacitor_gate.sh"

echo "OK  M3 kickoff gate complete — see .local-dev/rnos-m3-capacitor-gate-report.json"

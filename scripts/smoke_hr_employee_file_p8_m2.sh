#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
test -f "$ROOT/docs/specs/postgresql-ddl-hr-employee-file-p8.sql"
test -f "$ROOT/services/ptt-crm-api/src/hr-employee-file/hr-attendance-geofence.util.ts"
test -f "$ROOT/services/ops-web/src/components/hr/GpsPunchPanel.tsx"
test -f "$ROOT/services/ops-web/src/components/hr/HrGpsPendingQueue.tsx"
echo "OK  P8 M2 artifact check"

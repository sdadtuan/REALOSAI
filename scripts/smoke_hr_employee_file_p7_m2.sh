#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
test -f "$ROOT/docs/specs/postgresql-ddl-hr-employee-file-p7.sql"
test -f "$ROOT/services/ptt-crm-api/src/hr-employee-file/hr-attendance.service.ts"
test -f "$ROOT/services/ops-web/src/app/crm/hr/attendance/page.tsx"
test -f "$ROOT/services/ops-web/src/components/hr/AttendancePanel.tsx"
echo "OK  P7 M2 artifact check"

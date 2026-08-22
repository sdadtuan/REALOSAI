#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
test -f "$ROOT/docs/specs/postgresql-ddl-hr-employee-file-p5.sql"
test -f "$ROOT/services/ptt-crm-api/src/hr-employee-file/hr-staff-p5.service.ts"
test -f "$ROOT/services/ops-web/src/components/hr/DependentsPanel.tsx"
test -f "$ROOT/services/ops-web/src/components/hr/LifecycleSection.tsx"
test -f "$ROOT/services/ops-web/src/components/hr/HrHubExpiryWidgets.tsx"
echo "OK  P5 M2 artifact check"

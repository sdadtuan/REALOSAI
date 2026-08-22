#!/usr/bin/env bash
# Grant crm_research.* caps for Market Research OS P0 (staging).
#
# Positions:
#   SUPER-ADMIN — all crm_research actions
#   MKT-01      — Research Lead stand-in: view/create/edit/run/export/approve
#   KD-01       — AM: view/create/edit/export (no approve, no run)
#   GDKD        — view only
#
# Usage:
#   export DATABASE_URL=...
#   ./scripts/seed_crm_research_rbac.sh          # dry-run
#   ./scripts/seed_crm_research_rbac.sh --apply
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"

APPLY="${1:-}"

grant_sql() {
  cat <<'SQL'
-- SUPER-ADMIN — all
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('crm_research', 'view'),
  ('crm_research', 'create'),
  ('crm_research', 'edit'),
  ('crm_research', 'run'),
  ('crm_research', 'approve'),
  ('crm_research', 'export'),
  ('crm_research', 'configure')
) AS g(section_id, action)
WHERE lower(trim(p.code)) = 'super-admin'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- Research Lead stand-in (MKT-01) until a dedicated position exists
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('crm_research', 'view'),
  ('crm_research', 'create'),
  ('crm_research', 'edit'),
  ('crm_research', 'run'),
  ('crm_research', 'export'),
  ('crm_research', 'approve')
) AS g(section_id, action)
WHERE lower(trim(p.code)) = 'mkt-01'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- AM (KD-01)
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('crm_research', 'view'),
  ('crm_research', 'create'),
  ('crm_research', 'edit'),
  ('crm_research', 'export')
) AS g(section_id, action)
WHERE lower(trim(p.code)) = 'kd-01'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- GDKD — view only
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, 'crm_research', 'view'
FROM crm_positions p
WHERE lower(trim(p.code)) = 'gdkd'
ON CONFLICT (position_id, section_id, action) DO NOTHING;
SQL
}

echo "== Market Research OS RBAC caps =="

if [[ "$APPLY" != "--apply" ]]; then
  echo "Dry-run — caps to grant:"
  echo "  SUPER-ADMIN: crm_research.view/create/edit/run/approve/export/configure"
  echo "  MKT-01: crm_research.view/create/edit/run/export/approve"
  echo "  KD-01: crm_research.view/create/edit/export"
  echo "  GDKD: crm_research.view"
  echo ""
  echo "SQL:"
  grant_sql
  echo ""
  echo "Current crm_research grants:"
  psql "$DATABASE_URL" -c "
    SELECT p.code, s.section_id, s.action
    FROM staff_section_permissions s
    JOIN crm_positions p ON p.id = s.position_id
    WHERE s.section_id = 'crm_research'
    ORDER BY 1, 2, 3;
  " 2>/dev/null || echo "(query failed — DB unreachable or table missing)"
  echo ""
  echo "Run: $0 --apply"
  exit 0
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<<"$(grant_sql)"

echo "OK  crm_research caps applied"
psql "$DATABASE_URL" -c "
  SELECT p.code, s.section_id, s.action
  FROM staff_section_permissions s
  JOIN crm_positions p ON p.id = s.position_id
  WHERE s.section_id = 'crm_research'
  ORDER BY 1, 2, 3;
"

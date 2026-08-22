#!/usr/bin/env bash
# Grant crm_mkt_ai.* caps for MKT-AI P0 pilot (staging).
#
# Positions:
#   SUPER-ADMIN — full mkt-ai caps (+ crm_board)
#   MKT-01      — Solution Strategist (view/generate/export)
#   KD-01       — AM view-only
#
# Usage:
#   export DATABASE_URL=...
#   ./scripts/seed_mkt_ai_pilot_rbac.sh          # dry-run
#   ./scripts/seed_mkt_ai_pilot_rbac.sh --apply
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
-- Solution Strategist + Super Admin
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('crm_board', 'view'),
  ('crm_board', 'edit'),
  ('crm_mkt_ai', 'view'),
  ('crm_mkt_ai', 'generate'),
  ('crm_mkt_ai', 'export')
) AS g(section_id, action)
WHERE lower(trim(p.code)) IN ('super-admin', 'mkt-01')
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- Account Manager — view only
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  ('crm_board', 'view'),
  ('crm_mkt_ai', 'view')
) AS g(section_id, action)
WHERE lower(trim(p.code)) = 'kd-01'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

-- MKT Lead — approve (Phase 2 prep)
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, 'crm_mkt_ai', 'approve'
FROM crm_positions p
WHERE lower(trim(p.code)) IN ('super-admin', 'mkt-01')
ON CONFLICT (position_id, section_id, action) DO NOTHING;
SQL
}

echo "== MKT-AI pilot RBAC caps =="

if [[ "$APPLY" != "--apply" ]]; then
  echo "Dry-run — caps to grant:"
  echo "  SUPER-ADMIN, MKT-01: crm_board.view/edit + crm_mkt_ai.view/generate/export/approve"
  echo "  KD-01: crm_board.view + crm_mkt_ai.view"
  echo ""
  echo "Current crm_mkt_ai grants:"
  psql "$DATABASE_URL" -c "
    SELECT p.code, s.section_id, s.action
    FROM staff_section_permissions s
    JOIN crm_positions p ON p.id = s.position_id
    WHERE s.section_id = 'crm_mkt_ai'
    ORDER BY 1, 2, 3;
  " 2>/dev/null || echo "(query failed)"
  echo ""
  echo "Run: $0 --apply"
  exit 0
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<<"$(grant_sql)"

echo "OK  crm_mkt_ai caps applied"
psql "$DATABASE_URL" -c "
  SELECT p.code, s.section_id, s.action
  FROM staff_section_permissions s
  JOIN crm_positions p ON p.id = s.position_id
  WHERE s.section_id = 'crm_mkt_ai'
  ORDER BY 1, 2, 3;
"

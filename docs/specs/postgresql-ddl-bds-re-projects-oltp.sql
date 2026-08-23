-- RE projects OLTP columns on PostgreSQL (PG-primary when PTT_BDS_PG=1)
BEGIN;

ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'can_ho';
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS district TEXT NOT NULL DEFAULT '';
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS location_address TEXT NOT NULL DEFAULT '';
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS investor_name TEXT NOT NULL DEFAULT '';
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_crm_re_projects_name ON crm_re_projects (lower(name));
CREATE INDEX IF NOT EXISTS idx_crm_re_projects_code ON crm_re_projects (lower(code));

COMMIT;

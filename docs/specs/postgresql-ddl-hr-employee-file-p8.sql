-- HR Employee File OS — P8: GPS attendance (sites + geofence)
-- Apply: scripts/apply_pg_ddl_hr_employee_file_p8.sh

BEGIN;

CREATE TABLE IF NOT EXISTS hr_attendance_sites (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_m INTEGER NOT NULL DEFAULT 150,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_attendance_site_staff (
  site_id BIGINT NOT NULL REFERENCES hr_attendance_sites(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES crm_staff(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (site_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_site_staff_staff
  ON hr_attendance_site_staff (staff_id);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_punches_gps_pending
  ON hr_attendance_punches (status, punched_at DESC)
  WHERE source = 'gps' AND status = 'pending_review';

INSERT INTO schema_migrations (version, description)
VALUES ('hr-employee-file-p8', 'HR Employee File P8 — GPS sites + geofence')
ON CONFLICT (version) DO NOTHING;

COMMIT;

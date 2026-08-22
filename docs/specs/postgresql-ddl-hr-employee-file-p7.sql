-- HR Employee File OS — P7: device attendance (punches + devices)
-- Apply: scripts/apply_pg_ddl_hr_employee_file_p7.sh

BEGIN;

CREATE TABLE IF NOT EXISTS hr_attendance_devices (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  serial TEXT NOT NULL DEFAULT '',
  device_key_hash TEXT NOT NULL DEFAULT '',
  site_name TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  last_seen_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_attendance_devices_serial
  ON hr_attendance_devices (serial)
  WHERE serial <> '';

CREATE INDEX IF NOT EXISTS idx_hr_attendance_devices_key_hash
  ON hr_attendance_devices (device_key_hash)
  WHERE device_key_hash <> '';

CREATE TABLE IF NOT EXISTS hr_attendance_punches (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT REFERENCES crm_staff(id) ON DELETE SET NULL,
  punched_at TIMESTAMPTZ NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out', 'auto')),
  source TEXT NOT NULL CHECK (source IN ('device', 'gps', 'manual')),
  device_id BIGINT REFERENCES hr_attendance_devices(id) ON DELETE SET NULL,
  pin TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  site_id BIGINT,
  outside_geofence BOOLEAN NOT NULL DEFAULT FALSE,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted', 'pending_review', 'rejected', 'duplicate')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_attendance_punches_device_pin_at
  ON hr_attendance_punches (device_id, pin, punched_at)
  WHERE device_id IS NOT NULL AND pin <> '';

CREATE INDEX IF NOT EXISTS idx_hr_attendance_punches_staff_at
  ON hr_attendance_punches (staff_id, punched_at DESC)
  WHERE staff_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hr_attendance_punches_status
  ON hr_attendance_punches (status, punched_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_staff_identity_timeclock_pin
  ON hr_staff_identity (timeclock_pin)
  WHERE timeclock_pin <> '';

INSERT INTO schema_migrations (version, description)
VALUES ('hr-employee-file-p7', 'HR Employee File P7 — device attendance punches + devices')
ON CONFLICT (version) DO NOTHING;

COMMIT;

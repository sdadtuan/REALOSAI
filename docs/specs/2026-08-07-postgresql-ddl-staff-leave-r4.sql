-- WIN-4-D — staff leave lite (R4)
CREATE TABLE IF NOT EXISTS staff_leave_requests (
  id BIGSERIAL PRIMARY KEY,
  staff_user_id UUID NOT NULL,
  staff_email TEXT NOT NULL,
  leave_type TEXT NOT NULL DEFAULT 'annual',
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  approver_user_id UUID,
  approver_email TEXT,
  approved_at TIMESTAMPTZ,
  audit_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_leave_user ON staff_leave_requests (staff_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_leave_status ON staff_leave_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS staff_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link_href TEXT,
  read_at TIMESTAMPTZ,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_notifications_user ON staff_notifications (user_id, read_at NULLS FIRST, created_at DESC);

CREATE TABLE IF NOT EXISTS staff_access_review_actions (
  id BIGSERIAL PRIMARY KEY,
  quarter TEXT NOT NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_email TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_access_review_q ON staff_access_review_actions (quarter, created_at DESC);

-- Pack BĐS P12 / platform staff-tickets — Apply: scripts/apply_pg_ddl_bds_p12.sh
-- staff_id fields are INTEGER (crm_staff.id / numeric JWT sub).
-- No FK to staff_users (UUID PK) or crm_departments (may be absent until org seed).
BEGIN;

CREATE TABLE IF NOT EXISTS crm_staff_ticket_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES bds_tenants (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  kind_default TEXT NOT NULL CHECK (kind_default IN ('dept', 'cross')),
  assignee_dept_code TEXT,
  assignee_dept_id INTEGER,
  sla_minutes INTEGER,
  sla_pauses_on_waiting BOOLEAN NOT NULL DEFAULT FALSE,
  close_requires JSONB NOT NULL DEFAULT '{"type":"none"}'::jsonb,
  sensitivity TEXT NOT NULL DEFAULT 'normal'
    CHECK (sensitivity IN ('normal', 'restricted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS crm_staff_ticket_counters (
  tenant_id UUID PRIMARY KEY REFERENCES bds_tenants (id) ON DELETE CASCADE,
  last_n INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crm_staff_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES bds_tenants (id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('dept', 'cross')),
  queue_code TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'blocked', 'waiting', 'done', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'p2'
    CHECK (priority IN ('p0', 'p1', 'p2', 'p3')),
  requester_staff_id INTEGER NOT NULL,
  requester_dept_code TEXT,
  assignee_staff_id INTEGER,
  assignee_dept_code TEXT,
  project_id INTEGER,
  entity_type TEXT,
  entity_id TEXT,
  room_id UUID,
  parent_id UUID,
  sla_due_at TIMESTAMPTZ,
  sla_breached BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_reason TEXT NOT NULL DEFAULT '',
  waiting_on TEXT NOT NULL DEFAULT '',
  completed_at TIMESTAMPTZ,
  cancelled_reason TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, number)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_staff_tickets_open_entity
  ON crm_staff_tickets (tenant_id, entity_type, entity_id, queue_code)
  WHERE entity_id IS NOT NULL AND status IN ('open', 'in_progress');

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_staff_tickets_idem
  ON crm_staff_tickets (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_staff_tickets_tenant_status
  ON crm_staff_tickets (tenant_id, status, sla_due_at);

CREATE TABLE IF NOT EXISTS crm_staff_ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES crm_staff_tickets (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  actor_staff_id INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_staff_ticket_watchers (
  ticket_id UUID NOT NULL REFERENCES crm_staff_tickets (id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL,
  PRIMARY KEY (ticket_id, staff_id)
);

CREATE TABLE IF NOT EXISTS crm_staff_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES crm_staff_tickets (id) ON DELETE CASCADE,
  author_staff_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;

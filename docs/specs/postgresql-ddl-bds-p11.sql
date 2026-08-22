-- Pack BĐS P11 / platform staff-chat — Apply: scripts/apply_pg_ddl_bds_p11.sh
-- staff_id / created_by / author_staff_id are INTEGER (crm_staff.id / numeric JWT sub).
-- No FK to staff_users (UUID PK) or crm_departments (may be absent until org seed).
BEGIN;

CREATE TABLE IF NOT EXISTS crm_staff_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES bds_tenants (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('dept', 'cross', 'dm', 'huddle')),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  department_id INTEGER,
  project_id INTEGER,
  sensitivity TEXT NOT NULL DEFAULT 'normal'
    CHECK (sensitivity IN ('normal', 'restricted')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_by INTEGER,
  expires_at TIMESTAMPTZ,
  entity_type TEXT,
  entity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_crm_staff_rooms_tenant_kind
  ON crm_staff_rooms (tenant_id, kind, status);

CREATE TABLE IF NOT EXISTS crm_staff_room_members (
  room_id UUID NOT NULL REFERENCES crm_staff_rooms (id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'member', 'readonly')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  last_read_message_id UUID,
  PRIMARY KEY (room_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_staff_room_members_staff
  ON crm_staff_room_members (staff_id);

CREATE TABLE IF NOT EXISTS crm_staff_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES crm_staff_rooms (id) ON DELETE CASCADE,
  author_staff_id INTEGER,
  kind TEXT NOT NULL DEFAULT 'text'
    CHECK (kind IN ('text', 'system', 'entity_card')),
  body TEXT NOT NULL DEFAULT '',
  reply_to_id UUID REFERENCES crm_staff_messages (id),
  entity_type TEXT,
  entity_id TEXT,
  file_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  edited_at TIMESTAMPTZ,
  tombstoned_at TIMESTAMPTZ,
  tombstone_reason TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_staff_messages_idem
  ON crm_staff_messages (room_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_staff_messages_room_created
  ON crm_staff_messages (room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS crm_staff_message_mentions (
  message_id UUID NOT NULL REFERENCES crm_staff_messages (id) ON DELETE CASCADE,
  staff_id INTEGER,
  department_id INTEGER,
  CHECK (staff_id IS NOT NULL OR department_id IS NOT NULL)
);

COMMIT;

-- B2B Market Win Wave 5: Zalo threads, PM role, ads CAPI log, DNC
BEGIN;

-- Task 18: project manager role on staff assignments
ALTER TABLE crm_b2b_project_staff
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'sales'
  CHECK (role IN ('sales', 'project_manager'));

-- Task 17: Zalo OA conversation threads
CREATE TABLE IF NOT EXISTS crm_b2b_conversation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id BIGINT NOT NULL,
  project_id UUID NOT NULL,
  channel TEXT NOT NULL DEFAULT 'zalo',
  oa_id TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, channel, oa_id, external_user_id)
);

CREATE INDEX IF NOT EXISTS idx_b2b_conv_threads_lead ON crm_b2b_conversation_threads (lead_id);

CREATE TABLE IF NOT EXISTS crm_b2b_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES crm_b2b_conversation_threads (id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body TEXT NOT NULL,
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b2b_conv_messages_thread ON crm_b2b_conversation_messages (thread_id, created_at ASC);

-- Task 19: ads CAPI dispatch log
CREATE TABLE IF NOT EXISTS crm_b2b_ads_capi_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id BIGINT NOT NULL,
  channel TEXT NOT NULL,
  campaign_id TEXT,
  hashed_phone TEXT,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b2b_ads_capi_lead ON crm_b2b_ads_capi_log (lead_id, created_at DESC);

-- Task 20: do-not-call registry
CREATE TABLE IF NOT EXISTS crm_b2b_dnc (
  phone_norm TEXT PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;

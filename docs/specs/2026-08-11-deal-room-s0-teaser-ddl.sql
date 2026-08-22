-- F5 — Portal teaser tokens (PostgreSQL)
CREATE TABLE IF NOT EXISTS crm_deal_teaser_tokens (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES crm_leads(sqlite_lead_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_deal_teaser_tokens_lead ON crm_deal_teaser_tokens (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_deal_teaser_tokens_hash ON crm_deal_teaser_tokens (token_hash);

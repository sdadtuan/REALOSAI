-- Sprint 0 Deal Room — crm_proposals lead context (F4)
ALTER TABLE crm_proposals
  ADD COLUMN IF NOT EXISTS lead_id BIGINT REFERENCES crm_leads(sqlite_lead_id),
  ADD COLUMN IF NOT EXISTS presales_id BIGINT REFERENCES crm_lead_presales(id);

CREATE INDEX IF NOT EXISTS idx_crm_proposals_lead ON crm_proposals (lead_id);

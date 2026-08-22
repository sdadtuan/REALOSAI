-- M2 follow-up: unique checksum only where qc_status = 'verified'.
-- Superseded/pending/rejected may share a hash (supersede then verify same 6-tuple).

DROP INDEX IF EXISTS crm_research_evidence_hash_uq;

CREATE UNIQUE INDEX IF NOT EXISTS crm_research_evidence_hash_uq
  ON crm_research_evidence (project_id, checksum)
  WHERE qc_status = 'verified' AND checksum IS NOT NULL;

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-14-market-research-m2',
        'Evidence unique checksum only when qc_status=verified'
    )
ON CONFLICT (version) DO NOTHING;

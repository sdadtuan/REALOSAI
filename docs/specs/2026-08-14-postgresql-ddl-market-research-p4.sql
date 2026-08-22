-- Market Research OS P4 — 2026-08-14 (M4 published_by / published_at)

ALTER TABLE crm_research_report_versions
  ADD COLUMN IF NOT EXISTS published_by TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

INSERT INTO schema_migrations (version, description) VALUES
  ('2026-08-14-market-research-p4-m4', 'P4: published_by / published_at')
ON CONFLICT (version) DO NOTHING;

-- Video SOP S12 — no schema changes required (S11 webhook index sufficient)
-- Optional: ensure webhook events index exists for leonardo lookups

CREATE INDEX IF NOT EXISTS idx_vd_webhook_events_provider_created
  ON vd_webhook_events (provider_code, created_at DESC);

-- W3: ASEAN market_country on demo requests
ALTER TABLE gtm_demo_request
  ADD COLUMN IF NOT EXISTS market_country text
  CHECK (market_country IS NULL OR market_country IN ('th', 'id', 'ph', 'sg'));

CREATE INDEX IF NOT EXISTS gtm_demo_request_market_created_idx
  ON gtm_demo_request (market_country, created_at DESC)
  WHERE market_country IS NOT NULL;

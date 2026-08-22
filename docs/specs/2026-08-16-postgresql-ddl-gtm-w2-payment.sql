CREATE TABLE IF NOT EXISTS gtm_payment (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  stripe_session_id    text NOT NULL UNIQUE,
  stripe_payment_intent text,
  sku                  text NOT NULL CHECK (sku IN ('mkt', 'ind', 'agy')),
  amount_cents         integer NOT NULL CHECK (amount_cents > 0),
  currency             text NOT NULL DEFAULT 'usd',
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'paid', 'failed', 'expired')),
  payer_email          text NOT NULL,
  demo_request_id      uuid REFERENCES gtm_demo_request(id),
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_gtm_payment_status ON gtm_payment(status, created_at DESC);

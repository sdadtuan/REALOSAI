-- RNOS-M2 — Web Push subscriptions for portal approvers
CREATE TABLE IF NOT EXISTS portal_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    portal_user_id UUID NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (portal_user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_portal_push_subscriptions_client
    ON portal_push_subscriptions (client_id, portal_user_id);

COMMENT ON TABLE portal_push_subscriptions IS 'RNOS-M2 — Web Push endpoints scoped by portal user + client';

-- RNOS-M3 — Native device tokens (Capacitor FCM/APNs via FCM)
CREATE TABLE IF NOT EXISTS portal_native_device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    portal_user_id UUID NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'unknown')),
    device_token TEXT NOT NULL,
    app_version TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (portal_user_id, device_token)
);

CREATE INDEX IF NOT EXISTS idx_portal_native_device_tokens_client
    ON portal_native_device_tokens (client_id, portal_user_id);

COMMENT ON TABLE portal_native_device_tokens IS 'RNOS-M3 — Capacitor native push tokens scoped by portal user';

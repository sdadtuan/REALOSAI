-- B2B staff push subscriptions (ops-web PWA / FCM)
BEGIN;

CREATE TABLE IF NOT EXISTS crm_b2b_staff_push_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        BIGINT NOT NULL,
    endpoint        TEXT,
    p256dh          TEXT,
    auth            TEXT,
    fcm_token       TEXT,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_b2b_staff_push_target CHECK (
        (endpoint IS NOT NULL AND p256dh IS NOT NULL AND auth IS NOT NULL)
        OR fcm_token IS NOT NULL
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_b2b_staff_push_web
    ON crm_b2b_staff_push_subscriptions (staff_id, endpoint)
    WHERE endpoint IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_b2b_staff_push_fcm
    ON crm_b2b_staff_push_subscriptions (staff_id, fcm_token)
    WHERE fcm_token IS NOT NULL;

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-08-19-b2b-staff-push', 'staff web-push and FCM for B2B hot lead alerts')
ON CONFLICT (version) DO NOTHING;

COMMIT;

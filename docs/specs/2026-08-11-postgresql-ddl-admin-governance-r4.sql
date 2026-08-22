-- R4 — Admin Identity Governance (access review campaigns, guest TTL)
-- Apply: ./scripts/apply_pg_ddl_admin_governance_r4.sh

BEGIN;

CREATE TABLE IF NOT EXISTS admin_access_review_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    quarter         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft',
    scope_type      TEXT NOT NULL DEFAULT 'all',
    scope_ref       TEXT,
    due_at          TIMESTAMPTZ NOT NULL,
    owner_email     TEXT NOT NULL,
    launched_at     TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_campaigns_status_due
    ON admin_access_review_campaigns (status, due_at);

CREATE TABLE IF NOT EXISTS admin_access_review_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES admin_access_review_campaigns (id) ON DELETE CASCADE,
    user_id             UUID NOT NULL,
    user_email          TEXT NOT NULL,
    user_display_name   TEXT NOT NULL DEFAULT '',
    position_code       TEXT,
    team_ids            JSONB NOT NULL DEFAULT '[]'::jsonb,
    snapshot_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
    decision            TEXT NOT NULL DEFAULT 'pending',
    certifier_email     TEXT,
    certifier_note      TEXT,
    decided_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ar_items_campaign_decision
    ON admin_access_review_items (campaign_id, decision);

CREATE INDEX IF NOT EXISTS idx_ar_items_pending
    ON admin_access_review_items (campaign_id, decision)
    WHERE decision = 'pending';

ALTER TABLE staff_access_review_actions
    ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES admin_access_review_campaigns (id);

ALTER TABLE staff_users
    ADD COLUMN IF NOT EXISTS account_kind VARCHAR(16) NOT NULL DEFAULT 'staff',
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_staff_users_last_login
    ON staff_users (last_login_at DESC)
    WHERE active IS TRUE;

CREATE INDEX IF NOT EXISTS idx_staff_users_expires
    ON staff_users (expires_at)
    WHERE expires_at IS NOT NULL AND active IS TRUE;

COMMENT ON COLUMN staff_users.account_kind IS 'staff | guest | contractor';

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-08-11-admin-governance-r4', 'R4 access review campaigns + guest TTL')
ON CONFLICT (version) DO NOTHING;

COMMIT;

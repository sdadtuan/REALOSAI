-- RNOSAI — Content Marketing OS PostgreSQL DDL
-- Spec: docs/superpowers/specs/2026-08-09-content-marketing-os-design.md §8
-- Apply:
--   psql "$DATABASE_URL" -f docs/specs/2026-08-09-postgresql-ddl-content-marketing.sql
-- Or: ./scripts/apply_pg_ddl_content_marketing.sh
--
-- Requires:
--   - crm_service_lifecycle (wave-b5 OLTP bridge)
--   - ai_agent_runs (optional FK — revenue-os-ai DDL)

BEGIN;

-- ===========================================================================
-- Plan snapshots (frozen Planner ingest)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS cmkt_plan_snapshots (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    marketing_plan_id       BIGINT,
    snapshot_json           JSONB NOT NULL DEFAULT '{}'::jsonb,
    brand_context_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_hash             TEXT NOT NULL DEFAULT '',
    ingested_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ingested_by             VARCHAR(120) NOT NULL DEFAULT '',
    sealed                  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_cmkt_plan_snapshots_lifecycle
    ON cmkt_plan_snapshots (lifecycle_id, ingested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cmkt_plan_snapshots_one_active
    ON cmkt_plan_snapshots (lifecycle_id)
    WHERE sealed = FALSE;

COMMENT ON TABLE cmkt_plan_snapshots IS
    'Frozen ingest from MKT-AI Planner Apply — immutable after seal.';

-- ===========================================================================
-- Pillars & ideas
-- ===========================================================================

CREATE TABLE IF NOT EXISTS cmkt_content_pillars (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    snapshot_id             BIGINT REFERENCES cmkt_plan_snapshots (id) ON DELETE SET NULL,
    name                    TEXT NOT NULL DEFAULT '',
    goal                    TEXT NOT NULL DEFAULT '',
    topics_json             JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order              INT NOT NULL DEFAULT 0,
    active                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmkt_content_pillars_lifecycle
    ON cmkt_content_pillars (lifecycle_id, sort_order);

CREATE TABLE IF NOT EXISTS cmkt_content_ideas (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    pillar_id               BIGINT REFERENCES cmkt_content_pillars (id) ON DELETE SET NULL,
    title                   TEXT NOT NULL DEFAULT '',
    hook                    TEXT NOT NULL DEFAULT '',
    target_goal             TEXT NOT NULL DEFAULT '',
    channel_hints           TEXT[] NOT NULL DEFAULT '{}',
    source                  TEXT NOT NULL DEFAULT 'manual',
    status                  TEXT NOT NULL DEFAULT 'backlog',
    meta_json               JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              VARCHAR(120) NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cmkt_content_ideas_source_check CHECK (
        source IN ('planner_import', 'ai_batch', 'manual')
    ),
    CONSTRAINT cmkt_content_ideas_status_check CHECK (
        status IN ('backlog', 'shortlisted', 'converted', 'archived')
    )
);

CREATE INDEX IF NOT EXISTS idx_cmkt_content_ideas_lifecycle_status
    ON cmkt_content_ideas (lifecycle_id, status, created_at DESC);

-- ===========================================================================
-- Content items (execution hub)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS cmkt_content_items (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    idea_id                 BIGINT REFERENCES cmkt_content_ideas (id) ON DELETE SET NULL,
    parent_item_id          BIGINT REFERENCES cmkt_content_items (id) ON DELETE SET NULL,
    title                   TEXT NOT NULL DEFAULT '',
    format                  TEXT NOT NULL,
    channel                 TEXT NOT NULL,
    funnel_goal             TEXT NOT NULL DEFAULT '',
    status                  TEXT NOT NULL DEFAULT 'draft',
    assignee_sp             BIGINT,
    assignee_qa             BIGINT,
    brief_json              JSONB NOT NULL DEFAULT '{}'::jsonb,
    body_json               JSONB NOT NULL DEFAULT '{}'::jsonb,
    selected_variant_idx    INT,
    quality_score_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    seo_bridge_id           BIGINT,
    email_bridge_id         BIGINT,
    published_url           TEXT,
    published_at            TIMESTAMPTZ,
    due_at                  TIMESTAMPTZ,
    in_review_at            TIMESTAMPTZ,
    created_by              VARCHAR(120) NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cmkt_content_items_status_check CHECK (
        status IN (
            'draft', 'in_review', 'changes_requested', 'approved_internal',
            'pending_client', 'client_approved', 'scheduled', 'published', 'archived'
        )
    ),
    CONSTRAINT cmkt_content_items_channel_check CHECK (
        channel IN (
            'website', 'facebook', 'linkedin', 'short_video', 'youtube',
            'newsletter', 'drip', 'zalo_oa', 'meta_ads', 'google_ads', 'document'
        )
    ),
    CONSTRAINT cmkt_content_items_format_check CHECK (
        format IN ('blog', 'social_post', 'carousel', 'email', 'video_script', 'ad_copy')
    ),
    CONSTRAINT cmkt_content_items_channel_format_check CHECK (
        (channel = 'website' AND format = 'blog')
        OR (channel IN ('facebook', 'linkedin') AND format IN ('social_post', 'carousel'))
        OR (channel IN ('short_video', 'youtube') AND format = 'video_script')
        OR (channel IN ('newsletter', 'drip') AND format = 'email')
        OR (channel = 'zalo_oa' AND format = 'social_post')
        OR (channel IN ('meta_ads', 'google_ads') AND format = 'ad_copy')
        OR (channel = 'document' AND format = 'blog')
    )
);

CREATE INDEX IF NOT EXISTS idx_cmkt_content_items_lifecycle_status
    ON cmkt_content_items (lifecycle_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cmkt_content_items_lifecycle_channel
    ON cmkt_content_items (lifecycle_id, channel, format);

CREATE INDEX IF NOT EXISTS idx_cmkt_content_items_in_review
    ON cmkt_content_items (lifecycle_id, in_review_at)
    WHERE status = 'in_review';

-- ===========================================================================
-- Versions, derivations, calendar, comments, metrics
-- ===========================================================================

CREATE TABLE IF NOT EXISTS cmkt_content_item_versions (
    id                      BIGSERIAL PRIMARY KEY,
    item_id                 BIGINT NOT NULL
                            REFERENCES cmkt_content_items (id) ON DELETE CASCADE,
    version_no              INT NOT NULL,
    body_json               JSONB NOT NULL DEFAULT '{}'::jsonb,
    changed_by              VARCHAR(120) NOT NULL DEFAULT '',
    change_reason           TEXT NOT NULL DEFAULT 'manual',
    ai_run_id               UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cmkt_content_item_versions_unique UNIQUE (item_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_cmkt_content_item_versions_item
    ON cmkt_content_item_versions (item_id, version_no DESC);

CREATE TABLE IF NOT EXISTS cmkt_content_item_derivations (
    id                      BIGSERIAL PRIMARY KEY,
    source_item_id          BIGINT NOT NULL
                            REFERENCES cmkt_content_items (id) ON DELETE CASCADE,
    derived_item_id         BIGINT NOT NULL
                            REFERENCES cmkt_content_items (id) ON DELETE CASCADE,
    transform_type          TEXT NOT NULL DEFAULT '',
    prompt_profile          TEXT NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cmkt_calendar_slots (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    item_id                 BIGINT NOT NULL
                            REFERENCES cmkt_content_items (id) ON DELETE CASCADE,
    scheduled_at            TIMESTAMPTZ NOT NULL,
    timezone                TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    reminder_sent           BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT cmkt_calendar_slots_item_unique UNIQUE (item_id)
);

CREATE INDEX IF NOT EXISTS idx_cmkt_calendar_slots_lifecycle
    ON cmkt_calendar_slots (lifecycle_id, scheduled_at);

CREATE TABLE IF NOT EXISTS cmkt_content_comments (
    id                      BIGSERIAL PRIMARY KEY,
    item_id                 BIGINT NOT NULL
                            REFERENCES cmkt_content_items (id) ON DELETE CASCADE,
    author_id               VARCHAR(120) NOT NULL DEFAULT '',
    body                    TEXT NOT NULL DEFAULT '',
    visibility              TEXT NOT NULL DEFAULT 'internal',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cmkt_content_comments_visibility_check CHECK (
        visibility IN ('internal', 'client')
    )
);

CREATE INDEX IF NOT EXISTS idx_cmkt_content_comments_item
    ON cmkt_content_comments (item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS cmkt_content_metrics (
    id                      BIGSERIAL PRIMARY KEY,
    item_id                 BIGINT NOT NULL
                            REFERENCES cmkt_content_items (id) ON DELETE CASCADE,
    channel                 TEXT NOT NULL DEFAULT '',
    metric_date             DATE NOT NULL,
    impressions             BIGINT,
    engagements             BIGINT,
    clicks                  BIGINT,
    leads                   INT,
    source                  TEXT NOT NULL DEFAULT 'manual',
    raw_json                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmkt_content_metrics_item_date
    ON cmkt_content_metrics (item_id, metric_date DESC);

-- ===========================================================================
-- Async AI jobs
-- ===========================================================================

CREATE TABLE IF NOT EXISTS cmkt_content_jobs (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    item_id                 BIGINT REFERENCES cmkt_content_items (id) ON DELETE SET NULL,
    job_type                TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'queued',
    input_json              JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_json             JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_text              TEXT,
    ai_run_id               UUID,
    created_by              VARCHAR(120) NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at             TIMESTAMPTZ,
    CONSTRAINT cmkt_content_jobs_status_check CHECK (
        status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')
    ),
    CONSTRAINT cmkt_content_jobs_type_check CHECK (
        job_type IN (
            'idea_batch',
            'draft_generate',
            'variant_generate',
            'repurpose',
            'optimize_hook',
            'weekly_memo',
            'intelligence_digest',
            'image_generate',
            'carousel_slides_generate',
            'video_short_generate',
            'visual_qa_score'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_cmkt_content_jobs_lifecycle_created
    ON cmkt_content_jobs (lifecycle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cmkt_content_jobs_item_status
    ON cmkt_content_jobs (item_id, status, created_at DESC);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ai_agent_runs'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'cmkt_content_jobs_ai_run_fk'
    ) THEN
        ALTER TABLE cmkt_content_jobs
            ADD CONSTRAINT cmkt_content_jobs_ai_run_fk
            FOREIGN KEY (ai_run_id) REFERENCES ai_agent_runs (id) ON DELETE SET NULL;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Schema migration marker
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-09-content-marketing',
        'Content Marketing OS: snapshots, pillars, ideas, items, versions, calendar, jobs'
    )
ON CONFLICT (version) DO NOTHING;

-- M5: production handoff §23
ALTER TABLE cmkt_content_items
    ADD COLUMN IF NOT EXISTS production_json JSONB NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-09-content-marketing-m5',
        'Content Marketing M5: production_json for design/video handoff'
    )
ON CONFLICT (version) DO NOTHING;

-- M6: AI media §24
ALTER TABLE cmkt_content_items
    ADD COLUMN IF NOT EXISTS visual_status TEXT NOT NULL DEFAULT 'not_needed';
ALTER TABLE cmkt_content_items
    ADD COLUMN IF NOT EXISTS media_json JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'cmkt_content_items' AND constraint_name = 'cmkt_content_items_visual_status_check'
    ) THEN
        ALTER TABLE cmkt_content_items
            ADD CONSTRAINT cmkt_content_items_visual_status_check CHECK (
                visual_status IN (
                    'not_needed', 'ai_pending', 'ai_ready', 'human_polish', 'approved', 'rejected'
                )
            );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-09-content-marketing-m6',
        'Content Marketing M6: visual_status and media_json for AI media'
    )
ON CONFLICT (version) DO NOTHING;

-- M11: extend async job types (topic_suggest, ideas_bulk)
ALTER TABLE cmkt_content_jobs DROP CONSTRAINT IF EXISTS cmkt_content_jobs_type_check;
ALTER TABLE cmkt_content_jobs ADD CONSTRAINT cmkt_content_jobs_type_check CHECK (
    job_type IN (
        'idea_batch',
        'ideas_bulk',
        'draft_generate',
        'variant_generate',
        'repurpose',
        'optimize_hook',
        'weekly_memo',
        'intelligence_digest',
        'topic_suggest',
        'image_generate',
        'carousel_slides_generate',
        'video_short_generate',
        'visual_qa_score',
        'social_storyboard',
        'social_render',
        'social_transcode',
        'social_qa'
    )
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-09-content-marketing-m11',
        'Content Marketing M11: ideas_bulk, topic_suggest job types, planner glue'
    )
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-09-content-marketing-m12',
        'Content Marketing M12: client gate, portal summary, video_short_generate (flags only)'
    )
ON CONFLICT (version) DO NOTHING;

COMMIT;

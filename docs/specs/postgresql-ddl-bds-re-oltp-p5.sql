-- BĐS RE OLTP P5 — project plan JSON + extended OLTP columns on crm_re_projects
BEGIN;

ALTER TABLE crm_re_projects
    ADD COLUMN IF NOT EXISTS total_land_area_m2 NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS total_units INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sold_units INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS revenue_target_vnd BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS start_date TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS presale_date TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS handover_date TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS business_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS marketing_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS sales_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;

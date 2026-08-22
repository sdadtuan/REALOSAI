-- MKT-AI Planner Phase 4 depth (WS-P4-02) — optional migration
-- Run once on staging/prod before enabling PTT_MKT_AI_PLAN_DEPTH_ENABLED=1

ALTER TABLE mkt_ai_drafts
  ADD COLUMN IF NOT EXISTS kpi_tree_json JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN mkt_ai_drafts.kpi_tree_json IS 'Structured KPI tree — north_star → campaign KPIs (MKTP-UC-026)';

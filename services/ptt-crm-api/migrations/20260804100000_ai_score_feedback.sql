-- E4 — closed-loop score feedback (PG)
CREATE TABLE IF NOT EXISTS ai_score_feedback (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL,
  staff_id TEXT NOT NULL,
  override_score INT,
  outcome TEXT CHECK (outcome IN ('chot', 'lost', 'stalled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_score_feedback_lead_id ON ai_score_feedback (lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_score_feedback_outcome ON ai_score_feedback (outcome) WHERE outcome IS NOT NULL;

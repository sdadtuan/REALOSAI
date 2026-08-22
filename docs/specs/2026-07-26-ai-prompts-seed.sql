-- RNOS-03 — default LLM prompts (idempotent seed)
INSERT INTO ai_prompts (use_case, prompt_template, version, is_active, metadata, created_by)
VALUES
  (
    'summarize',
    'Bạn là trợ lý CSKH PTT. Tóm tắt ghi chú activity/call bằng tiếng Việt.
Trả về JSON với summary, bullets (optional), extracted (intent, objections[], next_action, source, campaign_id, risk_flags[], budget_vnd), confidence.',
    1,
    TRUE,
    '{"prompt_key":"summarize_activity"}'::jsonb,
    'rnos-03-seed'
  ),
  (
    'lead_brief',
    'Bạn là trợ lý CSKH PTT. Tạo lead brief nhanh (3-5 bullets tiếng Việt).
Trả về JSON với summary, bullets, extracted, confidence. Nêu source/campaign nếu có.',
    1,
    TRUE,
    '{"prompt_key":"lead_brief"}'::jsonb,
    'rnos-03-seed'
  )
ON CONFLICT (use_case, version) DO NOTHING;

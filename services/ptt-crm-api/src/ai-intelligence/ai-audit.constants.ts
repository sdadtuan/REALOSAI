/** Canonical use_case values — mọi AI call phải dùng một trong các giá trị này. */
export const AI_USE_CASE = {
  HEALTH_CHECK: 'health_check',
  SUMMARIZE: 'summarize',
  LEAD_BRIEF: 'lead_brief',
  SCORE_LEAD: 'score_lead',
  SCORE_DEAL: 'score_deal',
  NEXT_BEST_ACTION: 'next_best_action',
  PLAYBOOK_RAG: 'playbook_rag',
  FOLLOW_UP_DRAFT: 'follow_up_draft',
  OVERRIDE_SCORE: 'override_score',
  PIPELINE_RISK_SCAN: 'pipeline_risk_scan',
  FORECAST_SNAPSHOT: 'forecast_snapshot',
  FORECAST_COMMIT: 'forecast_commit',
  RENEWAL_SCAN: 'renewal_scan',
  RENEWAL_DRAFT: 'renewal_draft',
  RENEWAL_APPROVE: 'renewal_approve',
  CHURN_SCORE: 'churn_score',
  CHURN_RECOVERY_PLAN: 'churn_recovery_plan',
  PIPELINE_RISK_ASSIGN: 'pipeline_risk_assign',
  PIPELINE_RISK_ACTIVITY: 'pipeline_risk_activity',
  COACH_DIGEST_GENERATE: 'coach_digest_generate',
  NL_QUERY: 'nl_query',
  TICKET_SENTIMENT: 'ticket_sentiment',
  PORTAL_REPORT_SUMMARY: 'portal_report_summary',
  CHANNEL_ANOMALY_DIGEST: 'channel_anomaly_digest',
  CPL_WEEKLY_DIGEST: 'cpl_weekly_digest',
  BUDGET_RECOMMEND: 'budget_recommend',
  ROUTE_REP: 'route_rep',
  LEAD_MEETING_PREP: 'lead_meeting_prep',
  REVIEW_QUEUE_TRIAGE: 'review_queue_triage',
  UPSELL_SUGGEST: 'upsell_suggest',
  UPSELL_APPROVE: 'upsell_approve',
  ORCHESTRATION_RUN: 'orchestration_run',
  ORCHESTRATION_STEP: 'orchestration_step',
  TOOL_CALL: 'tool_call',
} as const;

export type AiUseCase = (typeof AI_USE_CASE)[keyof typeof AI_USE_CASE];

/** Error codes persisted in output_json.error_code (RNOS-05). */
export const AI_AUDIT_ERROR = {
  SCHEMA_NOT_READY: 'SCHEMA_NOT_READY',
  LLM_TIMEOUT: 'LLM_TIMEOUT',
  LLM_PROVIDER_ERROR: 'LLM_PROVIDER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SCORE_RULES_ERROR: 'SCORE_RULES_ERROR',
  AUDIT_PERSIST_FAILED: 'AUDIT_PERSIST_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type AiAuditErrorCode = (typeof AI_AUDIT_ERROR)[keyof typeof AI_AUDIT_ERROR];

export const AI_AUDIT_DEFAULT_AGENT = 'ai-intelligence';

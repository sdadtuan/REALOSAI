export type AiHealthStatus = 'ok' | 'degraded' | 'disabled';

export interface AiHealthData {
  status: AiHealthStatus;
  service: 'ai-intelligence';
  copilot_enabled: boolean;
  pilot_cohort_size: number;
  /** Runbook alias — same as llm_model */
  model: string;
  llm_provider: string;
  llm_model: string;
  score_async: boolean;
  schema_ready: boolean;
  postgres: boolean;
  migration_version: string | null;
}

export interface AiApiEnvelope<T> {
  data: T;
  meta: { request_id: string };
  errors: unknown[];
}

export type AiHealthResponse = AiApiEnvelope<AiHealthData>;

export type AiAgentRunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface AiTokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface AiAgentRunInsert {
  agentName: string;
  useCase: string;
  clientId?: string | null;
  modelName?: string | null;
  promptHash?: string | null;
  inputJson?: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  status: AiAgentRunStatus;
  latencyMs?: number | null;
  tokenUsage?: AiTokenUsage;
  correlationId?: string | null;
  actorId?: string | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  parentRunId?: string | null;
  orchestrationId?: string | null;
  stepKey?: string | null;
  stepIndex?: number | null;
}

export interface AiAgentRunRow {
  id: string;
}

export interface AiAgentRunRecord {
  id: string;
  client_id: string | null;
  agent_name: string;
  use_case: string | null;
  model_name: string | null;
  prompt_hash: string | null;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  status: AiAgentRunStatus;
  latency_ms: number | null;
  token_usage: AiTokenUsage;
  error_message: string | null;
  correlation_id: string | null;
  actor_id: string | null;
  parent_run_id: string | null;
  orchestration_id: string | null;
  step_key: string | null;
  step_index: number | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface AiAgentRunListQuery {
  from?: string;
  to?: string;
  useCase?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  status?: AiAgentRunStatus;
  limit?: number;
  offset?: number;
}

export interface AiAgentRunListResult {
  rows: AiAgentRunRecord[];
  total: number;
}

export interface AiAuditContext {
  useCase: string;
  agentName?: string;
  actorId?: string | null;
  correlationId?: string | null;
  clientId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  input?: Record<string, unknown>;
  modelName?: string | null;
  parentRunId?: string | null;
  orchestrationId?: string | null;
  stepKey?: string | null;
  stepIndex?: number | null;
}

export interface AiAuditWrapResult<T> {
  data: T;
  runId: string;
  requestId: string;
  latencyMs: number;
}

export interface AiAuditRunMeta {
  runId: string;
  requestId: string;
}

import { AiAgentRunInsert, AiAgentRunRecord, AiAgentRunRow, AiAgentRunStatus } from '../ai-intelligence.types';
import type { AiUseCase } from '../ai-audit.constants';

export const ORCHESTRATOR_MIGRATION_VERSION = '2026-07-27-rnos31-orchestrator';

export type AiOrchestrationStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';

export type AiOrchestrationTriggerType = 'manual' | 'cron' | 'webhook' | 'workflow';

export interface AiOrchestrationInsert {
  clientId?: string | null;
  triggerType: AiOrchestrationTriggerType;
  triggerRef?: string | null;
  planKey: string;
  status?: AiOrchestrationStatus;
  inputJson?: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  correlationId?: string | null;
  actorId?: string | null;
}

export interface AiOrchestrationRow {
  id: string;
}

export interface AiOrchestrationRecord {
  id: string;
  client_id: string | null;
  trigger_type: AiOrchestrationTriggerType;
  trigger_ref: string | null;
  plan_key: string;
  status: AiOrchestrationStatus;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  correlation_id: string | null;
  actor_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface AiOrchestrationChildRunInsert extends AiAgentRunInsert {
  parentRunId: string;
  orchestrationId: string;
  stepKey: string;
  stepIndex: number;
}

export interface AiOrchestrationTree {
  orchestration: AiOrchestrationRecord;
  parentRun: AiAgentRunRecord | null;
  children: AiAgentRunRecord[];
}

export interface OrchestratorContext {
  [key: string]: unknown;
  entityType?: string;
  entityId?: string;
  leadId?: number;
  leadScore?: number;
  clientId?: string | null;
  actorId?: string | null;
  correlationId?: string | null;
  channel?: string;
  days?: number;
}

export interface OrchestratorAuditContext {
  actorId?: string | null;
  correlationId?: string | null;
  clientId?: string | null;
}

export interface StepResult {
  data: unknown;
  meta?: { request_id: string };
  errors?: unknown[];
}

export type AgentHandler = (
  ctx: OrchestratorContext,
  auditCtx: OrchestratorAuditContext,
) => Promise<StepResult>;

export interface RegisteredAgent {
  agentName: string;
  useCase: AiUseCase;
  handler: AgentHandler;
}

export type OrchestratorStepKey =
  | 'score_lead'
  | 'route_rep'
  | 'renewal_scan'
  | 'upsell_suggest'
  | 'channel_anomaly'
  | 'budget_recommend';

export interface OrchestrationPlanStep {
  key: OrchestratorStepKey;
  required: boolean;
  when?: (ctx: OrchestratorContext) => boolean;
}

export interface OrchestrationPlan {
  key: string;
  steps: readonly OrchestrationPlanStep[];
}

export interface OrchestratorStepExecution {
  stepKey: OrchestratorStepKey;
  stepIndex: number;
  required: boolean;
  status: 'succeeded' | 'failed' | 'skipped';
  runId?: string;
  data?: unknown;
  error?: string;
}

export interface OrchestratorEngineContext {
  orchestrationId: string;
  parentRunId: string;
  planKey: string;
  input: OrchestratorContext;
  actorId?: string | null;
  correlationId?: string | null;
  clientId?: string | null;
}

export interface OrchestratorRunRequest {
  planKey: string;
  clientId?: string | null;
  input: OrchestratorContext;
  actorId?: string | null;
  correlationId?: string | null;
  triggerType?: AiOrchestrationTriggerType;
  triggerRef?: string | null;
}

export interface OrchestratorCronJobOutcome {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  plan_key?: string;
  renewal_plan_key?: string;
  renewal_scan?: 'succeeded' | 'failed';
  clients?: number;
  succeeded?: number;
  failed?: number;
  errors?: string[];
}

export interface OrchestratorRunData {
  orchestration_id: string;
  parent_run_id: string;
  plan_key: string;
  status: 'succeeded';
  steps: OrchestratorStepExecution[];
}

export interface OrchestratorListQuery {
  from?: string;
  to?: string;
  planKey?: string;
  status?: AiOrchestrationStatus;
  limit?: number;
  offset?: number;
}

export interface OrchestratorListResult {
  rows: AiOrchestrationRecord[];
  total: number;
}

export type { AiAgentRunRecord, AiAgentRunRow, AiAgentRunStatus };

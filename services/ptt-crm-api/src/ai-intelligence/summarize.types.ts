export type SummarizeContext = 'lead_brief' | 'activity';

export interface SummarizeExtracted {
  intent: string | null;
  objections: string[];
  next_action: string | null;
  source: string | null;
  campaign_id: string | null;
  risk_flags: string[];
  budget_vnd: number | null;
}

export interface SummarizeEngineResult {
  summary: string;
  bullets: string[];
  extracted: SummarizeExtracted;
  confidence: number;
}

export interface SummarizeRequest {
  context: SummarizeContext;
  entityType?: string;
  entityId?: string;
  text?: string;
  actorId?: string | null;
  correlationId?: string | null;
  clientId?: string | null;
}

export interface SummarizeResponseData {
  context: SummarizeContext;
  entity_type: string | null;
  entity_id: string | null;
  summary: string;
  bullets: string[];
  extracted: SummarizeExtracted;
  confidence: number;
  agent_run_id: string;
  model: string;
  stub_mode: boolean;
}

export type SummarizeResponse = {
  data: SummarizeResponseData;
  meta: { request_id: string; latency_ms?: number };
  errors: unknown[];
};

export const SUMMARIZE_MAX_TEXT_LENGTH = 8000;
export const SUMMARIZE_MAX_BULLETS = 5;

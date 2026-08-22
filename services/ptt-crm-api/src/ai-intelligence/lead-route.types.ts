import { ScoreBand } from './lead-score.types';

export type LeadRouteStrategy = 'project_pool' | 'source_match' | 'global_round_robin';

export interface LeadRouteCandidate {
  staff_id: number;
  staff_name: string;
  staff_code: string;
  role: string;
  open_leads: number;
  sort_order?: number;
}

export interface LeadRouteContext {
  leadId: number;
  clientId: string | null;
  ownerId: number | null;
  reProjectId: number | null;
  b2bProjectId?: string | null;
  channel: string | null;
  source: string | null;
  status: string | null;
  productLine: string | null;
  zone: string | null;
  scoreBand: ScoreBand | null;
  leadScore: number | null;
  candidates: LeadRouteCandidate[];
}

export interface LeadRouteEngineResult {
  recommendedStaffId: number;
  recommendedStaffName: string;
  recommendedStaffCode: string;
  strategy: LeadRouteStrategy;
  reason: string;
  confidence: number;
  ruleId: string;
  projectId: number | null;
  alternatives: LeadRouteCandidate[];
}

export interface RouteLeadRequest {
  lead_id?: number;
  force?: boolean;
  actorId?: string | null;
  correlationId?: string;
}

export interface RouteLeadResponse {
  data: {
    recommendation_id: string;
    lead_id: number;
    recommended_staff_id: number;
    recommended_staff_name: string;
    recommended_staff_code: string;
    strategy: LeadRouteStrategy;
    reason: string;
    confidence: number;
    status: string;
    recommendation_text: string;
    agent_run_id: string;
  };
  meta: { request_id: string };
  errors: [];
}

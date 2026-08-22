import { Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { CatalogService } from '../catalog/catalog.service';
import { CrmLeadsLegacyService } from '../crm-leads-legacy/crm-leads-legacy.service';
import { LeadsFunnelService } from '../leads-funnel/leads-funnel.service';
import type { LeadFlowKind } from '../leads-funnel/lead-flow-kind.util';
import type { CarePipelineState, PresalesCareGateState, ReviewQueuePublicState } from '../leads-funnel/leads-funnel.types';
import { LeadMeetingPrepRepository } from '../lead-meeting-prep/lead-meeting-prep.repository';
import { extractLmpConsultMergeFields } from '../lead-meeting-prep/lmp-consult-merge.util';
import { ChotClosedLoopService, type LeadClosedLoopContextResponse } from './chot-closed-loop.service';
import { LeadSlaCareService, type LeadSlaCareContextResponse } from './lead-sla-care.service';

export interface CopilotActivitySnippet {
  id: number;
  activity_type: string;
  activity_type_label: string;
  content: string;
  created_at: string;
  user_name: string;
}

export interface CopilotCatalogService {
  slug: string;
  name: string;
  description: string;
}

export interface CopilotFunnelSlice {
  care_pipeline: CarePipelineState;
  presales_care_gate: PresalesCareGateState;
  review_queue: ReviewQueuePublicState;
  presales_on_lead_enabled: boolean;
}

export interface CopilotMeetingPrepSlice {
  status: string;
  prep_stage: string | null;
  summary: string;
  top_dv_codes: string[];
  close_readiness_score: number | null;
}

export interface LeadCopilotContextResponse {
  lead_id: number;
  generated_at: string;
  applicable: boolean;
  lead_flow_kind: LeadFlowKind;
  sla: Pick<
    LeadSlaCareContextResponse,
    | 'sla_tiers'
    | 'worst_sla_state'
    | 'worst_sla_tier'
    | 'banner'
    | 'nba'
    | 'drafts'
    | 'lost_reason_options'
    | 'sci'
  >;
  funnel: CopilotFunnelSlice | null;
  activities: CopilotActivitySnippet[];
  catalog: { services: CopilotCatalogService[] } | null;
  closed_loop: LeadClosedLoopContextResponse;
  meeting_prep: CopilotMeetingPrepSlice | null;
}

@Injectable()
export class CopilotContextService {
  constructor(
    private readonly slaCare: LeadSlaCareService,
    private readonly closedLoop: ChotClosedLoopService,
    private readonly legacy: CrmLeadsLegacyService,
    private readonly funnel: LeadsFunnelService,
    private readonly catalog: CatalogService,
    private readonly config: AppConfigService,
    private readonly lmpRepo: LeadMeetingPrepRepository,
  ) {}

  async getContext(leadId: number): Promise<LeadCopilotContextResponse> {
    const [sla, loop, activities] = await Promise.all([
      this.slaCare.getCareContext(leadId).catch((err) => {
        if (err instanceof NotFoundException) throw err;
        throw err;
      }),
      this.closedLoop.getLeadContext(leadId),
      this.legacy.listActivities(leadId, 20),
    ]);

    let funnelSlice: CopilotFunnelSlice | null = null;
    try {
      const snap = await this.funnel.getFunnel(leadId);
      funnelSlice = {
        care_pipeline: snap.care_pipeline,
        presales_care_gate: snap.presales_care_gate,
        review_queue: snap.review_queue,
        presales_on_lead_enabled: snap.presales_on_lead_enabled,
      };
    } catch {
      funnelSlice = null;
    }

    let catalogSlice: { services: CopilotCatalogService[] } | null = null;
    if (sla.lead_flow_kind === 'spa_operational') {
      const services = await this.catalog.listServices();
      catalogSlice = {
        services: services
          .filter((s) => s.active)
          .map((s) => ({ slug: s.slug, name: s.name, description: s.description })),
      };
    }

    let meetingPrep: CopilotMeetingPrepSlice | null = null;
    if (this.config.leadMeetingPrepEnabled && (await this.lmpRepo.tableReady())) {
      const row = await this.lmpRepo.getByLeadId(leadId);
      const lmp = extractLmpConsultMergeFields(row);
      if (row) {
        meetingPrep = {
          status: row.status,
          prep_stage: row.prep_stage,
          summary: lmp.external_research_summary,
          top_dv_codes: lmp.recommended_dv_codes.slice(0, 3),
          close_readiness_score: lmp.close_readiness_score,
        };
      }
    }

    return {
      lead_id: leadId,
      generated_at: new Date().toISOString(),
      applicable: sla.applicable,
      lead_flow_kind: sla.lead_flow_kind,
      sla: {
        sla_tiers: sla.sla_tiers,
        worst_sla_state: sla.worst_sla_state,
        worst_sla_tier: sla.worst_sla_tier,
        banner: sla.banner,
        nba: sla.nba,
        drafts: sla.drafts,
        lost_reason_options: sla.lost_reason_options,
        sci: sla.sci,
      },
      funnel: funnelSlice,
      activities: activities.map((a) => ({
        id: a.id,
        activity_type: a.activity_type,
        activity_type_label: a.activity_type_label,
        content: a.content,
        created_at: a.created_at,
        user_name: a.user_name,
      })),
      catalog: catalogSlice,
      closed_loop: loop,
      meeting_prep: meetingPrep,
    };
  }
}

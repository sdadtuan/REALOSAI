import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AgencyRepository } from '../agency/agency.repository';
import { LifecycleTasksRepository } from '../service-lifecycle/lifecycle-tasks.repository';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import {
  buildRenewalDraft,
  computeRenewalHealth,
  windowMatches,
} from './renewal.engine';
import {
  contractRefKey,
  RenewalContractContextRepository,
} from './renewal-contract-context.repository';
import { RenewalOpportunitiesRepository } from './renewal-opportunities.repository';
import {
  RenewalApproveResponse,
  RenewalChannel,
  RenewalDraftResponse,
  RenewalListResponse,
  RenewalOpportunityRecord,
  RenewalOpportunityView,
  RenewalOutcomeResponse,
  RenewalPortfolioSummaryResponse,
  RenewalScanRequest,
  RenewalScanResponse,
  RenewalTriggerWindow,
} from './renewal.types';

const RENEWAL_DRAFT_TYPE = 'renewal_draft';
const DEFAULT_WINDOWS: RenewalTriggerWindow[] = [90, 60, 30];

@Injectable()
export class RenewalAgentService {
  constructor(
    private readonly audit: AiAuditService,
    private readonly contracts: RenewalContractContextRepository,
    private readonly opportunities: RenewalOpportunitiesRepository,
    private readonly recommendations: AiRecommendationsRepository,
    private readonly agencyRepo: AgencyRepository,
    private readonly lifecycleTasks: LifecycleTasksRepository,
  ) {}

  async scanRenewalWindows(input: RenewalScanRequest = {}): Promise<RenewalScanResponse> {
    if (!(await this.opportunities.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'renewal_opportunities_not_ready',
        message: 'Apply RNOS-01 DDL before renewal scan',
      });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const windows = input.windows?.length ? input.windows : DEFAULT_WINDOWS;
    const candidates = this.contracts.listRenewalCandidates(90).filter((c) => windowMatches(c, windows));

    let created = 0;
    let skipped = 0;

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.RENEWAL_SCAN,
        entityType: 'renewal',
        entityId: 'daily',
        actorId: input.actorId ?? 'system',
        correlationId: requestId,
        modelName: 'renewal-agent-v1',
        input: { candidate_count: candidates.length, windows },
      },
      async () => {
        for (const candidate of candidates) {
          const contractRef = contractRefKey(candidate.contract_id, candidate.trigger_window);
          const existing = await this.opportunities.findByContractRef(candidate.agency_client_id, contractRef);
          if (existing && existing.status !== 'deferred') {
            skipped += 1;
            continue;
          }

          const health = computeRenewalHealth(candidate);
          await this.opportunities.insert({
            clientId: candidate.agency_client_id,
            contractRef,
            renewalDate: candidate.ends_on,
            riskLevel: health.risk_level,
            ownerAmId: null,
            metadata: {
              contract_id: candidate.contract_id,
              contract_title: candidate.contract_title,
              trigger_window: candidate.trigger_window,
              days_until_end: candidate.days_until_end,
              amount_vnd: candidate.amount_vnd,
              lifecycle_id: candidate.lifecycle_id,
              health,
            },
          });
          created += 1;
        }

        return {
          data: {
            scanned: candidates.length,
            created,
            skipped,
            agent_run_id: '',
            scanned_at: new Date().toISOString(),
          },
          output: { created, skipped, scanned: candidates.length },
        };
      },
    );

    const data = wrapped.data;
    data.agent_run_id = wrapped.runId;
    return { data, meta: { request_id: requestId }, errors: [] };
  }

  async getPortfolioSummary(): Promise<RenewalPortfolioSummaryResponse> {
    const requestId = this.audit.newRequestId();
    if (!(await this.opportunities.tableReady())) {
      return {
        data: { t90_count: 0, t60_count: 0, t30_count: 0, drill_href: '/agency?tab=retain' },
        meta: { request_id: requestId },
        errors: [],
      };
    }
    const counts = await this.opportunities.countOpenByTriggerWindow();
    return {
      data: {
        t90_count: counts.t90,
        t60_count: counts.t60,
        t30_count: counts.t30,
        drill_href: '/agency?tab=retain',
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }

  async listForClient(clientId: string, correlationId?: string): Promise<RenewalListResponse> {
    if (!(await this.opportunities.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'renewal_opportunities_not_ready',
        message: 'Apply RNOS-01 DDL before renewal list',
      });
    }

    const requestId = correlationId?.trim() || this.audit.newRequestId();
    const cid = clientId.trim();
    if (!cid) {
      throw new BadRequestException({ error: 'client_id_required' });
    }

    const rows = await this.opportunities.listByClient(cid, 20);
    const client = await this.agencyRepo.fetchClient(cid);
    const clientName = client?.name ?? null;

    const opportunities = rows.map((row) => this.toView(row, clientName));
    return {
      data: { client_id: cid, opportunities, total: opportunities.length },
      meta: { request_id: requestId },
      errors: [],
    };
  }

  async generateDraft(
    opportunityId: string,
    channel: RenewalChannel,
    actorId?: string | null,
    correlationId?: string,
  ): Promise<RenewalDraftResponse> {
    await this.assertRenewalReady();
    const requestId = correlationId?.trim() || this.audit.newRequestId();
    const row = await this.requireOpenOpportunity(opportunityId);
    const meta = row.metadata;
    const candidate = this.candidateFromMetadata(row, meta);

    const client = await this.agencyRepo.fetchClient(row.client_id);
    const draftText = buildRenewalDraft(candidate, channel, client?.name ?? undefined);

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.RENEWAL_DRAFT,
        entityType: 'agency_client',
        entityId: row.client_id,
        actorId: actorId ?? null,
        correlationId: requestId,
        modelName: 'renewal-agent-v1',
        input: { opportunity_id: opportunityId, channel },
      },
      async () => {
        const rec = await this.recommendations.insert({
          entityType: 'agency_client',
          entityId: row.client_id,
          recommendationType: RENEWAL_DRAFT_TYPE,
          text: draftText,
          actionJson: {
            opportunity_id: opportunityId,
            channel,
            contract_id: candidate.contract_id,
            stub_mode: true,
          },
          confidence: 0.82,
          agentRunId: null,
          clientId: row.client_id,
        });

        const nextMeta = {
          ...meta,
          draft_text: draftText,
          draft_channel: channel,
          recommendation_id: rec.id,
          draft_generated_at: new Date().toISOString(),
        };
        await this.opportunities.updateMetadata(opportunityId, nextMeta);

        return {
          data: {
            opportunity_id: opportunityId,
            draft_text: draftText,
            channel,
            recommendation_id: rec.id,
          },
          output: { recommendation_id: rec.id },
        };
      },
    );

    return { data: wrapped.data, meta: { request_id: requestId }, errors: [] };
  }

  async approveDraft(
    opportunityId: string,
    finalText: string | undefined,
    actorId?: string | null,
    actorEmail?: string | null,
    correlationId?: string,
  ): Promise<RenewalApproveResponse> {
    await this.assertRenewalReady();
    const requestId = correlationId?.trim() || this.audit.newRequestId();
    const row = await this.requireOpenOpportunity(opportunityId);
    const meta = row.metadata;
    const draftText = String(finalText?.trim() || meta.draft_text || '').trim();
    if (!draftText) {
      throw new BadRequestException({
        error: 'draft_required',
        message: 'Generate renewal draft before approve',
      });
    }

    const recommendationId = meta.recommendation_id ? String(meta.recommendation_id) : null;
    if (recommendationId) {
      await this.recommendations.updateStatus({
        id: recommendationId,
        status: 'accepted',
        acceptedBy: actorEmail?.trim() || actorId?.trim() || 'am',
        recommendationText: draftText,
      });
    }

    let followUpTaskId: number | null = null;
    const lifecycleId = meta.lifecycle_id != null ? Number(meta.lifecycle_id) : null;
    if (lifecycleId && Number.isFinite(lifecycleId)) {
      const task = this.lifecycleTasks.createCustomTask(
        lifecycleId,
        'retain',
        'Renewal follow-up (AM duyệt)',
        draftText.slice(0, 4000),
      );
      followUpTaskId = task.id;
    }

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.RENEWAL_APPROVE,
        entityType: 'agency_client',
        entityId: row.client_id,
        actorId: actorId ?? actorEmail ?? 'am',
        correlationId: requestId,
        modelName: 'renewal-agent-v1',
        input: { opportunity_id: opportunityId, follow_up_task_id: followUpTaskId },
      },
      async () => {
        await this.opportunities.patchStatus(opportunityId, 'in_progress', {
          approved_draft: draftText,
          approved_by: actorEmail?.trim() || actorId?.trim() || 'am',
          approved_at: new Date().toISOString(),
          follow_up_task_id: followUpTaskId,
        });

        return {
          data: {
            opportunity_id: opportunityId,
            status: 'in_progress' as const,
            follow_up_task_id: followUpTaskId,
            service_delivery_url: lifecycleId ? `/crm/service-delivery/${lifecycleId}` : null,
            note: 'Draft đã duyệt — không auto-send (BR-AI-01). AM gửi thủ công sau khi review.',
          },
          output: { follow_up_task_id: followUpTaskId },
        };
      },
    );

    return { data: wrapped.data, meta: { request_id: requestId }, errors: [] };
  }

  async markOutcome(
    opportunityId: string,
    outcome: 'renewed' | 'lost',
    actorId?: string | null,
    correlationId?: string,
  ): Promise<RenewalOutcomeResponse> {
    await this.assertRenewalReady();
    const requestId = correlationId?.trim() || this.audit.newRequestId();
    const row = await this.opportunities.getById(opportunityId);
    if (!row) {
      throw new NotFoundException({ error: 'renewal_not_found', id: opportunityId });
    }
    if (row.status === 'renewed' || row.status === 'lost') {
      throw new ConflictException({ error: 'already_decided', status: row.status });
    }

    const status = outcome === 'renewed' ? 'renewed' : 'lost';
    await this.opportunities.patchStatus(opportunityId, status, {
      outcome,
      outcome_at: new Date().toISOString(),
      outcome_by: actorId ?? 'am',
    });

    return {
      data: { opportunity_id: opportunityId, status, outcome },
      meta: { request_id: requestId },
      errors: [],
    };
  }

  private async assertRenewalReady(): Promise<void> {
    if (!(await this.opportunities.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'renewal_opportunities_not_ready',
        message: 'Apply RNOS-01 DDL before renewal workflow',
      });
    }
    if (!(await this.recommendations.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_recommendations_not_ready',
        message: 'Apply RNOS-01 DDL before renewal draft',
      });
    }
  }

  private async requireOpenOpportunity(id: string): Promise<RenewalOpportunityRecord> {
    const row = await this.opportunities.getById(id);
    if (!row) {
      throw new NotFoundException({ error: 'renewal_not_found', id });
    }
    if (row.status === 'renewed' || row.status === 'lost') {
      throw new ConflictException({ error: 'renewal_closed', status: row.status });
    }
    return row;
  }

  private candidateFromMetadata(row: RenewalOpportunityRecord, meta: Record<string, unknown>) {
    return {
      contract_id: Number(meta.contract_id ?? 0),
      agency_client_id: row.client_id,
      client_name: String(meta.client_name ?? 'Client'),
      contract_title: String(meta.contract_title ?? ''),
      ends_on: row.renewal_date,
      amount_vnd: Number(meta.amount_vnd ?? 0),
      days_until_end: Number(meta.days_until_end ?? 0),
      trigger_window: Number(meta.trigger_window ?? 90) as RenewalTriggerWindow,
      lifecycle_id: meta.lifecycle_id != null ? Number(meta.lifecycle_id) : null,
    };
  }

  private toView(row: RenewalOpportunityRecord, clientName: string | null): RenewalOpportunityView {
    const meta = row.metadata;
    const healthRaw = meta.health as RenewalOpportunityView['health'] | undefined;
    const lifecycleId = meta.lifecycle_id != null ? Number(meta.lifecycle_id) : null;
    return {
      id: row.id,
      client_id: row.client_id,
      contract_id: Number(meta.contract_id ?? 0),
      contract_title: String(meta.contract_title ?? ''),
      amount_vnd: Number(meta.amount_vnd ?? 0),
      renewal_date: row.renewal_date,
      days_until_end: Number(meta.days_until_end ?? 0),
      trigger_window: Number(meta.trigger_window ?? 90) as RenewalTriggerWindow,
      risk_level: row.risk_level,
      status: row.status,
      health:
        healthRaw ??
        computeRenewalHealth({
          contract_id: Number(meta.contract_id ?? 0),
          agency_client_id: row.client_id,
          client_name: clientName ?? String(meta.contract_title ?? ''),
          contract_title: String(meta.contract_title ?? ''),
          ends_on: row.renewal_date,
          amount_vnd: Number(meta.amount_vnd ?? 0),
          days_until_end: Number(meta.days_until_end ?? 0),
          trigger_window: Number(meta.trigger_window ?? 90) as RenewalTriggerWindow,
          lifecycle_id: lifecycleId,
        }),
      draft_text: meta.draft_text != null ? String(meta.draft_text) : null,
      draft_channel: (meta.draft_channel as RenewalChannel | null) ?? null,
      recommendation_id: meta.recommendation_id != null ? String(meta.recommendation_id) : null,
      lifecycle_id: lifecycleId,
      service_delivery_url: lifecycleId ? `/crm/service-delivery/${lifecycleId}` : null,
      follow_up_task_id: meta.follow_up_task_id != null ? Number(meta.follow_up_task_id) : null,
      outcome: meta.outcome != null ? String(meta.outcome) : null,
      owner_am_id: row.owner_am_id,
      updated_at: row.updated_at,
    };
  }
}

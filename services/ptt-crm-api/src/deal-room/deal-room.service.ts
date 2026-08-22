import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { LeadsRepository } from '../leads/leads.repository';
import { planContentFromRow } from '../leads-funnel/presales-marketing-plan.util';
import { LeadsFunnelService } from '../leads-funnel/leads-funnel.service';
import { CrmLeadsLegacyService } from '../crm-leads-legacy/crm-leads-legacy.service';
import { CrmLeadsSqliteRepository } from '../crm-leads-legacy/crm-leads-sqlite.repository';
import { AppConfigService } from '../config/app-config.service';
import { OpsProfilePgRepository } from '../ops/ops-profile-pg.repository';
import { OpsRouteMapLoader } from '../ops/ops-route-map.loader';
import { resolveDvByLifecycleSlug } from '../ops/ops-slug-resolver.util';
import { ProposalsSqliteRepository } from '../proposals/proposals-sqlite.repository';
import {
  buildDealRoomTierSummaries,
  loadDealRoomServiceDvMap,
  resolveServiceDvMapping,
} from '../proposals/deal-room-quote.util';
import {
  QUOTE_PACKAGE_TIERS,
  QUOTE_TIER_VI,
  resolveTierPricing,
  type QuotePackageTier,
} from '../proposals/quote-pricing.util';
import { buildDealRoomGates } from './deal-room-gates.util';
import { buildL1GateChecklist } from '../leads-funnel/presales-l1-gate-checklist.util';
import type { ExportDealRoomPackBody } from './deal-room-export.types';
import {
  buildDealRoomPackPdf,
  dealPackExportFilename,
  type DealRoomPackQuoteLine,
  type DealRoomPackTierQuote,
} from './deal-room-pack.util';
import type { DealRoomSnapshot } from './deal-room.types';
import { catalogTs } from '../catalog/catalog-slug.util';
import { DealRoomTeaserRepository } from './deal-room-teaser.repository';
import { LeadMeetingPrepRepository } from '../lead-meeting-prep/lead-meeting-prep.repository';
import { buildLmpDealRoomSciSlice } from '../lead-meeting-prep/lmp-sci-slice.util';
import { buildSciRedFlagBlockInfo } from '../lead-meeting-prep/lmp-red-flag-block.util';
import type {
  DealRoomTeaserCreateResponse,
  DealRoomTeaserPublicView,
  DealRoomTeaserRevokeResponse,
} from './deal-room-teaser.types';
import {
  buildDealTeaserUrl,
  buildTeaserMailtoHref,
  buildTeaserStrategyBlocks,
  generateDealTeaserToken,
  hashDealTeaserToken,
  teaserExpiresAt,
} from './deal-room-teaser.util';

@Injectable()
export class DealRoomService {
  constructor(
    private readonly funnel: LeadsFunnelService,
    private readonly leads: LeadsRepository,
    private readonly leadSqlite: CrmLeadsSqliteRepository,
    private readonly legacy: CrmLeadsLegacyService,
    private readonly proposals: ProposalsSqliteRepository,
    private readonly routeMap: OpsRouteMapLoader,
    private readonly opsProfiles: OpsProfilePgRepository,
    private readonly config: AppConfigService,
    private readonly teaserRepo: DealRoomTeaserRepository,
    private readonly lmpRepo: LeadMeetingPrepRepository,
  ) {}

  async getSnapshot(leadId: number): Promise<DealRoomSnapshot> {
    const lead = await this.leads.getLeadById(leadId);
    if (!lead) {
      throw new NotFoundException({ error: 'Lead not found' });
    }

    const funnel = await this.funnel.getFunnel(leadId);
    if (!funnel.presales) {
      throw new BadRequestException({
        error: 'presales_required',
        message: 'Bắt đầu Pre-sales trước khi mở Deal Room.',
      });
    }

    const flowKind = String(funnel.lead_flow_kind ?? '').trim();
    if (flowKind !== 'b2b_prospect' && flowKind !== 'b2b') {
      throw new BadRequestException({
        error: 'deal_room_b2b_only',
        message: 'Deal Room chỉ khả dụng cho lead B2B prospect.',
      });
    }

    const gateResp = await this.funnel.getPresalesProposalGate(leadId);
    const proposalGate = gateResp.gate;
    const handoffResp = await this.funnel.getPresalesProposalHandoff(leadId);
    const handoff = handoffResp.handoff;
    const planResp = await this.funnel.getMarketingPlan(leadId);
    const planRow = planResp.plan as Record<string, unknown>;
    const planContent = planContentFromRow(planRow);

    const consultDone = proposalGate.consult_task_done_count;
    const consultTotal = proposalGate.consult_task_total;
    const presalesStage = funnel.presales.presales.stage;

    const gates = buildDealRoomGates({
      careGateComplete: Boolean(funnel.presales_care_gate?.complete),
      consultDone,
      consultTotal,
      proposalGate,
      presalesStage,
    });

    const ownerId = lead.owner_id;
    let ownerName: string | null = null;
    if (ownerId) {
      ownerName = this.leadSqlite.staffNamesByIds([ownerId]).get(ownerId) ?? null;
    }

    let sciSlice = buildLmpDealRoomSciSlice(null, leadId);
    if (this.config.leadMeetingPrepEnabled) {
      try {
        if (await this.lmpRepo.tableReady()) {
          const prepRow = await this.lmpRepo.getByLeadId(leadId);
          sciSlice = buildLmpDealRoomSciSlice(prepRow, leadId);
        }
      } catch {
        /* SCI slice optional */
      }
    }

    const canCreateQuote = proposalGate.ok && handoff.can_open;
    const sciRedFlagBlock = buildSciRedFlagBlockInfo(
      sciSlice.available ? ({ red_flags: sciSlice.red_flags } as Record<string, unknown>) : null,
    );
    let quoteBlockReason = !canCreateQuote
      ? handoff.block_reason ||
        proposalGate.messages[0] ||
        'Hoàn thành G4 R5 trước khi tạo báo giá'
      : '';
    if (canCreateQuote && sciRedFlagBlock.active) {
      quoteBlockReason = sciRedFlagBlock.reason;
    }

    const l1Checklist = buildL1GateChecklist({
      gate: proposalGate,
      plan: {
        name: planContent.name,
        north_star: planContent.north_star,
        objectives: planContent.objectives,
        strategy_framework: planContent.strategy_framework,
      },
    });

    const serviceSlug = String(funnel.presales.presales.service_slug ?? '').trim();
    const presalesId = funnel.presales.presales.id;
    const customerId = handoff.customer_id;
    const leadProposals = this.proposals.listByLeadId(leadId);
    const activeProposal =
      leadProposals.find((p) => p.status === 'draft') ?? leadProposals[0] ?? null;
    const quoteTiers = await this.buildSnapshotQuoteTiers(
      serviceSlug,
      activeProposal?.id ?? null,
    );
    const teaserState = await this.loadTeaserState(leadId);
    const canShareTeaser =
      this.config.dealRoomPortalTeaser && proposalGate.ok && (await this.teaserRepo.tablesReady());

    return {
      ok: true,
      lead_id: leadId,
      lead_name: lead.full_name,
      lead_flow_kind: flowKind,
      owner_id: ownerId,
      owner_name: ownerName,
      presales: funnel.presales,
      gates,
      marketing_plan: {
        name: planContent.name,
        north_star: planContent.north_star,
        objectives: planContent.objectives,
        strategy_framework: planContent.strategy_framework,
        validation_ok: Boolean(planResp.validation?.ok),
        validation_messages: planResp.validation?.messages ?? [],
      },
      consult_progress: { done: consultDone, total: consultTotal },
      quote: {
        proposal_id: activeProposal?.id ?? null,
        status: activeProposal?.status ?? null,
        total_vnd: activeProposal?.total_vnd ?? null,
        customer_id: customerId,
        presales_id: presalesId,
        service_slug: serviceSlug,
        tiers: quoteTiers,
        can_create: canCreateQuote,
        block_reason: quoteBlockReason,
        sci_red_flag_block: sciRedFlagBlock,
      },
      actions: {
        can_export_pack: proposalGate.ok && this.config.dealRoomPackPdf,
        can_share_teaser: canShareTeaser,
        proposals_href: handoff.proposals_href,
        teaser: teaserState,
      },
      proposal_gate: proposalGate,
      l1_checklist: l1Checklist,
      sci: sciSlice,
    };
  }

  async exportPack(
    leadId: number,
    body: ExportDealRoomPackBody,
    actor: string,
    userId: number | null,
  ): Promise<StreamableFile> {
    if (!this.config.dealRoomPackPdf) {
      throw new ForbiddenException({
        error: 'deal_room_pack_disabled',
        message: 'Bật PTT_DEAL_ROOM_PACK_PDF=1 để export Plan+Quote Pack.',
      });
    }

    const gateResp = await this.funnel.getPresalesProposalGate(leadId);
    if (!gateResp.gate.ok) {
      throw new BadRequestException({
        error: 'g4_blocked',
        messages: gateResp.gate.messages,
        message: gateResp.gate.messages[0] ?? 'Hoàn thành G4 R5 trước khi export Pack PDF.',
      });
    }

    const snapshot = await this.getSnapshot(leadId);
    const handoffResp = await this.funnel.getPresalesProposalHandoff(leadId);
    const customerId = handoffResp.handoff.customer_id;
    const serviceSlug = String(snapshot.presales.presales.service_slug ?? '').trim();
    const exportDate = catalogTs().slice(0, 10);

    const proposalId = this.resolveProposalId(customerId, body.proposal_id ?? null);
    const quoteTiers = await this.buildQuoteTiers(serviceSlug, proposalId);
    const showAiDisclaimer = this.detectAiDraft(snapshot);

    const solutionName = snapshot.presales.handoff?.solution_owner_name?.trim() || null;

    const pdf = buildDealRoomPackPdf({
      lead_id: leadId,
      lead_name: snapshot.lead_name,
      service_slug: serviceSlug,
      export_date: exportDate,
      owner_name: snapshot.owner_name,
      solution_name: solutionName,
      marketing_plan: snapshot.marketing_plan,
      quote_tiers: quoteTiers,
      proposal_id: proposalId,
      include_timeline: body.include_timeline !== false,
      show_ai_disclaimer: showAiDisclaimer,
    });

    await this.legacy.createActivity(
      leadId,
      {
        activity_type: 'deal_room_pack_exported',
        content: `Export Plan+Quote Pack PDF${proposalId ? ` · proposal #${proposalId}` : ''}`,
        result: 'ok',
      },
      actor,
      userId,
    );

    const filename = dealPackExportFilename(leadId, exportDate);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  async createTeaser(
    leadId: number,
    actor: string,
    userId: number | null,
  ): Promise<DealRoomTeaserCreateResponse> {
    if (!this.config.dealRoomPortalTeaser) {
      throw new ForbiddenException({
        error: 'deal_room_teaser_disabled',
        message: 'Bật PTT_DEAL_ROOM_PORTAL_TEASER=1 để chia sẻ link Portal.',
      });
    }
    if (!(await this.teaserRepo.tablesReady())) {
      throw new ServiceUnavailableException({
        error: 'deal_room_teaser_not_ready',
        message: 'Chạy scripts/apply_pg_ddl_deal_room_s0.sh trên PostgreSQL.',
      });
    }

    const gateResp = await this.funnel.getPresalesProposalGate(leadId);
    if (!gateResp.gate.ok) {
      throw new BadRequestException({
        error: 'g4_blocked',
        messages: gateResp.gate.messages,
        message:
          gateResp.gate.messages[0] ?? 'Hoàn thành G4 R5 trước khi chia sẻ teaser Portal.',
      });
    }

    await this.teaserRepo.revokeActiveForLead(leadId);
    const rawToken = generateDealTeaserToken();
    const expiresAt = teaserExpiresAt(this.config.dealRoomTeaserTtlDays);
    const row = await this.teaserRepo.insertToken({
      leadId,
      tokenHash: hashDealTeaserToken(rawToken),
      expiresAt,
      createdBy: userId,
    });
    const url = buildDealTeaserUrl(this.config.portalPublicUrl, rawToken);

    await this.legacy.createActivity(
      leadId,
      {
        activity_type: 'deal_room_teaser_created',
        content: `Tạo Portal teaser · hết hạn ${expiresAt.toISOString().slice(0, 10)}`,
        result: 'ok',
      },
      actor,
      userId,
    );

    return {
      ok: true,
      lead_id: leadId,
      url,
      expires_at: row.expires_at,
      token_id: row.id,
    };
  }

  async revokeTeaser(leadId: number, actor: string, userId: number | null): Promise<DealRoomTeaserRevokeResponse> {
    if (!this.config.dealRoomPortalTeaser) {
      throw new ForbiddenException({
        error: 'deal_room_teaser_disabled',
        message: 'Bật PTT_DEAL_ROOM_PORTAL_TEASER=1 để quản lý link Portal.',
      });
    }
    if (!(await this.teaserRepo.tablesReady())) {
      throw new ServiceUnavailableException({ error: 'deal_room_teaser_not_ready' });
    }

    const revoked = await this.teaserRepo.revokeByLeadId(leadId);
    if (revoked) {
      await this.legacy.createActivity(
        leadId,
        {
          activity_type: 'deal_room_teaser_revoked',
          content: 'Thu hồi link Portal teaser',
          result: 'ok',
        },
        actor,
        userId,
      );
    }

    return { ok: true, lead_id: leadId, revoked };
  }

  async getPublicTeaser(rawToken: string): Promise<DealRoomTeaserPublicView> {
    if (!this.config.dealRoomPortalTeaser) {
      throw new NotFoundException({ error: 'deal_teaser_disabled' });
    }
    if (!(await this.teaserRepo.tablesReady())) {
      throw new ServiceUnavailableException({ error: 'deal_room_teaser_not_ready' });
    }

    const token = String(rawToken ?? '').trim();
    if (!token) {
      throw new NotFoundException({ error: 'invalid_token' });
    }

    const row = await this.teaserRepo.findByTokenHash(hashDealTeaserToken(token));
    if (!row) {
      throw new NotFoundException({ error: 'invalid_token' });
    }
    if (row.revoked_at) {
      throw new GoneException({ error: 'teaser_revoked', message: 'Link đã được thu hồi.' });
    }
    const expiresMs = Date.parse(row.expires_at);
    if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
      throw new GoneException({ error: 'teaser_expired', message: 'Link đã hết hạn.' });
    }

    const leadId = row.lead_id;
    const lead = await this.leads.getLeadById(leadId);
    if (!lead) {
      throw new NotFoundException({ error: 'lead_not_found' });
    }

    const funnel = await this.funnel.getFunnel(leadId);
    if (!funnel.presales) {
      throw new NotFoundException({ error: 'presales_required' });
    }

    const planResp = await this.funnel.getMarketingPlan(leadId);
    const planContent = planContentFromRow(planResp.plan as Record<string, unknown>);
    const serviceSlug = String(funnel.presales.presales.service_slug ?? '').trim();
    const ownerId = lead.owner_id;
    let ownerName: string | null = null;
    if (ownerId) {
      ownerName = this.leadSqlite.staffNamesByIds([ownerId]).get(ownerId) ?? null;
    }

    const projectName = planContent.name || lead.full_name || `Lead #${leadId}`;
    const strategyBlocks = buildTeaserStrategyBlocks(planContent.strategy_framework);

    return {
      ok: true,
      project_name: projectName,
      client_name: String(lead.full_name ?? '').trim() || projectName,
      service_slug: serviceSlug,
      north_star: planContent.north_star,
      strategy_blocks: strategyBlocks,
      account_manager_name: ownerName,
      contact_cta: {
        mailto_href: buildTeaserMailtoHref(projectName, ownerName),
        label: ownerName ? `Liên hệ ${ownerName}` : 'Liên hệ AM',
      },
      expires_at: row.expires_at,
    };
  }

  private async loadTeaserState(leadId: number) {
    if (!this.config.dealRoomPortalTeaser || !(await this.teaserRepo.tablesReady())) {
      return { active: false, url: null, expires_at: null };
    }
    const row = await this.teaserRepo.findActiveByLeadId(leadId);
    if (!row) {
      return { active: false, url: null, expires_at: null };
    }
    return {
      active: true,
      url: null,
      expires_at: row.expires_at,
    };
  }

  private async buildSnapshotQuoteTiers(serviceSlug: string, proposalId: number | null) {
    const map = this.routeMap.getMap();
    const dvMap = loadDealRoomServiceDvMap();
    const mapping = resolveServiceDvMapping(serviceSlug, map, dvMap);
    let tierPricing: Record<string, unknown> = {};
    if (this.opsProfiles.canUsePg()) {
      try {
        const profile = await this.opsProfiles.getByDvCode(mapping.primary_dv);
        tierPricing = (profile?.tier_pricing ?? {}) as Record<string, unknown>;
      } catch {
        tierPricing = {};
      }
    }
    const proposalLines = proposalId ? this.proposals.listLines(proposalId) : [];
    return buildDealRoomTierSummaries(mapping, tierPricing, proposalLines);
  }

  private resolveProposalId(customerId: number | null, requestedId: number | null): number | null {
    if (requestedId != null && requestedId > 0) {
      const proposal = this.proposals.getById(requestedId);
      if (!proposal) {
        throw new NotFoundException({ error: 'proposal_not_found', proposal_id: requestedId });
      }
      if (customerId != null && customerId > 0 && proposal.customer_id !== customerId) {
        throw new BadRequestException({
          error: 'proposal_customer_mismatch',
          message: 'Proposal không thuộc khách hàng của lead này.',
        });
      }
      return requestedId;
    }
    if (customerId == null || customerId <= 0) return null;
    const rows = this.proposals.listByCustomer(customerId);
    const draft = rows.find((p) => p.status === 'draft') ?? rows[0];
    return draft?.id ?? null;
  }

  private async buildQuoteTiers(
    serviceSlug: string,
    proposalId: number | null,
  ): Promise<DealRoomPackTierQuote[]> {
    const map = this.routeMap.getMap();
    const dvEntry = resolveDvByLifecycleSlug(serviceSlug, map);
    const dvCode = dvEntry?.code ?? 'DV04';
    const dvName = dvEntry?.name_vi ?? dvCode;

    let tierPricing: Record<string, unknown> = {};
    if (this.opsProfiles.canUsePg()) {
      const profile = await this.opsProfiles.getByDvCode(dvCode);
      if (profile?.tier_pricing) tierPricing = profile.tier_pricing;
    }

    const proposalLines = proposalId ? this.proposals.listLines(proposalId) : [];
    const linesByTier = new Map<string, DealRoomPackQuoteLine[]>();
    for (const line of proposalLines) {
      const tier = String(line.package_tier ?? 'standard').toLowerCase();
      const entry = map.services.find((s) => s.code === line.dv_code);
      const bucket = linesByTier.get(tier) ?? [];
      bucket.push({
        dv_code: line.dv_code,
        dv_name: entry?.name_vi ?? line.dv_code,
        package_tier: line.package_tier,
        final_price_vnd: line.final_price_vnd,
        scope_notes: line.scope_notes,
      });
      linesByTier.set(tier, bucket);
    }

    return QUOTE_PACKAGE_TIERS.map((tier: QuotePackageTier) => {
      const tierLines = linesByTier.get(tier) ?? [];
      if (tierLines.length) {
        const total = tierLines.reduce((sum, l) => sum + Number(l.final_price_vnd || 0), 0);
        return {
          tier,
          tier_label: QUOTE_TIER_VI[tier],
          lines: tierLines,
          total_vnd: total,
        };
      }
      const ref = resolveTierPricing(tierPricing, tier);
      return {
        tier,
        tier_label: QUOTE_TIER_VI[tier],
        lines: [
          {
            dv_code: dvCode,
            dv_name: dvName,
            package_tier: tier,
            final_price_vnd: ref.suggested_vnd,
          },
        ],
        total_vnd: ref.suggested_vnd,
        is_reference: true,
      };
    });
  }

  private detectAiDraft(snapshot: DealRoomSnapshot): boolean {
    const consultTasks = snapshot.presales.tasks?.consult ?? [];
    return consultTasks.some((t) => String(t.ai_output ?? '').trim().length > 0);
  }
}

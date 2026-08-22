import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { AiAdoptionAnalyticsService } from '../ai-intelligence/ai-adoption-analytics.service';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import { LeadsFunnelService } from '../leads-funnel/leads-funnel.service';
import { CrmLeadsLegacyService } from '../crm-leads-legacy/crm-leads-legacy.service';
import { CrmLeadsPgRepository } from '../crm-leads-legacy/crm-leads-pg.repository';
import {
  computeSpaMeta24hSlas,
  enrichSlaTierSummaries,
  isSpaClosedStatus,
  parseB2CompletedAt,
  summarizeSlaTiers,
  tierSlaMatchesFilter,
  type CskhSlaTier,
} from './cskh-board-sla.util';
import { buildCskhBoardXlsx } from './cskh-board-export.util';
import { CskhBoardRepository } from './cskh-board.repository';
import {
  CskhBoardQuery,
  CskhBoardResponse,
  CskhBoardRow,
  CskhBulkAssignBody,
  CskhBulkRescheduleBody,
  CskhManagerIntelligenceResponse,
} from './cskh-board.types';
import {
  buildSlaDailyDigest,
  buildTopBreachSnapshots,
  buildTriageSuggestions,
  computeRepPerformance,
  countRootCauses,
} from './cskh-manager-intelligence.util';
import { ChotClosedLoopService } from '../leads/chot-closed-loop.service';
import { buildBreachBacklogSnapshot } from './cskh-breach-backlog.util';
import { buildShiftHandoffReport } from './cskh-shift-handoff.util';
import { buildHomeSummary } from './home-summary.util';
import {
  filterPredictionsByOwner,
  predictSlaRiskForRows,
  type SlaPredictRow,
} from './sla-predict.util';

@Injectable()
export class CskhBoardService {
  constructor(
    private readonly repo: CskhBoardRepository,
    private readonly legacyPg: CrmLeadsPgRepository,
    private readonly legacy: CrmLeadsLegacyService,
    private readonly closedLoop: ChotClosedLoopService,
    @Inject(forwardRef(() => LeadsFunnelService))
    private readonly leadsFunnel: LeadsFunnelService,
    private readonly aiConfig: AiIntelligenceConfigService,
    @Inject(forwardRef(() => AiAdoptionAnalyticsService))
    private readonly adoptionAnalytics: AiAdoptionAnalyticsService,
  ) {}

  async getBoard(query: CskhBoardQuery): Promise<CskhBoardResponse> {
    const limit = Math.max(1, Math.min(Number(query.limit ?? 50), 200));
    const offset = Math.max(0, Number(query.offset ?? 0));
    const slaFilter = query.sla_filter ?? 'all';
    const selectedTier: CskhSlaTier | 'all' =
      query.sla_tier === 'first_call_15m' ||
      query.sla_tier === 'b2_complete_4h' ||
      query.sla_tier === 'close_24h'
        ? query.sla_tier
        : 'all';

    const { leads } = await this.repo.listLeadCandidates({
      ...query,
      sla_tier: selectedTier,
      spa_meta_only: query.spa_meta_only !== false,
      limit,
    });
    const ids = leads.map((r) => Number(r.sqlite_lead_id));
    const firstCalls = await this.legacyPg.firstCallAtByLeadIds(ids);
    const followUps = await this.legacyPg.nextFollowUpByLeadIds(ids);
    const ownerIds = leads.map((r) => Number(r.owner_id ?? 0)).filter((id) => id > 0);
    const ownerNames = await this.legacyPg.staffNamesByIds(ownerIds);

    const enriched: CskhBoardRow[] = leads.map((row) => {
      const base = CskhBoardRepository.toBoardRowBase(
        row as Parameters<typeof CskhBoardRepository.toBoardRowBase>[0],
      );
      const firstCallAt = firstCalls.get(base.id) ?? null;
      const b2CompletedAt = parseB2CompletedAt(base.care_stages_done_json);
      const closedAt = isSpaClosedStatus(base.status) ? base.updated_at : null;
      const sla = computeSpaMeta24hSlas({
        status: base.status,
        receivedAt: base.received_at,
        createdAt: base.created_at,
        firstCallAt,
        careStagesDoneJson: base.care_stages_done_json,
        b2CompletedAt,
        closedAt,
      });

      return {
        id: base.id,
        full_name: base.full_name,
        phone: base.phone,
        email: base.email,
        status: base.status,
        source: base.source,
        channel: base.channel,
        owner_id: base.owner_id,
        received_at: base.received_at,
        created_at: base.created_at,
        owner_name: base.owner_id ? ownerNames.get(base.owner_id) ?? null : null,
        first_call_at: firstCallAt,
        b2_completed_at: b2CompletedAt,
        closed_at: closedAt,
        sla_state: sla.sla_state,
        sla_tier: sla.sla_tier,
        sla_tiers: sla.tiers,
        sla_minutes_elapsed: sla.sla_minutes_elapsed,
        sla_deadline_at: sla.sla_deadline_at,
        next_follow_up_at: followUps.get(base.id) ?? null,
      };
    });

    const filtered = enriched.filter((row) => {
      const tierSnapshot =
        selectedTier === 'all'
          ? row.sla_tiers.find((t) => t.tier === row.sla_tier) ?? row.sla_tiers[0]
          : row.sla_tiers.find((t) => t.tier === selectedTier);
      return tierSlaMatchesFilter(tierSnapshot, slaFilter);
    });

    const dashboardTiers = enrichSlaTierSummaries(
      summarizeSlaTiers(enriched.map((row) => row.sla_tiers)),
    );
    const summary = {
      total: filtered.length,
      breach: filtered.filter((r) => {
        const tier = this.resolveTierSnapshot(r, selectedTier);
        return tier?.sla_state === 'breach';
      }).length,
      warning: filtered.filter((r) => {
        const tier = this.resolveTierSnapshot(r, selectedTier);
        return tier?.sla_state === 'warning';
      }).length,
      ok: filtered.filter((r) => {
        const tier = this.resolveTierSnapshot(r, selectedTier);
        return tier?.sla_state === 'ok';
      }).length,
    };
    const page = filtered.slice(offset, offset + limit);

    return {
      ok: true,
      items: page,
      total: filtered.length,
      limit,
      offset,
      summary,
      sla_dashboard: {
        tiers: dashboardTiers,
        selected_tier: selectedTier,
      },
    };
  }

  private resolveTierSnapshot(row: CskhBoardRow, selectedTier: CskhSlaTier | 'all') {
    if (selectedTier === 'all') {
      return row.sla_tiers.find((t) => t.tier === row.sla_tier) ?? row.sla_tiers[0];
    }
    return row.sla_tiers.find((t) => t.tier === selectedTier);
  }

  async exportCsv(query: CskhBoardQuery): Promise<string> {
    const board = await this.getBoard({ ...query, limit: 500, offset: 0 });
    const header = [
      'id',
      'full_name',
      'phone',
      'status',
      'source',
      'channel',
      'owner_id',
      'owner_name',
      'received_at',
      'first_call_at',
      'b2_completed_at',
      'closed_at',
      'sla_tier',
      'sla_state',
      'sla_15m',
      'sla_4h',
      'sla_24h',
      'sla_minutes_elapsed',
      'next_follow_up_at',
    ];
    const lines = [header.join(',')];
    for (const row of board.items) {
      const tierState = (tier: CskhSlaTier) =>
        row.sla_tiers.find((t) => t.tier === tier)?.sla_state ?? 'na';
      lines.push(
        [
          row.id,
          csvCell(row.full_name),
          csvCell(row.phone),
          csvCell(row.status),
          csvCell(row.source),
          csvCell(row.channel),
          row.owner_id ?? '',
          csvCell(row.owner_name ?? ''),
          csvCell(row.received_at),
          csvCell(row.first_call_at ?? ''),
          csvCell(row.b2_completed_at ?? ''),
          csvCell(row.closed_at ?? ''),
          row.sla_tier ?? '',
          row.sla_state,
          tierState('first_call_15m'),
          tierState('b2_complete_4h'),
          tierState('close_24h'),
          row.sla_minutes_elapsed ?? '',
          csvCell(row.next_follow_up_at ?? ''),
        ].join(','),
      );
    }
    return lines.join('\n');
  }

  async exportXlsx(query: CskhBoardQuery): Promise<{ buffer: Buffer; filename: string }> {
    const board = await this.getBoard({ ...query, limit: 500, offset: 0 });
    return buildCskhBoardXlsx(board.items);
  }

  async getManagerIntelligence(teamAcceptancePct?: number | null): Promise<CskhManagerIntelligenceResponse> {
    const board = await this.getBoard({
      sla_filter: 'all',
      sla_tier: 'all',
      limit: 500,
      offset: 0,
      spa_meta_only: true,
    });

    const allRows = await this.loadAllEnrichedRows();
    const repPerformance = computeRepPerformance(allRows);
    const triage = buildTriageSuggestions(allRows, repPerformance);
    const topBreaches = buildTopBreachSnapshots(allRows, 5);
    const rootCauseCounts = countRootCauses(allRows);
    const slaDailyDigest = buildSlaDailyDigest({
      rows: allRows,
      tierSummary: board.sla_dashboard.tiers,
      teamAcceptancePct: teamAcceptancePct ?? null,
    });

    return {
      ok: true,
      generated_at: new Date().toISOString(),
      rep_performance: repPerformance,
      triage_suggestions: triage,
      top_breaches: topBreaches,
      root_cause_counts: rootCauseCounts,
      team_ai_acceptance_pct: teamAcceptancePct ?? null,
      sla_daily_digest: slaDailyDigest,
    };
  }

  async getSlaDailyDigest(teamAcceptancePct?: number | null) {
    const intel = await this.getManagerIntelligence(teamAcceptancePct);
    return intel.sla_daily_digest;
  }

  /** GDKD enterprise KPI — SLA tier counts across spa Meta board cohort. */
  async getSlaDashboardTiers() {
    const rows = await this.loadAllEnrichedRows();
    return enrichSlaTierSummaries(summarizeSlaTiers(rows.map((row) => row.sla_tiers)));
  }

  async getBreachBacklogSnapshot() {
    const rows = await this.loadAllEnrichedRows();
    return buildBreachBacklogSnapshot(rows);
  }

  /** E3 — shift handoff markdown for GDKD cuối ca. */
  async getShiftHandoff() {
    const [rows, reviewMetrics] = await Promise.all([
      this.loadAllEnrichedRows(),
      this.leadsFunnel.reviewQueueMetrics(),
    ]);
    return buildShiftHandoffReport({ rows, reviewMetrics });
  }

  async getHomeSummary() {
    const [rows, leadsNewToday, reviewMetrics] = await Promise.all([
      this.loadAllEnrichedRows(),
      this.repo.countSpaMetaLeadsReceivedToday(),
      this.leadsFunnel.reviewQueueMetrics(),
    ]);

    const tierSummaries = enrichSlaTierSummaries(
      summarizeSlaTiers(rows.map((row) => row.sla_tiers)),
    );

    let ai: ReturnType<typeof buildHomeSummary>['ai'];
    if (this.aiConfig.copilotEnabled) {
      try {
        const adoption = await this.adoptionAnalytics.getAdoptionMetrics({ days: 7 });
        ai = {
          copilot_dau_pct: adoption.data.copilot_dau_rate_pct,
          pilot_denominator: adoption.data.pilot_denominator,
          copilot_dau_latest: adoption.data.copilot_dau_latest,
          drill_href: '/crm/ai/insights',
        };
      } catch {
        ai = undefined;
      }
    }

    return buildHomeSummary({
      boardRows: rows,
      tierSummaries,
      leadsNewToday,
      reviewMetrics: {
        queue_count: reviewMetrics.queue_count,
        max_hours: reviewMetrics.max_hours,
      },
      ai,
    });
  }

  /** E2 — predictive SLA rows for board + alerts. */
  async getSlaPredictions(opts?: { ownerId?: number; viewAll?: boolean }): Promise<{
    ok: true;
    generated_at: string;
    items: SlaPredictRow[];
    total: number;
  }> {
    const rows = await this.loadAllEnrichedRows();
    let items = predictSlaRiskForRows(rows);
    if (!opts?.viewAll && opts?.ownerId != null && Number.isFinite(opts.ownerId)) {
      items = filterPredictionsByOwner(items, opts.ownerId);
    }
    return {
      ok: true,
      generated_at: new Date().toISOString(),
      items,
      total: items.length,
    };
  }

  async getClosedLoopDashboard(windowDays?: number, sampleLimit?: number) {
    return this.closedLoop.getClosedLoopDashboard(windowDays ?? 30, sampleLimit ?? 20);
  }

  async getPlaybookAbMetrics(windowDays?: number) {
    return this.closedLoop.getPlaybookAbMetrics(windowDays ?? 30);
  }

  private async loadAllEnrichedRows(): Promise<CskhBoardRow[]> {
    const { leads } = await this.repo.listLeadCandidates({
      sla_filter: 'all',
      sla_tier: 'all',
      spa_meta_only: true,
      limit: 500,
    });
    const ids = leads.map((r) => Number(r.sqlite_lead_id));
    const firstCalls = await this.legacyPg.firstCallAtByLeadIds(ids);
    const followUps = await this.legacyPg.nextFollowUpByLeadIds(ids);
    const ownerIds = leads.map((r) => Number(r.owner_id ?? 0)).filter((id) => id > 0);
    const ownerNames = await this.legacyPg.staffNamesByIds(ownerIds);

    return leads.map((row) => {
      const base = CskhBoardRepository.toBoardRowBase(
        row as Parameters<typeof CskhBoardRepository.toBoardRowBase>[0],
      );
      const firstCallAt = firstCalls.get(base.id) ?? null;
      const b2CompletedAt = parseB2CompletedAt(base.care_stages_done_json);
      const closedAt = isSpaClosedStatus(base.status) ? base.updated_at : null;
      const sla = computeSpaMeta24hSlas({
        status: base.status,
        receivedAt: base.received_at,
        createdAt: base.created_at,
        firstCallAt,
        careStagesDoneJson: base.care_stages_done_json,
        b2CompletedAt,
        closedAt,
      });

      return {
        id: base.id,
        full_name: base.full_name,
        phone: base.phone,
        email: base.email,
        status: base.status,
        source: base.source,
        channel: base.channel,
        owner_id: base.owner_id,
        received_at: base.received_at,
        created_at: base.created_at,
        owner_name: base.owner_id ? ownerNames.get(base.owner_id) ?? null : null,
        first_call_at: firstCallAt,
        b2_completed_at: b2CompletedAt,
        closed_at: closedAt,
        sla_state: sla.sla_state,
        sla_tier: sla.sla_tier,
        sla_tiers: sla.tiers,
        sla_minutes_elapsed: sla.sla_minutes_elapsed,
        sla_deadline_at: sla.sla_deadline_at,
        next_follow_up_at: followUps.get(base.id) ?? null,
      };
    });
  }

  async bulkAssign(body: CskhBulkAssignBody, actor: string) {
    const leadIds = [...new Set((body.lead_ids ?? []).map((id) => Number(id)).filter((id) => id > 0))];
    const toUserId = Number(body.to_user_id);
    const reason = String(body.reason ?? '').trim();
    if (!leadIds.length) {
      throw new BadRequestException({ error: 'lead_ids_required' });
    }
    if (!toUserId) {
      throw new BadRequestException({ error: 'to_user_id_invalid' });
    }
    if (reason.length < 3) {
      throw new BadRequestException({ error: 'reason_required' });
    }

    const results: Array<{ lead_id: number; ok: boolean; error?: string }> = [];
    for (const leadId of leadIds) {
      try {
        await this.legacy.assignLead(leadId, { to_user_id: toUserId, reason }, actor);
        results.push({ lead_id: leadId, ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ lead_id: leadId, ok: false, error: msg });
      }
    }
    const okCount = results.filter((r) => r.ok).length;
    return { ok: okCount === leadIds.length, assigned: okCount, total: leadIds.length, results };
  }

  async bulkReschedule(body: CskhBulkRescheduleBody, actor: string, userId: number | null) {
    const leadIds = [...new Set((body.lead_ids ?? []).map((id) => Number(id)).filter((id) => id > 0))];
    const followUpAt = String(body.follow_up_at ?? '').trim();
    const note = String(body.note ?? 'Batch reschedule từ CSKH board').trim();
    if (!leadIds.length) {
      throw new BadRequestException({ error: 'lead_ids_required' });
    }
    if (!followUpAt) {
      throw new BadRequestException({ error: 'follow_up_at_required' });
    }

    const results: Array<{ lead_id: number; ok: boolean }> = [];
    for (const leadId of leadIds) {
      await this.legacy.createActivity(
        leadId,
        {
          activity_type: 'note',
          content: note,
          next_action: 'Follow-up',
          next_action_at: followUpAt,
        },
        actor,
        userId,
      );
      results.push({ lead_id: leadId, ok: true });
    }
    return { ok: true, rescheduled: results.length, results };
  }
}

function csvCell(value: string): string {
  const v = String(value ?? '');
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

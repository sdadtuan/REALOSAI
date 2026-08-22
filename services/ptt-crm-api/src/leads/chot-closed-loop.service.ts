import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CrmLeadsLegacyService } from '../crm-leads-legacy/crm-leads-legacy.service';
import { CrmLeadsSqliteRepository } from '../crm-leads-legacy/crm-leads-sqlite.repository';
import { parseB2CompletedAt } from '../cskh-board/cskh-board-sla.util';
import { resolveLeadFlowKind } from '../leads-funnel/lead-flow-kind.util';
import { LeadAttributionService } from './lead-attribution.service';
import { LeadMeetingPrepRepository } from '../lead-meeting-prep/lead-meeting-prep.repository';
import { PgLeadsWriteRepository } from './pg-leads-write.repository';
import {
  CHOT_QA_FLAG_LABELS,
  buildClosedLoopDashboardSummary,
  buildClosedLoopMetaPatch,
  buildPlaybookAbMetrics,
  closedWithin24h,
  hadSciBeforeChot,
  normalizeCallScriptSource,
  type CallScriptSource,
  type ChotQaFlag,
} from './chot-closed-loop.util';
import { parseDealValueVnd } from '../performance/performance-conversion.util';

export interface LeadClosedLoopContextResponse {
  lead_id: number;
  applicable: boolean;
  status: string;
  deal_value_vnd: number;
  chot_package: string | null;
  qa_flags: ChotQaFlag[];
  qa_flag_labels: Record<ChotQaFlag, string>;
  closed_loop_at: string | null;
  call_script_source: CallScriptSource;
  hub_mapped: boolean;
  hub_href: string | null;
  roas_hint: string;
}

export interface ClosedLoopQaSampleRow {
  lead_id: number;
  full_name: string;
  owner_id: number | null;
  owner_name: string | null;
  deal_value_vnd: number;
  qa_flags: ChotQaFlag[];
  closed_at: string | null;
}

export interface ClosedLoopDashboardResponse {
  ok: boolean;
  generated_at: string;
  window_days: number;
  summary: ReturnType<typeof buildClosedLoopDashboardSummary>;
  qa_flag_labels: Record<ChotQaFlag, string>;
  qa_samples: ClosedLoopQaSampleRow[];
}

@Injectable()
export class ChotClosedLoopService implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly legacy: CrmLeadsLegacyService,
    private readonly leadSqlite: CrmLeadsSqliteRepository,
    private readonly pgWrite: PgLeadsWriteRepository,
    private readonly attribution: LeadAttributionService,
    private readonly lmpRepo: LeadMeetingPrepRepository,
  ) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async processAfterPatch(input: {
    leadId: number;
    prevStatus: string | null | undefined;
    nextStatus: string | null | undefined;
    auditNote: string;
    actor: string;
  }): Promise<void> {
    const status = String(input.nextStatus ?? '')
      .trim()
      .toLowerCase();
    if (status !== 'chot') return;

    const row = await this.fetchLeadRow(input.leadId);
    if (!row) return;

    const hasPresales = await this.hasPresales(input.leadId);
    const flowKind = resolveLeadFlowKind({
      clientId: row.client_id,
      channel: row.channel,
      source: row.source,
      status: row.status,
      metaJson: row.meta_json,
      hasPresales,
    });
    if (flowKind !== 'spa_operational') return;

    const note = String(input.auditNote ?? '').trim();
    const activities = await this.legacy.listActivities(input.leadId, 50);
    const firstCallMap = this.leadSqlite.firstCallAtByLeadIds([input.leadId]);
    const firstCallAt = firstCallMap.get(input.leadId) ?? null;
    const b2CompletedAt = parseB2CompletedAt(row.care_stages_done_json);
    const meta = this.parseMeta(row.meta_json);
    const prepRow = await this.lmpRepo.getByLeadId(input.leadId);
    const resultJson =
      prepRow?.result_json && typeof prepRow.result_json === 'object' && !Array.isArray(prepRow.result_json)
        ? (prepRow.result_json as Record<string, unknown>)
        : null;
    const closeIntel =
      resultJson?.close_intelligence &&
      typeof resultJson.close_intelligence === 'object' &&
      !Array.isArray(resultJson.close_intelligence)
        ? (resultJson.close_intelligence as Record<string, unknown>)
        : null;
    const sciUsedBeforeChot = hadSciBeforeChot({
      meta,
      prepStatus: prepRow?.status ?? null,
      prepStage: prepRow?.prep_stage ?? null,
      hasDealRoomPayload: Boolean(closeIntel?.deal_room_payload),
    });

    const patch = buildClosedLoopMetaPatch({
      auditNote: note,
      existingMeta: meta,
      activities: activities.map((a) => ({
        activity_type: a.activity_type,
        created_at: a.created_at,
      })),
      firstCallAt,
      b2CompletedAt,
      sciUsedBeforeChot,
    });

    const merged: Record<string, unknown> = { ...patch };
    if (meta.call_script_source && !merged.call_script_source) {
      merged.call_script_source = meta.call_script_source;
    }

    if (this.config.crmLeadsLegacyPg) {
      await this.pgWrite.mergeLeadMeta(input.leadId, merged);
    }
  }

  async trackCallScriptCopy(leadId: number, actor: string, source: CallScriptSource = 'sci'): Promise<void> {
    if (!this.config.crmLeadsLegacyPg) return;
    await this.pgWrite.mergeLeadMeta(leadId, {
      call_script_source: source,
      call_script_copied_at: new Date().toISOString(),
      call_script_copied_by: actor,
    });
  }

  async getLeadContext(leadId: number): Promise<LeadClosedLoopContextResponse> {
    const row = await this.fetchLeadRow(leadId);
    if (!row) {
      throw new NotFoundException({ error: 'Not found' });
    }

    const hasPresales = await this.hasPresales(leadId);
    const flowKind = resolveLeadFlowKind({
      clientId: row.client_id,
      channel: row.channel,
      source: row.source,
      status: row.status,
      metaJson: row.meta_json,
      hasPresales,
    });
    const meta = this.parseMeta(row.meta_json);
    const dealValue = parseDealValueVnd(meta);
    const qaFlags = Array.isArray(meta.qa_flags)
      ? (meta.qa_flags as unknown[]).filter((f): f is ChotQaFlag => typeof f === 'string')
      : [];

    let hubMapped = false;
    let hubHref: string | null = null;
    try {
      const attr = await this.attribution.getLeadAttribution(leadId);
      hubMapped = Boolean(attr.hub_mapped);
      hubHref = attr.hub_href ?? null;
    } catch {
      hubMapped = false;
    }

    const applicable = flowKind === 'spa_operational';
    const status = String(row.status ?? '').trim();

    return {
      lead_id: leadId,
      applicable,
      status,
      deal_value_vnd: dealValue,
      chot_package:
        typeof meta.chot_package === 'string' && meta.chot_package.trim()
          ? meta.chot_package.trim()
          : null,
      qa_flags: qaFlags,
      qa_flag_labels: CHOT_QA_FLAG_LABELS,
      closed_loop_at: typeof meta.closed_loop_at === 'string' ? meta.closed_loop_at : null,
      call_script_source: normalizeCallScriptSource(meta.call_script_source),
      hub_mapped: hubMapped,
      hub_href: hubHref,
      roas_hint:
        dealValue > 0
          ? 'Giá trị đã ghi — hub ROAS cập nhật khi sync performance.'
          : 'Ghi giá VND trong audit note khi chốt để closed-loop ROAS.',
    };
  }

  async getClosedLoopDashboard(windowDays = 30, sampleLimit = 20): Promise<ClosedLoopDashboardResponse> {
    const days = Math.max(1, Math.min(windowDays, 90));
    const limit = Math.max(1, Math.min(sampleLimit, 100));

    if (!this.config.crmLeadsLegacyPg) {
      return {
        ok: true,
        generated_at: new Date().toISOString(),
        window_days: days,
        summary: buildClosedLoopDashboardSummary({
          chotTotal: 0,
          withDealValue: 0,
          qaFlagged: 0,
          dealValueSum: 0,
        }),
        qa_flag_labels: CHOT_QA_FLAG_LABELS,
        qa_samples: [],
      };
    }

    const result = await this.db.query(
      `SELECT l.sqlite_lead_id, l.full_name, l.owner_id, l.meta_json, l.updated_at::text AS updated_at
       FROM crm_leads l
       WHERE lower(COALESCE(l.status, '')) = 'chot'
         AND l.updated_at >= NOW() - ($1::int * INTERVAL '1 day')
         AND l.is_duplicate IS NOT TRUE
       ORDER BY l.updated_at DESC
       LIMIT 200`,
      [days],
    );

    const ownerIds = result.rows
      .map((r) => Number((r as { owner_id?: number }).owner_id ?? 0))
      .filter((id) => id > 0);
    const ownerNames = this.leadSqlite.staffNamesByIds(ownerIds);

    let withDealValue = 0;
    let qaFlagged = 0;
    let dealValueSum = 0;
    const qaSamples: ClosedLoopQaSampleRow[] = [];

    for (const raw of result.rows) {
      const row = raw as {
        sqlite_lead_id: number;
        full_name: string;
        owner_id: number | null;
        meta_json: unknown;
        updated_at: string;
      };
      const meta = this.parseMeta(
        typeof row.meta_json === 'string' ? row.meta_json : JSON.stringify(row.meta_json ?? {}),
      );
      const dealValue = parseDealValueVnd(meta);
      const flags = Array.isArray(meta.qa_flags)
        ? (meta.qa_flags as unknown[]).filter((f): f is ChotQaFlag => typeof f === 'string')
        : [];

      if (dealValue > 0) {
        withDealValue += 1;
        dealValueSum += dealValue;
      }
      if (flags.length > 0) qaFlagged += 1;

      if (flags.length > 0 && qaSamples.length < limit) {
        qaSamples.push({
          lead_id: Number(row.sqlite_lead_id),
          full_name: row.full_name ?? '',
          owner_id: row.owner_id,
          owner_name: row.owner_id ? ownerNames.get(row.owner_id) ?? null : null,
          deal_value_vnd: dealValue,
          qa_flags: flags,
          closed_at: row.updated_at,
        });
      }
    }

    return {
      ok: true,
      generated_at: new Date().toISOString(),
      window_days: days,
      summary: buildClosedLoopDashboardSummary({
        chotTotal: result.rows.length,
        withDealValue,
        qaFlagged,
        dealValueSum,
      }),
      qa_flag_labels: CHOT_QA_FLAG_LABELS,
      qa_samples: qaSamples,
    };
  }

  async getPlaybookAbMetrics(windowDays = 30) {
    const days = Math.max(1, Math.min(windowDays, 90));

    if (!this.config.crmLeadsLegacyPg) {
      return { ok: true, ...buildPlaybookAbMetrics([], days) };
    }

    const result = await this.db.query(
      `SELECT l.sqlite_lead_id, l.meta_json,
              l.received_at::text AS received_at,
              l.created_at::text AS created_at,
              l.updated_at::text AS updated_at
       FROM crm_leads l
       WHERE lower(COALESCE(l.status, '')) = 'chot'
         AND l.updated_at >= NOW() - ($1::int * INTERVAL '1 day')
         AND l.is_duplicate IS NOT TRUE
       ORDER BY l.updated_at DESC
       LIMIT 300`,
      [days],
    );

    const rows = result.rows.map((raw) => {
      const row = raw as {
        sqlite_lead_id: number;
        meta_json: unknown;
        received_at: string | null;
        created_at: string | null;
        updated_at: string | null;
      };
      const meta = this.parseMeta(
        typeof row.meta_json === 'string' ? row.meta_json : JSON.stringify(row.meta_json ?? {}),
      );
      const receivedAt = row.received_at ?? row.created_at;
      return {
        lead_id: Number(row.sqlite_lead_id),
        call_script_source: (() => {
          const s = normalizeCallScriptSource(meta.call_script_source);
          return s === 'sci' ? 'ai_v1' : s;
        })(),
        deal_value_vnd: parseDealValueVnd(meta),
        closed_within_24h: closedWithin24h(receivedAt, row.updated_at),
        received_at: receivedAt,
        closed_at: row.updated_at,
      };
    });

    return { ok: true, ...buildPlaybookAbMetrics(rows, days) };
  }

  private parseMeta(raw: string | null): Record<string, unknown> {
    if (!raw?.trim()) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private async fetchLeadRow(leadId: number): Promise<{
    status: string | null;
    source: string | null;
    channel: string | null;
    client_id: string | null;
    meta_json: string | null;
    care_stages_done_json: string | null;
  } | null> {
    if (this.config.crmLeadsLegacyPg) {
      const result = await this.db.query(
        `SELECT status, source,
                COALESCE(agency_client_id::text, '') AS client_id,
                COALESCE(channel, '') AS channel,
                meta_json::text AS meta_json,
                COALESCE(care_stages_done_json, '{}'::jsonb)::text AS care_stages_done_json
         FROM crm_leads
         WHERE sqlite_lead_id = $1
         LIMIT 1`,
        [leadId],
      );
      return (result.rows[0] as typeof result.rows[0] | undefined) ?? null;
    }

    return null;
  }

  private async hasPresales(leadId: number): Promise<boolean> {
    if (!this.config.crmLeadsLegacyPg) return false;
    const result = await this.db.query(
      `SELECT 1 FROM crm_lead_presales WHERE lead_id = $1 LIMIT 1`,
      [leadId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}

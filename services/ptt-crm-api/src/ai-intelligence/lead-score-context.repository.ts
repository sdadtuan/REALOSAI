import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CrmLeadsSqliteRepository } from '../crm-leads-legacy/crm-leads-sqlite.repository';
import { CustomerTimelineRepository } from '../customer-timeline/customer-timeline.repository';
import { LeadAttributionService } from '../leads/lead-attribution.service';
import { LeadScoreContext } from './lead-score.types';

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function parseDealValue(meta: Record<string, unknown>): number | null {
  const keys = ['estimated_deal_value_vnd', 'deal_value_vnd', 'budget_vnd', 'budget'];
  for (const key of keys) {
    const raw = meta[key];
    const num = Number(raw);
    if (Number.isFinite(num) && num > 0) {
      return num;
    }
  }
  return null;
}

@Injectable()
export class LeadScoreContextRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly sqlite: CrmLeadsSqliteRepository,
    private readonly timeline: CustomerTimelineRepository,
    private readonly attribution: LeadAttributionService,
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

  async loadLeadScoreContext(leadId: number): Promise<LeadScoreContext | null> {
    let pgRow: Record<string, unknown> | null = null;
    try {
      const result = await this.db.query(
        `SELECT sqlite_lead_id, agency_client_id::text AS client_id, channel, source,
                campaign_id, external_lead_id, status, is_duplicate,
                meta_json, received_at, created_at
         FROM crm_leads
         WHERE sqlite_lead_id = $1
         LIMIT 1`,
        [leadId],
      );
      pgRow = (result.rows[0] as Record<string, unknown> | undefined) ?? null;
    } catch {
      pgRow = null;
    }

    if (!pgRow) {
      if (!this.sqlite.leadExists(leadId)) {
        return null;
      }
      const receivedAt = new Date();
      return this.enrichWithAttribution({
        leadId,
        clientId: null,
        channel: null,
        source: null,
        campaignId: null,
        externalLeadId: null,
        status: this.sqlite.getLeadStatus(leadId),
        isDuplicate: false,
        receivedAt,
        createdAt: receivedAt,
        firstContactAt: this.sqlite.getFirstStaffContactAt(leadId),
        timelineEventCount: 0,
        meta: {},
        estimatedDealValueVnd: null,
      });
    }

    const meta = parseMeta(pgRow.meta_json);
    const receivedAt = parseDate(pgRow.received_at) ?? parseDate(pgRow.created_at) ?? new Date();
    const createdAt = parseDate(pgRow.created_at) ?? receivedAt;
    let timelineEventCount = 0;
    if (await this.timeline.tableReady()) {
      const listed = await this.timeline.listEvents({
        entityType: 'lead',
        entityId: String(leadId),
        limit: 1,
      });
      timelineEventCount = listed.total;
    }

    return this.enrichWithAttribution({
      leadId,
      clientId: (pgRow.client_id as string | null) ?? null,
      channel: (pgRow.channel as string | null) ?? null,
      source: (pgRow.source as string | null) ?? null,
      campaignId: (pgRow.campaign_id as string | null) ?? null,
      externalLeadId: (pgRow.external_lead_id as string | null) ?? null,
      status: (pgRow.status as string | null) ?? null,
      isDuplicate: Boolean(pgRow.is_duplicate),
      receivedAt,
      createdAt,
      firstContactAt: this.sqlite.getFirstStaffContactAt(leadId),
      timelineEventCount,
      meta,
      estimatedDealValueVnd: parseDealValue(meta),
    });
  }

  private async enrichWithAttribution(ctx: LeadScoreContext): Promise<LeadScoreContext> {
    try {
      const attr = await this.attribution.getLeadAttribution(ctx.leadId);
      return {
        ...ctx,
        campaignId: ctx.campaignId ?? attr.campaign_id,
        campaignName: attr.campaign_name,
        cplVnd: attr.cpl_vnd,
        targetCplVnd: attr.target_cpl_vnd,
        cplOverTarget: attr.cpl_over_target,
      };
    } catch {
      return ctx;
    }
  }
}

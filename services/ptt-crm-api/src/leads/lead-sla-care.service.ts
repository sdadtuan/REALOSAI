import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CrmLeadsLegacyService } from '../crm-leads-legacy/crm-leads-legacy.service';
import { CrmLeadsSqliteRepository } from '../crm-leads-legacy/crm-leads-sqlite.repository';
import {
  computeSpaMeta24hSlas,
  isSpaClosedStatus,
  parseB2CompletedAt,
} from '../cskh-board/cskh-board-sla.util';
import { resolveLeadFlowKind, type LeadFlowKind } from '../leads-funnel/lead-flow-kind.util';
import {
  buildAuditNoteDraft,
  buildCallScriptDraft,
  buildSlaCareBanner,
  resolveSlaCareNba,
  suggestLostReasons,
  type AuditNoteDraft,
  type CallScriptDraft,
  type LostReasonOption,
  type SlaCareBanner,
  type SlaCareNba,
} from './lead-sla-care.util';
import type { CskhSlaTierSnapshot } from '../cskh-board/cskh-board-sla.util';
import { LeadMeetingPrepRepository } from '../lead-meeting-prep/lead-meeting-prep.repository';
import { buildM1ScriptFromPrepRow } from '../lead-meeting-prep/lmp-m1-script.util';

export interface LeadSlaCareContextResponse {
  lead_id: number;
  lead_flow_kind: LeadFlowKind;
  applicable: boolean;
  sla_tiers: CskhSlaTierSnapshot[];
  worst_sla_state: string;
  worst_sla_tier: string | null;
  banner: SlaCareBanner;
  nba: SlaCareNba | null;
  drafts: {
    call_script: CallScriptDraft | null;
    audit_note: AuditNoteDraft | null;
  };
  lost_reason_options: LostReasonOption[];
  sci: {
    enabled: boolean;
    status: string | null;
    prep_stage: string | null;
    opening: string | null;
    script_full: string | null;
    close_readiness_score: number | null;
  } | null;
}

@Injectable()
export class LeadSlaCareService implements OnModuleDestroy {
  private pool: Pool | null = null;
  private sqlite: DatabaseSync | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly legacy: CrmLeadsLegacyService,
    private readonly leadSqlite: CrmLeadsSqliteRepository,
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
    if (this.sqlite) {
      this.sqlite.close();
      this.sqlite = null;
    }
  }

  private get sqliteDb(): DatabaseSync {
    if (!this.sqlite) {
      this.sqlite = new DatabaseSync(this.config.sqlitePath);
      this.sqlite.exec('PRAGMA foreign_keys = ON');
    }
    return this.sqlite;
  }

  async getCareContext(leadId: number): Promise<LeadSlaCareContextResponse> {
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

    const applicable =
      flowKind === 'spa_operational' || (flowKind === 'b2b_prospect' && hasPresales);
    if (!applicable) {
      return {
        lead_id: leadId,
        lead_flow_kind: flowKind,
        applicable: false,
        sla_tiers: [],
        worst_sla_state: 'na',
        worst_sla_tier: null,
        banner: { severity: 'hidden', title: '', message: '', tier: null },
        nba: null,
        drafts: { call_script: null, audit_note: null },
        lost_reason_options: [],
        sci: null,
      };
    }

    const firstCallMap = this.leadSqlite.firstCallAtByLeadIds([leadId]);
    const firstCallAt = firstCallMap.get(leadId) ?? null;
    const b2CompletedAt = parseB2CompletedAt(row.care_stages_done_json);
    const closedAt = isSpaClosedStatus(row.status) ? row.updated_at : null;

    const sla = computeSpaMeta24hSlas({
      status: row.status,
      receivedAt: row.received_at ?? row.created_at,
      createdAt: row.created_at,
      firstCallAt,
      careStagesDoneJson: row.care_stages_done_json,
      b2CompletedAt,
      closedAt,
    });

    const activities = await this.legacy.listActivities(leadId, 20);
    const activitySnippets = activities.map((a) => ({
      activity_type: a.activity_type,
      content: a.content,
    }));

    const meta = this.parseMeta(row.meta_json);
    const spaName =
      String(meta.spa_name ?? meta.client_name ?? meta.brand_name ?? '').trim() || null;

    const banner = buildSlaCareBanner({
      tiers: sla.tiers,
      worst_state: sla.worst_state,
      worst_tier: sla.worst_tier,
      status: row.status,
    });

    const nba = resolveSlaCareNba({ ...sla, status: row.status });
    const showCallScript = !firstCallAt && !isSpaClosedStatus(row.status);

    let sci: LeadSlaCareContextResponse['sci'] = null;
    if (this.config.leadMeetingPrepEnabled && showCallScript) {
      const prepRow = (await this.lmpRepo.tableReady())
        ? await this.lmpRepo.getByLeadId(leadId)
        : null;
      const script = buildM1ScriptFromPrepRow(prepRow);
      sci = {
        enabled: true,
        status: prepRow?.status ?? 'none',
        prep_stage: prepRow?.prep_stage ?? null,
        opening: script.opening || null,
        script_full: script.script_full || null,
        close_readiness_score: prepRow?.close_readiness_score ?? null,
      };
    }

    return {
      lead_id: leadId,
      lead_flow_kind: flowKind,
      applicable: true,
      sla_tiers: sla.tiers,
      worst_sla_state: sla.worst_state,
      worst_sla_tier: sla.worst_tier,
      banner,
      nba,
      drafts: {
        call_script: showCallScript
          ? buildCallScriptDraft({
              fullName: row.full_name ?? '',
              channel: row.channel,
              source: row.source,
              spaName,
            })
          : null,
        audit_note: buildAuditNoteDraft({
          activities: activitySnippets,
          fullName: row.full_name,
        }),
      },
      lost_reason_options: suggestLostReasons({ activities: activitySnippets, status: row.status }),
      sci,
    };
  }

  /** Used by AiNbaService — returns SLA NBA input or null. */
  async getSlaNbaForLead(leadId: number): Promise<{
    flowKind: LeadFlowKind;
    nba: SlaCareNba;
    sla: ReturnType<typeof computeSpaMeta24hSlas>;
  } | null> {
    const ctx = await this.getCareContext(leadId);
    if (!ctx.applicable || !ctx.nba) return null;
    return {
      flowKind: ctx.lead_flow_kind,
      nba: ctx.nba,
      sla: {
        tiers: ctx.sla_tiers,
        worst_state: ctx.worst_sla_state as ReturnType<typeof computeSpaMeta24hSlas>['worst_state'],
        worst_tier: ctx.worst_sla_tier as ReturnType<typeof computeSpaMeta24hSlas>['worst_tier'],
        sla_state: ctx.worst_sla_state as ReturnType<typeof computeSpaMeta24hSlas>['sla_state'],
        sla_tier: ctx.worst_sla_tier as ReturnType<typeof computeSpaMeta24hSlas>['sla_tier'],
        sla_minutes_elapsed: null,
        sla_deadline_at: null,
      },
    };
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
    full_name: string | null;
    phone: string | null;
    source: string | null;
    channel: string | null;
    client_id: string | null;
    meta_json: string | null;
    care_stages_done_json: string | null;
    received_at: string | null;
    created_at: string | null;
    updated_at: string | null;
  } | null> {
    if (this.config.crmLeadsLegacyPg) {
      const result = await this.db.query(
        `SELECT status, full_name, phone, source,
                COALESCE(agency_client_id::text, '') AS client_id,
                COALESCE(channel, '') AS channel,
                meta_json::text AS meta_json,
                COALESCE(care_stages_done_json, '{}'::jsonb)::text AS care_stages_done_json,
                received_at::text AS received_at,
                created_at::text AS created_at,
                updated_at::text AS updated_at
         FROM crm_leads
         WHERE sqlite_lead_id = $1
         LIMIT 1`,
        [leadId],
      );
      return (result.rows[0] as typeof result.rows[0] | undefined) ?? null;
    }

    const row = this.sqliteDb
      .prepare(
        `SELECT status, full_name, phone, source,
                COALESCE(json_extract(meta_json, '$.agency_client_id'), '') AS client_id,
                COALESCE(
                  json_extract(meta_json, '$.channel'),
                  json_extract(meta_json, '$.ingest_channel'),
                  source,
                  ''
                ) AS channel,
                meta_json,
                COALESCE(care_stages_done_json, '{}') AS care_stages_done_json,
                received_at,
                created_at,
                updated_at
         FROM crm_leads WHERE id = ? LIMIT 1`,
      )
      .get(leadId) as
      | {
          status: string | null;
          full_name: string | null;
          phone: string | null;
          source: string | null;
          channel: string | null;
          client_id: string | null;
          meta_json: string | null;
          care_stages_done_json: string | null;
          received_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        }
      | undefined;
    return row ?? null;
  }

  private async hasPresales(leadId: number): Promise<boolean> {
    if (this.config.crmLeadsLegacyPg) {
      const result = await this.db.query(
        `SELECT 1 FROM crm_lead_presales WHERE lead_id = $1 LIMIT 1`,
        [leadId],
      );
      return (result.rowCount ?? 0) > 0;
    }
    const row = this.sqliteDb
      .prepare(`SELECT 1 AS ok FROM crm_lead_presales WHERE lead_id = ? LIMIT 1`)
      .get(leadId) as { ok: number } | undefined;
    return Boolean(row);
  }
}

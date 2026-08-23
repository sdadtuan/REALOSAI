import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { resolveLeadFlowKind, type LeadFlowKind } from '../leads-funnel/lead-flow-kind.util';
import {
  CONTACT_OK_CARE_STATUS,
  computeAllowedNextStatuses,
  computeB2Complete,
  leadStatusLabel,
  LeadStatusGateError,
  LeadStatusOptionRow,
  normalizeLeadStatus,
  validateLeadStatusChange,
} from './lead-status-gate.util';
import { PatchLeadV1Body } from './leads.types';

export interface LeadStatusGatePatchOptions {
  allowStatusOverride?: boolean;
}

export interface LeadStatusOptionsResponse {
  current_status: string;
  current_status_label: string;
  lead_flow_kind: LeadFlowKind;
  gate_enabled: boolean;
  allowed_next: LeadStatusOptionRow[];
  hints: string[];
}

@Injectable()
export class LeadStatusGateService implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

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

  isEnabled(): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_LEAD_STATUS_GATE ?? '1').trim().toLowerCase(),
    );
  }

  async getStatusOptions(leadId: number): Promise<LeadStatusOptionsResponse> {
    const state = await this.loadLeadGateState(leadId);
    if (!state) {
      throw new NotFoundException({ error: 'Not found' });
    }

    const current = normalizeLeadStatus(state.status);
    const { options, hints } = computeAllowedNextStatuses({
      currentStatus: current,
      flowKind: state.flowKind,
      b2Complete: state.b2Complete,
      hasOutreachActivity: state.hasOutreachActivity,
      needsCleanup: state.needsCleanup,
      gateEnabled: this.isEnabled(),
    });

    return {
      current_status: current,
      current_status_label: leadStatusLabel(current),
      lead_flow_kind: state.flowKind,
      gate_enabled: this.isEnabled(),
      allowed_next: options,
      hints,
    };
  }

  async assertPatchAllowed(
    leadId: number,
    body: PatchLeadV1Body,
    opts: LeadStatusGatePatchOptions = {},
  ): Promise<void> {
    if (!this.isEnabled() || body.status === undefined) return;

    const ctx = await this.loadContext(leadId, body, opts);
    try {
      validateLeadStatusChange(ctx);
    } catch (err) {
      if (err instanceof LeadStatusGateError) {
        throw err;
      }
      throw err;
    }
  }

  private async loadContext(
    leadId: number,
    body: PatchLeadV1Body,
    opts: LeadStatusGatePatchOptions,
  ) {
    const state = await this.loadLeadGateState(leadId);
    if (!state) {
      throw new LeadStatusGateError('lead_not_found', 'Không tìm thấy lead.');
    }

    return {
      oldStatus: String(state.status ?? 'moi'),
      newStatus: String(body.status ?? '').trim(),
      auditNote: String(body.audit_note ?? '').trim(),
      allowOverride: Boolean(opts.allowStatusOverride && body.allow_status_override),
      overrideReason: String(body.status_override_reason ?? body.audit_note ?? '').trim(),
      b2Complete: state.b2Complete,
      hasOutreachActivity: state.hasOutreachActivity,
      needsCleanup: state.needsCleanup,
      flowKind: state.flowKind,
    };
  }

  private async loadLeadGateState(leadId: number): Promise<{
    status: string;
    flowKind: LeadFlowKind;
    b2Complete: boolean;
    hasOutreachActivity: boolean;
    needsCleanup: boolean;
  } | null> {
    const row = await this.fetchLeadRow(leadId);
    if (!row) return null;

    const [hasContactOkReport, hasOutreachActivity, hasPresales] = await Promise.all([
      this.hasContactOkReport(leadId),
      this.hasOutreachActivity(leadId),
      this.hasPresales(leadId),
    ]);

    const b2Complete = computeB2Complete({
      careStageCurrent: row.care_stage_current,
      careStagesDoneJson: row.care_stages_done_json,
      hasContactOkReport,
    });

    const needsCleanup = this.leadNeedsCleanup(row.full_name, row.phone);

    const flowKind = resolveLeadFlowKind({
      clientId: row.client_id,
      channel: row.channel,
      source: row.source,
      status: row.status,
      metaJson: row.meta_json,
      hasPresales,
    });

    return {
      status: String(row.status ?? 'moi'),
      flowKind,
      b2Complete,
      hasOutreachActivity,
      needsCleanup,
    };
  }

  private async fetchLeadRow(leadId: number): Promise<{
    status: string | null;
    full_name: string | null;
    phone: string | null;
    source: string | null;
    channel: string | null;
    client_id: string | null;
    meta_json: string | null;
    care_stage_current: string | null;
    care_stages_done_json: string | null;
  } | null> {
    const result = await this.db.query(
      `SELECT status, full_name, phone, source,
              COALESCE(agency_client_id::text, '') AS client_id,
              COALESCE(channel, '') AS channel,
              meta_json::text AS meta_json,
              COALESCE(care_stage_current, 'first_contact') AS care_stage_current,
              COALESCE(care_stages_done_json, '{}'::jsonb)::text AS care_stages_done_json
       FROM crm_leads
       WHERE sqlite_lead_id = $1
       LIMIT 1`,
      [leadId],
    );
    return (result.rows[0] as typeof result.rows[0] | undefined) ?? null;
  }

  private async hasPresales(leadId: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM crm_lead_presales WHERE lead_id = $1 LIMIT 1`,
      [leadId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async hasContactOkReport(leadId: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM crm_lead_activities
       WHERE lead_id = $1 AND care_stage_key = 'first_contact'
         AND activity_type != 'system'
         AND trim(COALESCE(care_status, '')) = $2
       LIMIT 1`,
      [leadId, CONTACT_OK_CARE_STATUS],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async hasOutreachActivity(leadId: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM crm_lead_activities
       WHERE lead_id = $1
         AND activity_type = ANY($2::text[])
       LIMIT 1`,
      [leadId, ['call', 'email', 'message', 'meeting']],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private leadNeedsCleanup(fullName: string | null, phone: string | null): boolean {
    const name = String(fullName ?? '').trim();
    const ph = String(phone ?? '').trim();
    return name.length < 2 || ph.length < 8;
  }
}

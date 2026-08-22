import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import { assertPresalesCareGate, parseLeadMeta } from '../leads-funnel/care-pipeline.util';
import { LeadsFunnelPgRepository } from '../leads-funnel/leads-funnel-pg.repository';
import { buildReadinessChecks } from './contract-readiness.util';
import { ContractPromotePgUtil, PresalesPromoteSource } from './contract-promote-pg.util';
import type {
  ApprovalStatus,
  ContractApprovalRow,
  ContractReadiness,
  ContractRow,
  CreateContractBody,
  PatchContractBody,
} from './contract.types';
import { inferBillingType, SERVICE_LABELS } from './lifecycle-workflow-steps.util';

@Injectable()
export class LeadsContractPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private readonly promoteUtil = new ContractPromotePgUtil();

  constructor(
    private readonly config: AppConfigService,
    @Optional() private readonly funnelPg?: LeadsFunnelPgRepository,
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

  private ts(): string {
    return catalogTs();
  }

  mapContract(row: Record<string, unknown>): ContractRow {
    return {
      id: Number(row.id),
      customer_id: Number(row.customer_id),
      lead_id: row.lead_id != null ? Number(row.lead_id) : null,
      case_id: row.case_id != null ? Number(row.case_id) : null,
      agency_client_id: String(row.agency_client_id ?? ''),
      title: String(row.title ?? ''),
      status: String(row.status ?? 'draft') as ContractRow['status'],
      amount_vnd: Number(row.amount_vnd ?? 0),
      service_slug: String(row.service_slug ?? ''),
      signed_on: row.signed_on ? String(row.signed_on).slice(0, 10) : '',
      notes: String(row.notes ?? ''),
      created_at: row.created_at ? String(row.created_at) : '',
      updated_at: row.updated_at ? String(row.updated_at) : '',
    };
  }

  mapApproval(row: Record<string, unknown>): ContractApprovalRow {
    return {
      id: Number(row.id),
      contract_id: Number(row.contract_id),
      lead_id: Number(row.lead_id),
      status: String(row.status ?? 'pending') as ApprovalStatus,
      requested_by: String(row.requested_by ?? ''),
      decided_by: String(row.decided_by ?? ''),
      amount_vnd: Number(row.amount_vnd ?? 0),
      notes: String(row.notes ?? ''),
      decision_notes: String(row.decision_notes ?? ''),
      created_at: row.created_at ? String(row.created_at) : '',
      decided_at: row.decided_at ? String(row.decided_at) : '',
    };
  }

  private async logContractEvent(
    client: Pool | PoolClient,
    contractId: number,
    eventType: string,
    actor: string,
    payload: unknown = {},
  ): Promise<void> {
    await client.query(
      `INSERT INTO crm_contract_events (contract_id, event_type, actor, payload_json, created_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      [contractId, eventType, actor, JSON.stringify(payload)],
    );
  }

  private leadAgencyClientId(metaJson: string | null): string {
    const meta = parseLeadMeta(metaJson);
    return String(meta.agency_client_id ?? meta.client_id ?? '').trim();
  }

  async getReadiness(leadId: number): Promise<ContractReadiness> {
    const leadResult = await this.db.query(
      `SELECT care_stage_current, care_stages_done_json::text AS care_stages_done_json, meta_json::text AS meta_json
       FROM crm_leads WHERE sqlite_lead_id = $1`,
      [leadId],
    );
    const lead = leadResult.rows[0] as
      | { care_stage_current: string; care_stages_done_json: string; meta_json: string }
      | undefined;
    if (!lead) throw new Error('Không tìm thấy lead');

    const presalesCtx = await this.resolvePresalesContext(leadId);
    const { contract, approval } = await this.getContractForLead(leadId);

    const checks = buildReadinessChecks({
      careStageCurrent: String(lead.care_stage_current ?? ''),
      careStagesDoneJson: String(lead.care_stages_done_json ?? '{}'),
      presales: presalesCtx?.presales ?? null,
      marketingPlan: presalesCtx?.marketingPlan ?? null,
      contract,
      pendingApproval: approval,
    });

    return {
      ok: checks.every((c) => c.ok) && approval?.status !== 'pending',
      checks,
      contract,
      approval,
      lifecycle_id: presalesCtx?.lifecycleId ?? null,
    };
  }

  private async resolvePresalesContext(leadId: number): Promise<{
    presales: { stage: string; status: string; tasksProgress: Record<string, { total: number; done: number }> };
    marketingPlan: Record<string, unknown> | null;
    lifecycleId: number | null;
    row: Record<string, unknown>;
  } | null> {
    if (this.funnelPg) {
      const ps = await this.funnelPg.getPresalesRowByLeadId(leadId);
      if (!ps) return null;
      const marketingPlan = await this.funnelPg.getPreliminaryPlan(ps.id);
      const tasksProgress = await this.funnelPg.getPresalesProgress(ps.id);
      return {
        presales: {
          stage: ps.stage,
          status: ps.status,
          tasksProgress,
        },
        marketingPlan,
        lifecycleId: ps.lifecycle_id,
        row: ps as unknown as Record<string, unknown>,
      };
    }

    const psResult = await this.db.query(`SELECT * FROM crm_lead_presales WHERE lead_id = $1`, [leadId]);
    const ps = psResult.rows[0] as Record<string, unknown> | undefined;
    if (!ps) return null;
    const planResult = await this.db.query(
      `SELECT * FROM crm_marketing_plans
       WHERE presales_id = $1 AND plan_kind = 'preliminary'
       ORDER BY id DESC LIMIT 1`,
      [Number(ps.id)],
    );
    const marketingPlan = (planResult.rows[0] as Record<string, unknown> | undefined) ?? null;
    const progressResult = await this.db.query(
      `SELECT stage, is_done FROM crm_lead_presales_tasks WHERE presales_id = $1`,
      [Number(ps.id)],
    );
    const tasksProgress: Record<string, { total: number; done: number }> = {};
    for (const row of progressResult.rows as Array<{ stage: string; is_done: boolean }>) {
      const stage = String(row.stage);
      if (!tasksProgress[stage]) tasksProgress[stage] = { total: 0, done: 0 };
      tasksProgress[stage].total += 1;
      if (row.is_done) tasksProgress[stage].done += 1;
    }
    return {
      presales: {
        stage: String(ps.stage),
        status: String(ps.status),
        tasksProgress,
      },
      marketingPlan,
      lifecycleId: ps.lifecycle_id != null ? Number(ps.lifecycle_id) : null,
      row: ps,
    };
  }

  async getContractForLead(leadId: number): Promise<{ contract: ContractRow | null; approval: ContractApprovalRow | null }> {
    const contractResult = await this.db.query(
      `SELECT * FROM crm_contracts WHERE lead_id = $1 ORDER BY id DESC LIMIT 1`,
      [leadId],
    );
    const contractRow = contractResult.rows[0] as Record<string, unknown> | undefined;
    const contract = contractRow ? this.mapContract(contractRow) : null;
    let approval: ContractApprovalRow | null = null;
    if (contract) {
      const apprResult = await this.db.query(
        `SELECT * FROM crm_contract_approvals WHERE contract_id = $1 ORDER BY id DESC LIMIT 1`,
        [contract.id],
      );
      const appr = apprResult.rows[0] as Record<string, unknown> | undefined;
      approval = appr ? this.mapApproval(appr) : null;
    }
    return { contract, approval };
  }

  async createDraftContract(leadId: number, body: CreateContractBody, actor: string): Promise<ContractRow> {
    const leadResult = await this.db.query(
      `SELECT sqlite_lead_id AS id, full_name, meta_json::text AS meta_json,
              care_stage_current, care_stages_done_json::text AS care_stages_done_json
       FROM crm_leads WHERE sqlite_lead_id = $1`,
      [leadId],
    );
    const lead = leadResult.rows[0] as Record<string, unknown> | undefined;
    if (!lead) throw new Error('Không tìm thấy lead');
    assertPresalesCareGate(String(lead.care_stage_current), String(lead.care_stages_done_json));

    const presalesCtx = await this.resolvePresalesContext(leadId);
    if (!presalesCtx) throw new Error('Chưa có pre-sales');
    if (presalesCtx.presales.status !== 'active') throw new Error('Pre-sales không còn active');

    const existingResult = await this.db.query(
      `SELECT * FROM crm_contracts WHERE lead_id = $1 AND status = 'draft' ORDER BY id DESC LIMIT 1`,
      [leadId],
    );
    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
    if (existing) return this.mapContract(existing);

    const slug = String(presalesCtx.row.service_slug ?? '').trim();
    if (!slug) throw new Error('Pre-sales thiếu service_slug');

    const ts = this.ts();
    const placeholderId = await this.ensurePlaceholderCustomer(leadId, String(lead.full_name ?? ''), ts);
    const svcLabel = SERVICE_LABELS[slug] ?? slug;
    const leadName = String(lead.full_name ?? '').trim() || `#${leadId}`;
    const title = String(body.title ?? '').trim() || `${svcLabel} — Lead #${leadId} ${leadName}`.slice(0, 500);
    const amount = Math.max(0, Math.min(Number(body.amount_vnd ?? 0) || 0, 9_999_999_999_999));
    const noteLine = String(body.notes ?? '').trim();

    const insert = await this.db.query(
      `INSERT INTO crm_contracts (
         customer_id, lead_id, title, status, amount_vnd, service_slug, agency_client_id,
         billing_type, notes, created_at, updated_at
       ) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9::timestamptz, $9::timestamptz)
       RETURNING *`,
      [
        placeholderId,
        leadId,
        title,
        amount,
        slug,
        this.leadAgencyClientId(String(lead.meta_json ?? '')),
        inferBillingType(slug),
        noteLine,
        ts,
      ],
    );
    const contract = insert.rows[0] as Record<string, unknown>;
    const contractId = Number(contract.id);
    await this.logContractEvent(this.db, contractId, 'draft_created', actor, { lead_id: leadId });
    return this.mapContract(contract);
  }

  private async ensurePlaceholderCustomer(leadId: number, fullName: string, ts: string): Promise<number> {
    const existingResult = await this.db.query(
      `SELECT id FROM crm_customers
       WHERE placeholder_lead_id = $1 AND COALESCE(is_placeholder, FALSE) IS TRUE
       ORDER BY id DESC LIMIT 1`,
      [leadId],
    );
    if (existingResult.rows[0]) return Number(existingResult.rows[0].id);
    const name = `[Lead #${leadId}] Chưa ký — ${String(fullName || 'Lead').trim()}`.slice(0, 240);
    const insert = await this.db.query(
      `INSERT INTO crm_customers (name, phone, email, address, company, created_at, is_placeholder, placeholder_lead_id)
       VALUES ($1, '', '', '', '', $2::timestamptz, TRUE, $3)
       RETURNING id`,
      [name, ts, leadId],
    );
    return Number(insert.rows[0].id);
  }

  async patchContract(contractId: number, leadId: number, body: PatchContractBody): Promise<ContractRow> {
    const rowResult = await this.db.query(`SELECT * FROM crm_contracts WHERE id = $1 AND lead_id = $2`, [
      contractId,
      leadId,
    ]);
    const row = rowResult.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error('Không tìm thấy hợp đồng');
    if (String(row.status) !== 'draft') throw new Error('Chỉ sửa được HĐ draft');
    const ts = this.ts();
    const updated = await this.db.query(
      `UPDATE crm_contracts SET title = $2, amount_vnd = $3, notes = $4, updated_at = $5::timestamptz
       WHERE id = $1
       RETURNING *`,
      [
        contractId,
        body.title != null ? String(body.title).trim().slice(0, 500) : String(row.title),
        body.amount_vnd != null
          ? Math.max(0, Math.min(Number(body.amount_vnd) || 0, 9_999_999_999_999))
          : Number(row.amount_vnd),
        body.notes != null ? String(body.notes).trim().slice(0, 8000) : String(row.notes),
        ts,
      ],
    );
    return this.mapContract(updated.rows[0] as Record<string, unknown>);
  }

  async submitForApproval(
    contractId: number,
    leadId: number,
    actor: string,
    notes: string,
  ): Promise<ContractApprovalRow> {
    const readiness = await this.getReadiness(leadId);
    const submitChecks = readiness.checks.filter((c) => c.key !== 'no_pending_approval');
    if (!submitChecks.every((c) => c.ok)) {
      throw new Error(submitChecks.find((c) => !c.ok)?.message ?? 'Chưa đủ điều kiện submit HĐ');
    }
    if (!readiness.contract || readiness.contract.id !== contractId) throw new Error('HĐ không khớp lead');
    if (readiness.approval?.status === 'pending') throw new Error('Đã có yêu cầu duyệt đang chờ');

    const ts = this.ts();
    const insert = await this.db.query(
      `INSERT INTO crm_contract_approvals (contract_id, lead_id, status, requested_by, amount_vnd, notes, created_at)
       VALUES ($1, $2, 'pending', $3, $4, $5, $6::timestamptz)
       RETURNING *`,
      [contractId, leadId, actor, readiness.contract.amount_vnd, notes.slice(0, 4000), ts],
    );
    const approval = insert.rows[0] as Record<string, unknown>;
    const approvalId = Number(approval.id);
    await this.logContractEvent(this.db, contractId, 'submitted', actor, { approval_id: approvalId });
    return this.mapApproval(approval);
  }

  async listPendingApprovals(
    limit = 50,
  ): Promise<Array<ContractApprovalRow & { contract_title: string; lead_name: string }>> {
    const lim = Math.max(1, Math.min(limit, 200));
    const result = await this.db.query(
      `SELECT a.*, c.title AS contract_title, l.full_name AS lead_name
       FROM crm_contract_approvals a
       INNER JOIN crm_contracts c ON c.id = a.contract_id
       INNER JOIN crm_leads l ON l.sqlite_lead_id = a.lead_id
       WHERE a.status = 'pending'
       ORDER BY a.created_at ASC LIMIT $1`,
      [lim],
    );
    return result.rows.map((r) => ({
      ...this.mapApproval(r as Record<string, unknown>),
      contract_title: String((r as Record<string, unknown>).contract_title ?? ''),
      lead_name: String((r as Record<string, unknown>).lead_name ?? ''),
    }));
  }

  async listContractsByClient(clientId: string, limit = 50): Promise<ContractRow[]> {
    const lim = Math.max(1, Math.min(limit, 200));
    const result = await this.db.query(
      `SELECT * FROM crm_contracts WHERE agency_client_id = $1 ORDER BY updated_at DESC LIMIT $2`,
      [clientId.trim(), lim],
    );
    return result.rows.map((r) => this.mapContract(r as Record<string, unknown>));
  }

  async findLifecyclesByAgencyClientId(
    clientId: string,
    limit = 10,
  ): Promise<
    Array<{
      lifecycle_id: number;
      stage: string;
      status: string;
      service_slug: string;
      contract_id: number;
      contract_title: string;
      updated_at: string;
    }>
  > {
    const cid = clientId.trim();
    if (!cid) return [];
    try {
      const lim = Math.max(1, Math.min(limit, 50));
      const result = await this.db.query(
        `SELECT sl.id AS lifecycle_id, sl.stage, sl.status, sl.service_slug, sl.updated_at,
                ct.id AS contract_id, ct.title AS contract_title
         FROM crm_service_lifecycle sl
         INNER JOIN crm_contracts ct ON ct.id = sl.contract_id
         WHERE TRIM(COALESCE(ct.agency_client_id, '')) = $1
         ORDER BY sl.updated_at DESC
         LIMIT $2`,
        [cid, lim],
      );
      return result.rows.map((row) => ({
        lifecycle_id: Number((row as Record<string, unknown>).lifecycle_id),
        stage: String((row as Record<string, unknown>).stage ?? ''),
        status: String((row as Record<string, unknown>).status ?? ''),
        service_slug: String((row as Record<string, unknown>).service_slug ?? ''),
        contract_id: Number((row as Record<string, unknown>).contract_id),
        contract_title: String((row as Record<string, unknown>).contract_title ?? ''),
        updated_at: String((row as Record<string, unknown>).updated_at ?? ''),
      }));
    } catch {
      return [];
    }
  }

  async rejectApproval(approvalId: number, actor: string, decisionNotes: string): Promise<ContractApprovalRow> {
    const apprResult = await this.db.query(`SELECT * FROM crm_contract_approvals WHERE id = $1`, [approvalId]);
    const appr = apprResult.rows[0] as Record<string, unknown> | undefined;
    if (!appr || String(appr.status) !== 'pending') throw new Error('Yêu cầu không hợp lệ');
    const ts = this.ts();
    const updated = await this.db.query(
      `UPDATE crm_contract_approvals
       SET status = 'rejected', decided_by = $2, decision_notes = $3, decided_at = $4::timestamptz
       WHERE id = $1
       RETURNING *`,
      [approvalId, actor, decisionNotes.slice(0, 4000), ts],
    );
    await this.logContractEvent(this.db, Number(appr.contract_id), 'rejected', actor, { approval_id: approvalId });
    return this.mapApproval(updated.rows[0] as Record<string, unknown>);
  }

  async approveAndPromote(
    approvalId: number,
    actor: string,
  ): Promise<{
    approval: ContractApprovalRow;
    contract: ContractRow;
    lifecycle_id: number;
    customer_id: number;
    case_id: number | null;
  }> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const apprResult = await client.query(`SELECT * FROM crm_contract_approvals WHERE id = $1 FOR UPDATE`, [
        approvalId,
      ]);
      const appr = apprResult.rows[0] as Record<string, unknown> | undefined;
      if (!appr || String(appr.status) !== 'pending') throw new Error('Yêu cầu không hợp lệ');

      const contractId = Number(appr.contract_id);
      const leadId = Number(appr.lead_id);
      const ts = this.ts();

      let presalesSource: PresalesPromoteSource | undefined;
      if (this.funnelPg) {
        const ctx = await this.resolvePresalesContext(leadId);
        if (!ctx) throw new Error('Lead chưa có pre-sales');
        const plan = ctx.marketingPlan;
        if (!plan) throw new Error('Thiếu Kế hoạch MKT sơ bộ');
        const tasks = await this.funnelPg.getPresalesTasksForPromote(Number(ctx.row.id));
        presalesSource = {
          presalesId: Number(ctx.row.id),
          leadId,
          serviceSlug: String(ctx.row.service_slug ?? ''),
          assignedAm: ctx.row.assigned_am != null ? Number(ctx.row.assigned_am) : null,
          tasks,
          plan,
          alreadyConverted:
            ctx.presales.status === 'converted' && ctx.lifecycleId
              ? { lifecycle_id: ctx.lifecycleId }
              : undefined,
        };
      }

      const promote = await this.promoteUtil.run(client, contractId, leadId, actor, ts, presalesSource, {
        manageTransaction: false,
      });

      await client.query(
        `UPDATE crm_contract_approvals SET status = 'approved', decided_by = $2, decided_at = $3::timestamptz WHERE id = $1`,
        [approvalId, actor, ts],
      );
      await this.logContractEvent(client, contractId, 'approved', actor, { approval_id: approvalId });
      await this.logContractEvent(client, contractId, 'activated', actor, { lifecycle_id: promote.lifecycle_id });
      await this.logContractEvent(client, contractId, 'promoted', actor, promote);

      const approvalUpdated = await client.query(`SELECT * FROM crm_contract_approvals WHERE id = $1`, [approvalId]);
      const contractUpdated = await client.query(`SELECT * FROM crm_contracts WHERE id = $1`, [contractId]);

      await client.query('COMMIT');

      return {
        approval: this.mapApproval(approvalUpdated.rows[0] as Record<string, unknown>),
        contract: this.mapContract(contractUpdated.rows[0] as Record<string, unknown>),
        lifecycle_id: promote.lifecycle_id,
        customer_id: promote.customer_id,
        case_id: promote.case_id,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

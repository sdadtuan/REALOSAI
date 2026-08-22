import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import { LeadIngestRulesRepository } from '../leads/ingest/lead-ingest-rules.repository';
import type { LifecycleContextDto } from './lifecycle-context.util';
import {
  CreateServiceLifecycleBody,
  PatchServiceLifecycleBody,
  ServiceLifecycleEventRow,
  ServiceLifecycleRow,
} from './service-lifecycle.types';

@Injectable()
export class ServiceLifecyclePgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly ingestRules: LeadIngestRulesRepository,
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

  private mapLifecycleRow(row: Record<string, unknown>): ServiceLifecycleRow {
    return {
      id: Number(row.id),
      lead_id: row.lead_id != null ? Number(row.lead_id) : null,
      customer_id: row.customer_id != null ? Number(row.customer_id) : null,
      contract_id: row.contract_id != null ? Number(row.contract_id) : null,
      service_slug: String(row.service_slug ?? ''),
      stage: String(row.stage ?? ''),
      status: String(row.status ?? ''),
      sku_code: row.sku_code != null ? String(row.sku_code) : null,
      assigned_am: row.assigned_am != null ? Number(row.assigned_am) : null,
      assigned_sp: row.assigned_sp != null ? Number(row.assigned_sp) : null,
      stage_entered_at: row.stage_entered_at ? String(row.stage_entered_at) : '',
      notes: String(row.notes ?? ''),
      marketing_plan_id: row.marketing_plan_id != null ? Number(row.marketing_plan_id) : null,
      sop_run_id: row.sop_run_id != null ? Number(row.sop_run_id) : null,
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }


  async listLifecycles(opts: {
    serviceSlug?: string;
    amId?: number;
    includeDraft?: boolean;
  }): Promise<ServiceLifecycleRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (opts.includeDraft) {
      conditions.push("status IN ('active', 'draft')");
    } else {
      conditions.push("status = 'active'");
    }
    if (opts.serviceSlug) {
      params.push(opts.serviceSlug);
      conditions.push(`service_slug = $${params.length}`);
    }
    if (opts.amId) {
      params.push(opts.amId);
      conditions.push(`assigned_am = $${params.length}`);
    }
    const where = conditions.join(' AND ');
    const result = await this.db.query(
      `SELECT * FROM crm_service_lifecycle WHERE ${where} ORDER BY updated_at DESC`,
      params,
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => this.mapLifecycleRow(row));
  }

  async getLifecycleById(id: number): Promise<ServiceLifecycleRow | null> {
    const result = await this.db.query(
      `SELECT * FROM crm_service_lifecycle WHERE id = $1 OR sqlite_lifecycle_id = $1 LIMIT 1`,
      [id],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapLifecycleRow(row) : null;
  }

  async listEvents(lifecycleId: number): Promise<ServiceLifecycleEventRow[]> {
    const lc = await this.getLifecycleById(lifecycleId);
    if (!lc) return [];
    const result = await this.db.query(
      `SELECT * FROM crm_service_lifecycle_events
       WHERE lifecycle_id = $1 ORDER BY id ASC`,
      [lc.id],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      from_stage: row.from_stage != null ? String(row.from_stage) : null,
      to_stage: String(row.to_stage ?? ''),
      actor_id: row.actor_id != null ? Number(row.actor_id) : null,
      actor_type: String(row.actor_type ?? ''),
      notes: String(row.notes ?? ''),
      created_at: String(row.created_at ?? ''),
    }));
  }

  async leadOwnerStaffId(leadId: number | null): Promise<number | null> {
    if (!leadId) return null;
    const ownerResult = await this.db.query(
      `SELECT owner_id FROM crm_leads WHERE sqlite_lead_id = $1 LIMIT 1`,
      [leadId],
    );
    const ownerId = ownerResult.rows[0]?.owner_id;
    if (ownerId == null) return null;
    const sid = Number(ownerId);
    return (await this.ingestRules.staffExists(sid)) ? sid : null;
  }

  async createDraft(body: CreateServiceLifecycleBody): Promise<ServiceLifecycleRow> {
    const serviceSlug = String(body.service_slug ?? '').trim();
    let leadId: number | null = null;
    if (body.lead_id != null && body.lead_id !== 0) {
      const lid = Number(body.lead_id);
      if (Number.isFinite(lid) && lid > 0) leadId = lid;
    }
    let customerId: number | null = null;
    if (body.customer_id != null && body.customer_id !== 0) {
      const cid = Number(body.customer_id);
      if (Number.isFinite(cid) && cid > 0) customerId = cid;
    }
    const ownerId = await this.leadOwnerStaffId(leadId);
    const ts = catalogTs();
    const insert = await this.db.query(
      `INSERT INTO crm_service_lifecycle
         (lead_id, customer_id, service_slug, stage, status, assigned_am, stage_entered_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'lead', 'draft', $4, $5::timestamptz, $5::timestamptz, $5::timestamptz)
       RETURNING id`,
      [leadId, customerId, serviceSlug, ownerId, ts],
    );
    const lifecycleId = Number(insert.rows[0].id);
    await this.db.query(
      `INSERT INTO crm_service_lifecycle_events
         (lifecycle_id, from_stage, to_stage, actor_type, notes, created_at)
       VALUES ($1, NULL, 'lead', 'human', $2, $3::timestamptz)`,
      [lifecycleId, 'Draft tạo bởi human', ts],
    );
    const row = await this.getLifecycleById(lifecycleId);
    if (!row) throw new Error('Failed to create lifecycle');
    return row;
  }

  async setCommercialSku(lifecycleId: number, skuCode: string): Promise<void> {
    const sku = String(skuCode ?? '').trim().toUpperCase();
    if (!sku) return;
    await this.db.query(
      `UPDATE crm_service_lifecycle SET sku_code = $2, updated_at = NOW() WHERE id = $1`,
      [lifecycleId, sku],
    );
  }

  async patchLifecycle(id: number, body: PatchServiceLifecycleBody): Promise<ServiceLifecycleRow | null> {
    const existing = await this.getLifecycleById(id);
    if (!existing) return null;
    const ts = catalogTs();
    let stage = existing.stage;
    let notes = existing.notes;
    let serviceSlug = existing.service_slug;

    if ('service_slug' in body && body.service_slug != null) {
      serviceSlug = String(body.service_slug).trim();
    }
    if ('notes' in body && typeof body.notes === 'string') {
      notes = body.notes.trim().slice(0, 2000);
    }

    if ('stage' in body && body.stage != null) {
      const toStage = String(body.stage).trim();
      const fromStage = existing.stage;
      if (toStage !== fromStage) {
        stage = toStage;
        await this.db.query(
          `UPDATE crm_service_lifecycle
           SET stage = $2, stage_entered_at = $3::timestamptz, updated_at = $3::timestamptz,
               service_slug = $4, notes = $5
           WHERE id = $1`,
          [existing.id, stage, ts, serviceSlug, notes],
        );
        await this.db.query(
          `INSERT INTO crm_service_lifecycle_events
             (lifecycle_id, from_stage, to_stage, actor_type, notes, created_at)
           VALUES ($1, $2, $3, 'human', $4, $5::timestamptz)`,
          [existing.id, fromStage, toStage, notes, ts],
        );
      } else {
        await this.db.query(
          `UPDATE crm_service_lifecycle
           SET updated_at = $2::timestamptz, service_slug = $3, notes = $4
           WHERE id = $1`,
          [existing.id, ts, serviceSlug, notes],
        );
      }
    } else {
      let assignedAm = existing.assigned_am;
      let assignedSp = existing.assigned_sp;
      if ('assigned_am' in body) {
        assignedAm =
          body.assigned_am != null && Number(body.assigned_am) > 0 ? Number(body.assigned_am) : null;
      }
      if ('assigned_sp' in body) {
        assignedSp =
          body.assigned_sp != null && Number(body.assigned_sp) > 0 ? Number(body.assigned_sp) : null;
      }
      await this.db.query(
        `UPDATE crm_service_lifecycle
         SET updated_at = $2::timestamptz, service_slug = $3, notes = $4, assigned_am = $5, assigned_sp = $6
         WHERE id = $1`,
        [existing.id, ts, serviceSlug, notes, assignedAm, assignedSp],
      );
    }
    return this.getLifecycleById(existing.id);
  }

  async advanceStage(
    id: number,
    toStage: string,
    notes: string,
    actorType = 'human',
  ): Promise<ServiceLifecycleRow | null> {
    const existing = await this.getLifecycleById(id);
    if (!existing) return null;
    const ts = catalogTs();
    const fromStage = existing.stage;
    await this.db.query(
      `UPDATE crm_service_lifecycle
       SET stage = $2, stage_entered_at = $3::timestamptz, updated_at = $3::timestamptz, notes = $4
       WHERE id = $1`,
      [existing.id, toStage, ts, notes],
    );
    await this.db.query(
      `INSERT INTO crm_service_lifecycle_events
         (lifecycle_id, from_stage, to_stage, actor_type, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::timestamptz)`,
      [existing.id, fromStage, toStage, actorType, notes, ts],
    );
    return this.getLifecycleById(existing.id);
  }

  async getOfficialMarketingPlan(lifecycleId: number): Promise<Record<string, unknown> | null> {
    const lc = await this.getLifecycleById(lifecycleId);
    if (!lc?.marketing_plan_id) return null;
    const result = await this.db.query(`SELECT * FROM crm_marketing_plans WHERE id = $1`, [
      lc.marketing_plan_id,
    ]);
    return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
  }

  async updateOfficialMarketingPlan(
    planId: number,
    patch: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const ts = catalogTs();
    const sets: string[] = ['updated_at = $1'];
    const params: unknown[] = [ts];
    if (patch.north_star != null) {
      params.push(String(patch.north_star).slice(0, 4000));
      sets.push(`north_star = $${params.length}`);
    }
    if (patch.objectives != null) {
      params.push(String(patch.objectives).slice(0, 4000));
      sets.push(`objectives = $${params.length}`);
    }
    if (patch.strategy_framework_json != null) {
      params.push(String(patch.strategy_framework_json));
      sets.push(`strategy_framework_json = $${params.length}::jsonb`);
    }
    if (patch.target_market_prof_json != null) {
      params.push(String(patch.target_market_prof_json));
      sets.push(`target_market_prof_json = $${params.length}::jsonb`);
    }
    params.push(planId);
    await this.db.query(
      `UPDATE crm_marketing_plans SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    );
    const result = await this.db.query(`SELECT * FROM crm_marketing_plans WHERE id = $1`, [planId]);
    return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
  }

  async funnelStats(): Promise<Record<string, number>> {
    const result = await this.db.query(
      `SELECT stage, COUNT(*)::int AS c FROM crm_service_lifecycle
       WHERE status = 'active' GROUP BY stage`,
    );
    const out: Record<string, number> = {};
    for (const row of result.rows as Array<{ stage: string; c: number }>) {
      out[String(row.stage)] = Number(row.c);
    }
    return out;
  }

  async findOnboardLifecycleByAgencyClientId(clientId: string): Promise<{ lifecycle_id: number } | null> {
    const result = await this.db.query(
      `SELECT sl.id AS lifecycle_id
       FROM crm_service_lifecycle sl
       INNER JOIN crm_contracts ct ON ct.id = sl.contract_id
       WHERE sl.status = 'active'
         AND sl.stage = 'onboard'
         AND TRIM(COALESCE(ct.agency_client_id, '')) = $1
       ORDER BY sl.updated_at DESC
       LIMIT 1`,
      [clientId.trim()],
    );
    const row = result.rows[0] as { lifecycle_id: number } | undefined;
    return row ? { lifecycle_id: Number(row.lifecycle_id) } : null;
  }

  async findPrimaryLifecycleByAgencyClientId(
    clientId: string,
  ): Promise<{ lifecycle_id: number; service_slug: string; stage: string } | null> {
    const result = await this.db.query(
      `SELECT sl.id AS lifecycle_id, sl.service_slug, sl.stage
       FROM crm_service_lifecycle sl
       INNER JOIN crm_contracts ct ON ct.id = sl.contract_id
       WHERE sl.status = 'active'
         AND sl.stage IN ('onboard', 'deliver', 'retain')
         AND TRIM(COALESCE(ct.agency_client_id, '')) = $1
       ORDER BY CASE sl.stage
                  WHEN 'deliver' THEN 0
                  WHEN 'onboard' THEN 1
                  ELSE 2
                END,
                sl.updated_at DESC
       LIMIT 1`,
      [clientId.trim()],
    );
    const row = result.rows[0] as
      | { lifecycle_id: number; service_slug: string; stage: string }
      | undefined;
    if (!row) return null;
    return {
      lifecycle_id: Number(row.lifecycle_id),
      service_slug: String(row.service_slug ?? '').trim(),
      stage: String(row.stage ?? '').trim(),
    };
  }

  async buildLaunchQaLifecycleIndex(): Promise<Map<string, number>> {
    const index = new Map<string, number>();
    try {
      const result = await this.db.query(
        `SELECT sl.id AS lifecycle_id, ct.agency_client_id, camp.code AS campaign_code
         FROM crm_service_lifecycle sl
         INNER JOIN crm_contracts ct ON ct.id = sl.contract_id
         INNER JOIN crm_campaigns camp ON camp.id = ct.campaign_id
         WHERE sl.status = 'active'
           AND TRIM(COALESCE(ct.agency_client_id, '')) != ''
           AND TRIM(COALESCE(camp.code, '')) != ''`,
      );
      for (const row of result.rows as Array<{
        lifecycle_id: number;
        agency_client_id: string;
        campaign_code: string;
      }>) {
        const clientId = String(row.agency_client_id ?? '').trim();
        const code = String(row.campaign_code ?? '').trim();
        if (!clientId || !code) continue;
        const key = `${clientId}:${code}`;
        if (!index.has(key)) index.set(key, Number(row.lifecycle_id));
      }
    } catch {
      /* crm_campaigns optional */
    }
    return index;
  }

  async getLifecycleContext(lifecycleId: number): Promise<LifecycleContextDto | null> {
    const lc = await this.getLifecycleById(lifecycleId);
    if (!lc) return null;

    let leadFullName = '';
    let ownerId: number | null = null;
    if (lc.lead_id) {
      const leadResult = await this.db.query(
        `SELECT full_name, owner_id FROM crm_leads WHERE sqlite_lead_id = $1 LIMIT 1`,
        [lc.lead_id],
      );
      const lead = leadResult.rows[0] as { full_name: string; owner_id: number | null } | undefined;
      if (lead) {
        leadFullName = String(lead.full_name ?? '');
        ownerId = lead.owner_id != null ? Number(lead.owner_id) : null;
      }
    }

    let presalesId: number | null = null;
    let assignedSp: number | null = null;
    if (lc.lead_id) {
      const psResult = await this.db.query(
        `SELECT id, assigned_sp FROM crm_lead_presales WHERE lead_id = $1 LIMIT 1`,
        [lc.lead_id],
      );
      const ps = psResult.rows[0] as { id: number; assigned_sp: number | null } | undefined;
      if (ps) {
        presalesId = Number(ps.id);
        assignedSp = ps.assigned_sp != null ? Number(ps.assigned_sp) : null;
      }
    }

    let contractTitle = '';
    let contractAmount = 0;
    let agencyClientId = '';
    let campaignId: number | null = null;
    if (lc.contract_id) {
      const ctResult = await this.db.query(
        `SELECT title, amount_vnd, agency_client_id, campaign_id FROM crm_contracts WHERE id = $1 LIMIT 1`,
        [lc.contract_id],
      );
      const ct = ctResult.rows[0] as Record<string, unknown> | undefined;
      if (ct) {
        contractTitle = String(ct.title ?? '');
        contractAmount = Number(ct.amount_vnd ?? 0);
        agencyClientId = String(ct.agency_client_id ?? '').trim();
        campaignId = ct.campaign_id != null ? Number(ct.campaign_id) : null;
      }
    }

    let campaignName = '';
    let campaignCode = '';
    if (campaignId) {
      try {
        const campResult = await this.db.query(
          `SELECT name, code FROM crm_campaigns WHERE id = $1 LIMIT 1`,
          [campaignId],
        );
        const camp = campResult.rows[0] as { name: string; code: string } | undefined;
        if (camp) {
          campaignName = String(camp.name ?? '');
          campaignCode = String(camp.code ?? '');
        }
      } catch {
        /* optional */
      }
    }

    const agencyLink = agencyClientId
      ? `/agency/clients/${encodeURIComponent(agencyClientId)}?tab=checklist`
      : null;
    const hubLink = agencyClientId
      ? `/crm/hub?client_id=${encodeURIComponent(agencyClientId)}`
      : null;

    return {
      lifecycle_id: lc.id,
      lead_id: lc.lead_id,
      customer_id: lc.customer_id,
      contract_id: lc.contract_id,
      service_slug: lc.service_slug,
      stage: lc.stage,
      status: lc.status,
      lead: {
        id: lc.lead_id,
        full_name: leadFullName,
        owner_id: ownerId,
        owner_name: ownerId ? await this.ingestRules.staffName(ownerId) : '',
      },
      presales: {
        id: presalesId,
        assigned_sp: assignedSp,
        assigned_sp_name: assignedSp ? await this.ingestRules.staffName(assignedSp) : '',
      },
      contract: {
        id: lc.contract_id,
        title: contractTitle,
        amount_vnd: contractAmount,
        agency_client_id: agencyClientId,
        campaign_id: campaignId,
      },
      campaign: {
        id: campaignId,
        name: campaignName,
        code: campaignCode,
      },
      links: {
        service_delivery: `/crm/service-delivery/${lc.id}`,
        lead: lc.lead_id ? `/crm/leads/${lc.lead_id}` : null,
        agency_client: agencyLink,
        hub: hubLink,
      },
    };
  }

  async createExpense(
    lifecycleId: number,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const lc = await this.getLifecycleById(lifecycleId);
    if (!lc) throw new Error('Không tìm thấy lifecycle');
    const ts = catalogTs();
    const title = String(body.title ?? '').trim().slice(0, 240);
    const category = String(body.category ?? 'khac').trim().slice(0, 80);
    const amountVnd = Math.max(0, Number(body.amount_vnd ?? 0));
    const expenseOn = String(body.expense_on ?? ts.slice(0, 10)).slice(0, 10);
    const notes = String(body.notes ?? '').trim().slice(0, 2000);
    const result = await this.db.query(
      `INSERT INTO crm_svc_expenses
         (lifecycle_id, title, category, amount_vnd, expense_on, notes, cost_phase, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'delivery', $7::timestamptz, $7::timestamptz)
       RETURNING id`,
      [lc.id, title, category, amountVnd, expenseOn, notes, ts],
    );
    const id = Number(result.rows[0]?.id);
    return { id, lifecycle_id: lc.id, title, category, amount_vnd: amountVnd, expense_on: expenseOn, notes };
  }

  async presalesSummary(lifecycleId: number): Promise<Record<string, unknown>> {
    const lc = await this.getLifecycleById(lifecycleId);
    if (!lc) return { lifecycle_id: lifecycleId, presales_expenses: [], delivery_expenses: [] };
    const result = await this.db.query(
      `SELECT id, title, category, amount_vnd, expense_on, cost_phase, notes
       FROM crm_svc_expenses WHERE lifecycle_id = $1 ORDER BY expense_on DESC, id DESC`,
      [lc.id],
    );
    const rows = result.rows as Array<Record<string, unknown>>;
    const presales = rows.filter((row) => String(row.cost_phase) === 'presales');
    const delivery = rows.filter((row) => String(row.cost_phase) !== 'presales');
    const sum = (arr: Array<Record<string, unknown>>) =>
      arr.reduce((acc, row) => acc + Number(row.amount_vnd ?? 0), 0);
    return {
      lifecycle_id: lc.id,
      presales_expenses: presales,
      delivery_expenses: delivery,
      presales_total_vnd: sum(presales),
      delivery_total_vnd: sum(delivery),
    };
  }
}

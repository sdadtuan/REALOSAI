import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import { mapPlanRow } from './marketing-plans-pg.mapper';
import {
  CreateMarketingPlanBody,
  MarketingPlanCampaignRow,
  MarketingPlanMilestoneRow,
  MarketingPlanRow,
  normalizeMarketingPlanPriority,
  normalizeMarketingPlanStatus,
  PatchMarketingPlanBody,
} from './marketing-plans.types';

const PLAN_LIST_SELECT = `
SELECT p.*,
       st.name AS owner_name,
       (SELECT COUNT(*) FROM crm_marketing_plan_campaigns mpc WHERE mpc.plan_id = p.id)
         AS linked_campaign_count,
       (SELECT COUNT(*) FROM crm_marketing_plan_milestones mm WHERE mm.plan_id = p.id)
         AS milestone_total,
       (SELECT COUNT(*) FROM crm_marketing_plan_milestones mm
        WHERE mm.plan_id = p.id AND mm.status = 'done') AS milestone_done
FROM crm_marketing_plans_official p
LEFT JOIN crm_staff st ON st.id = p.owner_staff_id
`;

const PLAN_DETAIL_SELECT = `
SELECT p.*, st.name AS owner_name
FROM crm_marketing_plans_official p
LEFT JOIN crm_staff st ON st.id = p.owner_staff_id
`;

function formatTs(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').slice(0, 19);
  }
  const s = String(value ?? '');
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return s.replace('T', ' ').slice(0, 19);
  }
  return s;
}

@Injectable()
export class MarketingPlansPgRepository implements OnModuleDestroy {
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

  private async resolvePlanPgId(
    legacyId: number,
  ): Promise<{ pgId: number; legacyId: number } | null> {
    const result = await this.db.query(
      `SELECT id, sqlite_plan_id FROM crm_marketing_plans_official
       WHERE sqlite_plan_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_plan_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [legacyId],
    );
    const row = result.rows[0] as { id?: unknown; sqlite_plan_id?: unknown } | undefined;
    if (!row?.id) return null;
    const pgId = Number(row.id);
    const resolvedLegacyId = Number(row.sqlite_plan_id ?? row.id);
    return { pgId, legacyId: resolvedLegacyId };
  }

  async listPlans(opts: {
    fiscalYear?: number;
    status?: string;
    q?: string;
  }): Promise<MarketingPlanRow[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (opts.fiscalYear != null) {
      clauses.push(`p.fiscal_year = $${paramIdx++}`);
      params.push(opts.fiscalYear);
    }
    if (opts.status && opts.status !== 'all') {
      clauses.push(`p.status = $${paramIdx++}`);
      params.push(opts.status);
    }
    if (opts.q) {
      clauses.push(
        `(lower(p.name) LIKE $${paramIdx} OR lower(p.code) LIKE $${paramIdx + 1} OR lower(p.period_label) LIKE $${paramIdx + 2})`,
      );
      const like = `%${opts.q}%`;
      params.push(like, like, like);
      paramIdx += 3;
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.db.query(
      `${PLAN_LIST_SELECT}
       ${whereSql}
       ORDER BY p.fiscal_year DESC, p.updated_at DESC, p.id DESC
       LIMIT 300`,
      params,
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => mapPlanRow(row));
  }

  async getPlanById(planId: number): Promise<MarketingPlanRow | null> {
    const result = await this.db.query(
      `${PLAN_DETAIL_SELECT}
       WHERE p.sqlite_plan_id = $1 OR p.id = $1
       ORDER BY CASE WHEN p.sqlite_plan_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [planId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapPlanRow(row) : null;
  }

  async listMilestones(planId: number): Promise<MarketingPlanMilestoneRow[]> {
    const resolved = await this.resolvePlanPgId(planId);
    if (!resolved) return [];
    const { pgId, legacyId } = resolved;

    const result = await this.db.query(
      `SELECT * FROM crm_marketing_plan_milestones
       WHERE plan_id = $1
       ORDER BY position ASC, id ASC`,
      [pgId],
    );
    return (result.rows as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.sqlite_milestone_id ?? r.id),
      plan_id: legacyId,
      position: Number(r.position ?? 0),
      title: String(r.title ?? ''),
      description: String(r.description ?? ''),
      due_date: String(r.due_date ?? ''),
      status: String(r.status ?? ''),
      owner_staff_id: r.owner_staff_id != null ? Number(r.owner_staff_id) : null,
      notes: String(r.notes ?? ''),
      created_at: formatTs(r.created_at),
      updated_at: formatTs(r.updated_at),
    }));
  }

  async listCampaigns(planId: number): Promise<MarketingPlanCampaignRow[]> {
    const resolved = await this.resolvePlanPgId(planId);
    if (!resolved) return [];
    const { pgId } = resolved;

    try {
      const result = await this.db.query(
        `SELECT c.*
         FROM crm_marketing_plan_campaigns l
         JOIN crm_campaigns c ON c.id = l.campaign_id
         WHERE l.plan_id = $1
         ORDER BY c.name ASC`,
        [pgId],
      );
      return (result.rows as Array<Record<string, unknown>>).map((r) => ({
        id: Number(r.id),
        name: String(r.name ?? ''),
        code: String(r.code ?? ''),
        status: String(r.status ?? ''),
        channel: String(r.channel ?? ''),
        ...r,
      }));
    } catch {
      try {
        const result = await this.db.query(
          `SELECT l.campaign_id
           FROM crm_marketing_plan_campaigns l
           WHERE l.plan_id = $1
           ORDER BY l.campaign_id ASC`,
          [pgId],
        );
        return (result.rows as Array<{ campaign_id: unknown }>).map((r) => ({
          id: Number(r.campaign_id),
          name: '',
          code: '',
          status: '',
          channel: '',
        }));
      } catch {
        return [];
      }
    }
  }

  async createPlan(body: CreateMarketingPlanBody): Promise<MarketingPlanRow> {
    const name = String(body.name ?? '').trim().slice(0, 400);
    const code = String(body.code ?? '').trim().slice(0, 64);
    const status = normalizeMarketingPlanStatus(body.status);
    const priority = normalizeMarketingPlanPriority(body.priority);
    const now = new Date();
    let fiscalYear = Number(body.fiscal_year ?? now.getFullYear());
    if (!Number.isFinite(fiscalYear)) fiscalYear = now.getFullYear();
    fiscalYear = Math.max(1990, Math.min(2120, fiscalYear));

    const periodLabel = String(body.period_label ?? '').trim().slice(0, 120);
    const northStar = String(body.north_star ?? '').trim().slice(0, 2000);
    const objectives = String(body.objectives ?? '').trim().slice(0, 32000);
    const audiences = String(body.audiences ?? '').trim().slice(0, 32000);
    const risksNotes = String(body.risks_notes ?? '').trim().slice(0, 32000);
    const notes = String(body.notes ?? '').trim().slice(0, 32000);
    const startDate = String(body.start_date ?? '').trim().slice(0, 32);
    const endDate = String(body.end_date ?? '').trim().slice(0, 32);

    let budgetPlanned = Number(body.budget_planned_vnd ?? 0);
    if (!Number.isFinite(budgetPlanned)) budgetPlanned = 0;
    budgetPlanned = Math.max(0, Math.min(budgetPlanned, 9_999_999_999_999));

    let budgetActual = Number(body.budget_actual_vnd ?? 0);
    if (!Number.isFinite(budgetActual)) budgetActual = 0;
    budgetActual = Math.max(0, Math.min(budgetActual, 9_999_999_999_999));

    let ownerId: number | null = null;
    if (body.owner_staff_id != null && body.owner_staff_id !== 0) {
      const oid = Number(body.owner_staff_id);
      if (Number.isFinite(oid) && oid > 0) {
        const staffResult = await this.db.query(`SELECT id FROM crm_staff WHERE id = $1 LIMIT 1`, [
          oid,
        ]);
        if (staffResult.rows[0]) ownerId = oid;
      }
    }

    const tsDate = now.toISOString().slice(0, 10);
    const ts = catalogTs();

    const result = await this.db.query(
      `INSERT INTO crm_marketing_plans_official (
         code, name, status, priority, fiscal_year, period_label, north_star, objectives,
         pillars_json, audiences, channels_focus_json, budget_planned_vnd, budget_actual_vnd,
         success_metrics_json, risks_notes, owner_staff_id, start_date, end_date, notes,
         strategy_framework_json, target_market_prof_json, target_market_steps4_json,
         khtn_market_research_json, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, '[]', $9, '[]', $10, $11, '[]', $12, $13, $14, $15, $16,
         '{}', '{}', '{}', '{}', $17, $18
       ) RETURNING id`,
      [
        code,
        name,
        status,
        priority,
        fiscalYear,
        periodLabel,
        northStar,
        objectives,
        audiences,
        budgetPlanned,
        budgetActual,
        risksNotes,
        ownerId,
        startDate,
        endDate,
        notes,
        tsDate,
        ts,
      ],
    );

    const pgId = Number((result.rows[0] as { id: unknown }).id);
    const plan = await this.getPlanById(pgId);
    if (!plan) throw new Error('Failed to create marketing plan');
    return plan;
  }

  async patchPlan(planId: number, body: PatchMarketingPlanBody): Promise<MarketingPlanRow | null> {
    const resolved = await this.resolvePlanPgId(planId);
    if (!resolved) return null;
    const { pgId } = resolved;

    const existingResult = await this.db.query(
      `SELECT * FROM crm_marketing_plans_official WHERE id = $1`,
      [pgId],
    );
    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return null;

    const merged: Record<string, unknown> = { ...existing };
    if ('name' in body && typeof body.name === 'string') {
      merged.name = body.name.trim().slice(0, 400);
    }
    if ('status' in body) {
      merged.status = normalizeMarketingPlanStatus(body.status);
    }
    if ('priority' in body) {
      merged.priority = normalizeMarketingPlanPriority(body.priority);
    }
    if ('notes' in body && typeof body.notes === 'string') {
      merged.notes = body.notes.trim().slice(0, 32000);
    }
    if ('objectives' in body && typeof body.objectives === 'string') {
      merged.objectives = body.objectives.trim().slice(0, 32000);
    }
    if ('khtn_market_research_json' in body && typeof body.khtn_market_research_json === 'string') {
      merged.khtn_market_research_json = body.khtn_market_research_json;
    }

    const ts = catalogTs();
    await this.db.query(
      `UPDATE crm_marketing_plans_official
       SET name = $1, status = $2, priority = $3, notes = $4, objectives = $5,
           khtn_market_research_json = $6, updated_at = $7
       WHERE id = $8`,
      [
        String(merged.name ?? ''),
        String(merged.status ?? ''),
        String(merged.priority ?? ''),
        String(merged.notes ?? ''),
        String(merged.objectives ?? ''),
        String(merged.khtn_market_research_json ?? '{}'),
        ts,
        pgId,
      ],
    );

    return this.getPlanById(planId);
  }
}

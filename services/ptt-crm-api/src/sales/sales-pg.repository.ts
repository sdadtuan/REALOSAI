import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import { CrmConfigService } from '../crm-config/crm-config.service';
import {
  computeFunnelStats,
  normalizePipelineStage,
  pipelineStageLabel,
} from './sales-pipeline.util';
import {
  CreateMarketBody,
  CreatePartnerBody,
  CreateSalesPlanBody,
  CreateTrainingBody,
  FunnelStats,
  PipelineCaseRow,
  SALES_PLAN_STATUS_LABELS,
  SalesMarketRow,
  SalesPartnerRow,
  SalesPlanRow,
  SalesReportResponse,
  SalesSummaryResponse,
  SalesTrainingRow,
  SalesTransactionRow,
  normalizeSalesPlanStatus,
} from './sales.types';

const PARTNER_TYPE_LABELS: Record<string, string> = {
  dai_ly: 'Đại lý',
  ctv: 'Cộng tác viên',
  doi_tac: 'Đối tác',
};

const PARTNER_STATUS_LABELS: Record<string, string> = {
  active: 'Hoạt động',
  inactive: 'Ngưng',
  pending: 'Chờ duyệt',
};

const TRAINING_STATUS_LABELS: Record<string, string> = {
  planned: 'Dự kiến',
  done: 'Đã tổ chức',
  cancelled: 'Hủy',
};

const MARKET_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  published: 'Đã ban hành',
  archived: 'Lưu trữ',
};

const TX_TYPE_LABELS: Record<string, string> = {
  ban: 'Bán',
  mua: 'Mua',
  cho_thue: 'Cho thuê',
};

const TX_STAGE_LABELS: Record<string, string> = {
  tu_van: 'Tư vấn',
  dam_phan: 'Đàm phán',
  hop_dong: 'Hợp đồng',
  thu_tuc: 'Thủ tục',
  hoan_tat: 'Hoàn tất',
};

@Injectable()
export class SalesPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly crmConfig: CrmConfigService,
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

  async computeFunnel(): Promise<FunnelStats> {
    const result = await this.db.query(
      `SELECT COALESCE(c.sqlite_case_id, c.id) AS id, c.pipeline_stage, c.stage_entered_at,
              c.status, c.channel, c.priority, c.assigned_staff_id, c.lead_source,
              c.deal_value_vnd, c.created_at, st.name AS staff_name
       FROM crm_cases c
       LEFT JOIN crm_staff st ON st.id = c.assigned_staff_id`,
    );
    const runtime = await this.crmConfig.resolvePipelineRuntime();
    return computeFunnelStats(result.rows as Array<Record<string, unknown>>, runtime);
  }

  async fetchSummary(): Promise<SalesSummaryResponse> {
    const funnel = await this.computeFunnel();
    const planResult = await this.db.query(
      `SELECT * FROM crm_sales_plans
       WHERE status = 'active'
       ORDER BY fiscal_year DESC, id DESC LIMIT 1`,
    );
    const planRow = planResult.rows[0] as Record<string, unknown> | undefined;
    let activePlan: SalesPlanRow | null = null;
    if (planRow) {
      activePlan = this.mapPlanRow(planRow);
      const tgtResult = await this.db.query(
        `SELECT COALESCE(SUM(target_value), 0) AS t, COALESCE(SUM(actual_value), 0) AS a
         FROM crm_sales_targets WHERE plan_id = $1`,
        [planRow.id],
      );
      const tgt = tgtResult.rows[0] as { t?: unknown; a?: unknown };
      activePlan.targets_sum = Number(tgt?.t ?? 0);
      activePlan.actuals_sum = Number(tgt?.a ?? 0);
      const rev = activePlan.revenue_target_vnd;
      const won = funnel.totals.won;
      activePlan.revenue_progress_pct =
        rev > 0 ? Math.round((100 * won) / rev * 10) / 10 : null;
    }

    const count = async (sql: string, params: unknown[] = []): Promise<number> => {
      const r = await this.db.query(sql, params);
      return Number((r.rows[0] as { n?: unknown })?.n ?? 0);
    };

    const pipelineConfig = await this.crmConfig.resolveSalesPipelineConfig();
    return {
      funnel,
      active_plan: activePlan,
      counts: {
        partners_active: await count(
          "SELECT COUNT(*) AS n FROM crm_sales_partners WHERE status = 'active'",
        ),
        transactions_open: await count(
          "SELECT COUNT(*) AS n FROM crm_sales_transactions WHERE stage NOT IN ('hoan_tat')",
        ),
        trainings_upcoming: await count(
          "SELECT COUNT(*) AS n FROM crm_sales_trainings WHERE status = 'planned' AND training_date >= CURRENT_DATE::text",
        ),
        market_reports: await count(
          "SELECT COUNT(*) AS n FROM crm_sales_market_research WHERE status = 'published'",
        ),
        kd_staff: await count(
          `SELECT COUNT(*) AS n FROM crm_staff st
           JOIN crm_departments d ON d.id = st.department_id
           WHERE st.active = TRUE AND (lower(d.code) = 'kd' OR d.name LIKE '%kinh doanh%')`,
        ),
      },
      pipeline_labels: pipelineConfig.labels,
      pipeline_stages: [...pipelineConfig.stage_keys],
    };
  }

  async listPlans(): Promise<SalesPlanRow[]> {
    const result = await this.db.query(
      `SELECT * FROM crm_sales_plans ORDER BY fiscal_year DESC, id DESC`,
    );
    return result.rows.map((r) => this.mapPlanRow(r as Record<string, unknown>));
  }

  async createPlan(body: CreateSalesPlanBody): Promise<SalesPlanRow> {
    const title = String(body.title ?? '').trim().slice(0, 400);
    const now = new Date();
    let fiscalYear = Number(body.fiscal_year ?? now.getFullYear());
    if (!Number.isFinite(fiscalYear)) fiscalYear = now.getFullYear();
    fiscalYear = Math.max(1990, Math.min(2120, fiscalYear));
    const periodStart = String(body.period_start ?? '').trim().slice(0, 10);
    const periodEnd = String(body.period_end ?? '').trim().slice(0, 10);
    let revenueTarget = Number(body.revenue_target_vnd ?? 0);
    if (!Number.isFinite(revenueTarget)) revenueTarget = 0;
    revenueTarget = Math.max(0, Math.min(revenueTarget, 9_999_999_999_999));
    const status = normalizeSalesPlanStatus(body.status);
    const summary = String(body.summary ?? '').trim().slice(0, 4000);
    const strategyNotes = String(body.strategy_notes ?? '').trim().slice(0, 8000);
    const ts = catalogTs();
    const insert = await this.db.query(
      `INSERT INTO crm_sales_plans (
         title, fiscal_year, period_start, period_end, revenue_target_vnd,
         status, summary, strategy_notes, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [title, fiscalYear, periodStart, periodEnd, revenueTarget, status, summary, strategyNotes, ts, ts],
    );
    const planId = Number((insert.rows[0] as { id: unknown }).id);
    const plan = await this.getPlanById(planId);
    if (!plan) throw new Error('Failed to create sales plan');
    return plan;
  }

  async listPartners(q = ''): Promise<SalesPartnerRow[]> {
    const like = `%${String(q).trim()}%`;
    const result = q.trim()
      ? await this.db.query(
          `SELECT p.*, st.name AS assigned_staff_name
           FROM crm_sales_partners p
           LEFT JOIN crm_staff st ON st.id = p.assigned_staff_id
           WHERE p.name ILIKE $1 OR p.phone ILIKE $1 OR p.company ILIKE $1
           ORDER BY (p.status = 'active') DESC, p.name`,
          [like],
        )
      : await this.db.query(
          `SELECT p.*, st.name AS assigned_staff_name
           FROM crm_sales_partners p
           LEFT JOIN crm_staff st ON st.id = p.assigned_staff_id
           ORDER BY (p.status = 'active') DESC, p.name`,
        );
    return result.rows.map((r) => this.mapPartnerRow(r as Record<string, unknown>));
  }

  async createPartner(body: CreatePartnerBody): Promise<{ id: number }> {
    const name = String(body.name ?? '').trim().slice(0, 240);
    const ts = catalogTs();
    const insert = await this.db.query(
      `INSERT INTO crm_sales_partners (
         partner_type, name, phone, email, company, territory,
         commission_pct, status, assigned_staff_id, notes, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, sqlite_partner_id`,
      [
        String(body.partner_type ?? 'ctv').slice(0, 32),
        name,
        String(body.phone ?? '').slice(0, 64),
        String(body.email ?? '').slice(0, 240),
        String(body.company ?? '').slice(0, 240),
        String(body.territory ?? '').slice(0, 240),
        body.commission_pct != null && Number.isFinite(Number(body.commission_pct))
          ? Number(body.commission_pct)
          : null,
        String(body.status ?? 'active').slice(0, 32),
        body.assigned_staff_id != null ? Number(body.assigned_staff_id) : null,
        String(body.notes ?? '').slice(0, 2000),
        ts,
        ts,
      ],
    );
    const row = insert.rows[0] as { id: unknown; sqlite_partner_id?: unknown };
    return { id: Number(row.sqlite_partner_id ?? row.id) };
  }

  async listTrainings(): Promise<SalesTrainingRow[]> {
    const result = await this.db.query(
      `SELECT * FROM crm_sales_trainings ORDER BY training_date DESC, id DESC`,
    );
    return result.rows.map((r) => this.mapTrainingRow(r as Record<string, unknown>));
  }

  async createTraining(body: CreateTrainingBody): Promise<{ id: number }> {
    const title = String(body.title ?? '').trim().slice(0, 400);
    const ts = catalogTs();
    const insert = await this.db.query(
      `INSERT INTO crm_sales_trainings (
         title, training_date, trainer_name, topic, content_summary,
         materials_url, attendee_staff_ids, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, '[]'::jsonb, $7, $8, $9)
       RETURNING id, sqlite_training_id`,
      [
        title,
        String(body.training_date ?? '').slice(0, 10),
        String(body.trainer_name ?? '').slice(0, 240),
        String(body.topic ?? '').slice(0, 400),
        String(body.content_summary ?? '').slice(0, 8000),
        String(body.materials_url ?? '').slice(0, 500),
        String(body.status ?? 'planned').slice(0, 32),
        ts,
        ts,
      ],
    );
    const row = insert.rows[0] as { id: unknown; sqlite_training_id?: unknown };
    return { id: Number(row.sqlite_training_id ?? row.id) };
  }

  async listMarketResearch(): Promise<SalesMarketRow[]> {
    const result = await this.db.query(
      `SELECT * FROM crm_sales_market_research ORDER BY research_date DESC, id DESC`,
    );
    return result.rows.map((r) => this.mapMarketRow(r as Record<string, unknown>));
  }

  async createMarketResearch(body: CreateMarketBody): Promise<{ id: number }> {
    const title = String(body.title ?? '').trim().slice(0, 400);
    const ts = catalogTs();
    const insert = await this.db.query(
      `INSERT INTO crm_sales_market_research (
         title, research_date, area, property_type, competitor_notes,
         price_analysis, strategy_proposal, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, sqlite_research_id`,
      [
        title,
        String(body.research_date ?? '').slice(0, 10),
        String(body.area ?? '').slice(0, 240),
        String(body.property_type ?? '').slice(0, 240),
        String(body.competitor_notes ?? '').slice(0, 8000),
        String(body.price_analysis ?? '').slice(0, 8000),
        String(body.strategy_proposal ?? '').slice(0, 8000),
        String(body.status ?? 'draft').slice(0, 32),
        ts,
        ts,
      ],
    );
    const row = insert.rows[0] as { id: unknown; sqlite_research_id?: unknown };
    return { id: Number(row.sqlite_research_id ?? row.id) };
  }

  async listTransactions(): Promise<SalesTransactionRow[]> {
    const result = await this.db.query(
      `SELECT tx.*, cu.name AS customer_name, st.name AS assigned_staff_name,
              c.title AS case_title,
              COALESCE(cu.sqlite_customer_id, cu.id) AS legacy_customer_id,
              COALESCE(c.sqlite_case_id, c.id) AS legacy_case_id
       FROM crm_sales_transactions tx
       LEFT JOIN crm_customers cu ON cu.id = tx.customer_id
       LEFT JOIN crm_staff st ON st.id = tx.assigned_staff_id
       LEFT JOIN crm_cases c ON c.id = tx.case_id
       ORDER BY tx.updated_at DESC, tx.id DESC
       LIMIT 300`,
    );
    return result.rows.map((r) => this.mapTransactionRow(r as Record<string, unknown>));
  }

  async listPipelineCases(stage?: string): Promise<PipelineCaseRow[]> {
    const runtime = await this.crmConfig.resolvePipelineRuntime();
    const stageNorm = stage ? normalizePipelineStage(stage, runtime) : null;
    const params: unknown[] = [];
    let where = '';
    if (stageNorm) {
      where = 'WHERE c.pipeline_stage = $1';
      params.push(stageNorm);
    }
    const result = await this.db.query(
      `SELECT COALESCE(c.sqlite_case_id, c.id) AS id, c.title, c.pipeline_stage, c.deal_value_vnd,
              c.status, c.assigned_staff_id,
              COALESCE(cu.sqlite_customer_id, cu.id) AS customer_id,
              c.created_at, c.stage_entered_at,
              cu.name AS customer_name, st.name AS staff_name
       FROM crm_cases c
       LEFT JOIN crm_customers cu ON cu.id = c.customer_id
       LEFT JOIN crm_staff st ON st.id = c.assigned_staff_id
       ${where}
       ORDER BY c.updated_at DESC, c.id DESC
       LIMIT 200`,
      params,
    );
    return result.rows.map((r) => {
      const row = r as Record<string, unknown>;
      const stg = normalizePipelineStage(String(row.pipeline_stage ?? ''), runtime);
      return {
        id: Number(row.id),
        title: String(row.title ?? ''),
        pipeline_stage: stg,
        pipeline_stage_label: pipelineStageLabel(stg, runtime),
        is_terminal: runtime.terminalStages.has(stg),
        deal_value_vnd: Number(row.deal_value_vnd ?? 0),
        status: String(row.status ?? ''),
        assigned_staff_id: row.assigned_staff_id != null ? Number(row.assigned_staff_id) : null,
        customer_id: row.customer_id != null ? Number(row.customer_id) : null,
        customer_name: String(row.customer_name ?? ''),
        staff_name: String(row.staff_name ?? ''),
        created_at: String(row.created_at ?? ''),
        stage_entered_at: String(row.stage_entered_at ?? ''),
      };
    });
  }

  async fetchSalesReport(): Promise<SalesReportResponse> {
    const funnel = await this.computeFunnel();
    const byStaff = funnel.by_staff ?? {};
    const staffPerformance = Object.entries(byStaff)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => (b.won ?? 0) - (a.won ?? 0));

    const revResult = await this.db.query(
      `SELECT COALESCE(SUM(deal_value_vnd), 0) AS v FROM crm_cases WHERE pipeline_stage = 'chot'`,
    );
    const txResult = await this.db.query(
      `SELECT COALESCE(SUM(deal_value_vnd), 0) AS v FROM crm_sales_transactions WHERE stage = 'hoan_tat'`,
    );

    const targetResult = await this.db.query(
      `SELECT t.*, st.name AS staff_name, d.name AS department_name
       FROM crm_sales_targets t
       LEFT JOIN crm_staff st ON st.id = t.staff_id
       LEFT JOIN crm_departments d ON d.id = t.department_id
       ORDER BY t.id DESC
       LIMIT 50`,
    );

    return {
      funnel_totals: funnel.totals,
      staff_performance: staffPerformance,
      revenue_closed_cases: Number((revResult.rows[0] as { v?: unknown })?.v ?? 0),
      revenue_closed_tx: Number((txResult.rows[0] as { v?: unknown })?.v ?? 0),
      targets: targetResult.rows.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          ...row,
          achievement_pct:
            Number(row.target_value ?? 0) > 0
              ? Math.round((100 * Number(row.actual_value ?? 0)) / Number(row.target_value)) / 10
              : null,
        };
      }),
      bottlenecks: funnel.bottlenecks,
    };
  }

  async getPlanById(planId: number): Promise<SalesPlanRow | null> {
    const result = await this.db.query(
      `SELECT * FROM crm_sales_plans WHERE sqlite_plan_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_plan_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [planId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapPlanRow(row) : null;
  }

  private parseAttendeeIds(raw: unknown): number[] {
    if (Array.isArray(raw)) {
      return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n));
    }
    if (typeof raw === 'string' && raw.trim()) {
      try {
        return this.parseAttendeeIds(JSON.parse(raw));
      } catch {
        return [];
      }
    }
    return [];
  }

  private mapPartnerRow(row: Record<string, unknown>): SalesPartnerRow {
    const pt = String(row.partner_type ?? 'ctv');
    const st = String(row.status ?? 'active');
    return {
      id: Number(row.sqlite_partner_id ?? row.id),
      partner_type: pt,
      partner_type_label: PARTNER_TYPE_LABELS[pt] ?? pt,
      name: String(row.name ?? ''),
      phone: String(row.phone ?? ''),
      email: String(row.email ?? ''),
      company: String(row.company ?? ''),
      territory: String(row.territory ?? ''),
      commission_pct: row.commission_pct != null ? Number(row.commission_pct) : null,
      status: st,
      status_label: PARTNER_STATUS_LABELS[st] ?? st,
      assigned_staff_id: row.assigned_staff_id != null ? Number(row.assigned_staff_id) : null,
      assigned_staff_name: String(row.assigned_staff_name ?? ''),
      notes: String(row.notes ?? ''),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  private mapTrainingRow(row: Record<string, unknown>): SalesTrainingRow {
    const st = String(row.status ?? 'planned');
    return {
      id: Number(row.sqlite_training_id ?? row.id),
      title: String(row.title ?? ''),
      training_date: String(row.training_date ?? ''),
      trainer_name: String(row.trainer_name ?? ''),
      topic: String(row.topic ?? ''),
      content_summary: String(row.content_summary ?? ''),
      materials_url: String(row.materials_url ?? ''),
      attendee_staff_ids_list: this.parseAttendeeIds(row.attendee_staff_ids),
      status: st,
      status_label: TRAINING_STATUS_LABELS[st] ?? st,
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  private mapMarketRow(row: Record<string, unknown>): SalesMarketRow {
    const st = String(row.status ?? 'draft');
    return {
      id: Number(row.sqlite_research_id ?? row.id),
      title: String(row.title ?? ''),
      research_date: String(row.research_date ?? ''),
      area: String(row.area ?? ''),
      property_type: String(row.property_type ?? ''),
      competitor_notes: String(row.competitor_notes ?? ''),
      price_analysis: String(row.price_analysis ?? ''),
      strategy_proposal: String(row.strategy_proposal ?? ''),
      status: st,
      status_label: MARKET_STATUS_LABELS[st] ?? st,
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  private mapTransactionRow(row: Record<string, unknown>): SalesTransactionRow {
    const tt = String(row.transaction_type ?? 'ban');
    const st = String(row.stage ?? 'tu_van');
    return {
      id: Number(row.sqlite_tx_id ?? row.id),
      case_id: row.legacy_case_id != null ? Number(row.legacy_case_id) : null,
      contract_id: row.contract_id != null ? Number(row.contract_id) : null,
      customer_id: row.legacy_customer_id != null ? Number(row.legacy_customer_id) : null,
      customer_name: String(row.customer_name ?? ''),
      transaction_type: tt,
      transaction_type_label: TX_TYPE_LABELS[tt] ?? tt,
      property_ref: String(row.property_ref ?? ''),
      stage: st,
      stage_label: TX_STAGE_LABELS[st] ?? st,
      deal_value_vnd: Number(row.deal_value_vnd ?? 0),
      assigned_staff_id: row.assigned_staff_id != null ? Number(row.assigned_staff_id) : null,
      assigned_staff_name: String(row.assigned_staff_name ?? ''),
      case_title: String(row.case_title ?? ''),
      notes: String(row.notes ?? ''),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  private mapPlanRow(row: Record<string, unknown>): SalesPlanRow {
    const status = String(row.status ?? 'draft');
    return {
      id: Number(row.sqlite_plan_id ?? row.id),
      title: String(row.title ?? ''),
      fiscal_year: Number(row.fiscal_year ?? 0),
      period_start: String(row.period_start ?? ''),
      period_end: String(row.period_end ?? ''),
      revenue_target_vnd: Number(row.revenue_target_vnd ?? 0),
      status,
      status_label: SALES_PLAN_STATUS_LABELS[status] ?? status,
      summary: String(row.summary ?? ''),
      strategy_notes: String(row.strategy_notes ?? ''),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }
}

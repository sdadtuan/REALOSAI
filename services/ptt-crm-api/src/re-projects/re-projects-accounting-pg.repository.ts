import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import type { CashFlowFilters } from './re-projects-accounting.ports';
import { pgRowToPlain } from './re-projects-kpi-pg.mapper';

@Injectable()
export class ReProjectsAccountingPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async ensureAccountingSchema(): Promise<void> {
    /* DDL applied via scripts/apply_pg_ddl_bds_re_oltp_p4.sh */
  }

  async queryCashFlowRows(
    projectId: number,
    filters: CashFlowFilters = {},
  ): Promise<Array<Record<string, unknown>>> {
    const clauses = ['project_id = $1'];
    const params: unknown[] = [projectId];
    let i = 2;
    if (filters.flow_type) {
      clauses.push(`flow_type = $${i++}`);
      params.push(filters.flow_type);
    }
    if (filters.category) {
      clauses.push(`category = $${i++}`);
      params.push(filters.category);
    }
    if (filters.status) {
      clauses.push(`status = $${i++}`);
      params.push(filters.status);
    }
    const res = await this.db.query(
      `SELECT * FROM crm_re_project_cash_flow_lines
       WHERE ${clauses.join(' AND ')}
       ORDER BY COALESCE(NULLIF(transaction_date, ''), period_month) DESC, id DESC`,
      params,
    );
    return res.rows.map((r) => pgRowToPlain(r as Record<string, unknown>));
  }

  async getCashFlowRow(lineId: number): Promise<Record<string, unknown> | undefined> {
    const res = await this.db.query(`SELECT * FROM crm_re_project_cash_flow_lines WHERE id = $1`, [lineId]);
    const row = res.rows[0];
    return row ? pgRowToPlain(row as Record<string, unknown>) : undefined;
  }

  async insertCashFlowLine(
    projectId: number,
    fields: Array<string | number>,
    ts: string,
  ): Promise<number> {
    const res = await this.db.query(
      `INSERT INTO crm_re_project_cash_flow_lines (
         project_id, flow_type, category, sub_category, line_item, amount_vnd,
         period_month, transaction_date, due_date, paid_date, status,
         source_type, source_ref, counterparty, notes, created_by, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::timestamptz,$17::timestamptz)
       RETURNING id`,
      [projectId, ...fields, ts],
    );
    return Number(res.rows[0].id);
  }

  async updateCashFlowLine(
    projectId: number,
    lineId: number,
    fields: Array<string | number>,
    ts: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE crm_re_project_cash_flow_lines SET
         flow_type=$3, category=$4, sub_category=$5, line_item=$6, amount_vnd=$7,
         period_month=$8, transaction_date=$9, due_date=$10, paid_date=$11,
         status=$12, source_type=$13, source_ref=$14, counterparty=$15, notes=$16, updated_at=$17::timestamptz
       WHERE id=$1 AND project_id=$2`,
      [lineId, projectId, ...fields, ts],
    );
  }

  async deleteCashFlowLine(projectId: number, lineId: number): Promise<void> {
    await this.db.query(`DELETE FROM crm_re_project_cash_flow_lines WHERE id = $1 AND project_id = $2`, [
      lineId,
      projectId,
    ]);
  }

  async findCashFlowBySourceRef(
    projectId: number,
    sourceRef: string,
  ): Promise<{ id: number } | undefined> {
    const res = await this.db.query(
      `SELECT id FROM crm_re_project_cash_flow_lines WHERE project_id = $1 AND source_ref = $2`,
      [projectId, sourceRef],
    );
    const row = res.rows[0];
    return row ? { id: Number(row.id) } : undefined;
  }

  async findBudgetBySourceRef(
    projectId: number,
    sourceRef: string,
  ): Promise<{ id: number; planned_vnd: number } | undefined> {
    const res = await this.db.query(
      `SELECT id, planned_vnd FROM crm_re_project_budget_lines WHERE project_id = $1 AND source_ref = $2`,
      [projectId, sourceRef],
    );
    const row = res.rows[0];
    return row ? { id: Number(row.id), planned_vnd: Number(row.planned_vnd ?? 0) } : undefined;
  }

  async upsertBudgetByRef(
    projectId: number,
    data: {
      category: string;
      lineItem: string;
      plannedVnd: number;
      sourceRef: string;
      sourceType?: string;
      subCategory?: string;
    },
    ts: string,
  ): Promise<['created' | 'updated' | 'skipped', number]> {
    const ref = String(data.sourceRef ?? '').trim();
    if (!ref) return ['skipped', 0];
    const existing = await this.findBudgetBySourceRef(projectId, ref);
    if (existing) {
      if (Number(existing.planned_vnd ?? 0) === Number(data.plannedVnd)) {
        return ['skipped', Number(existing.id)];
      }
      await this.db.query(
        `UPDATE crm_re_project_budget_lines
         SET category=$3, line_item=$4, planned_vnd=$5, source_type=$6, sub_category=$7, updated_at=$8::timestamptz
         WHERE id=$1 AND project_id=$2`,
        [
          existing.id,
          projectId,
          data.category,
          data.lineItem.slice(0, 200),
          Number(data.plannedVnd),
          data.sourceType ?? 'plan_sync',
          (data.subCategory ?? '').slice(0, 40),
          ts,
        ],
      );
      return ['updated', Number(existing.id)];
    }
    const ins = await this.db.query(
      `INSERT INTO crm_re_project_budget_lines (
         project_id, category, line_item, period_month, planned_vnd, actual_vnd,
         notes, sub_category, source_type, source_ref, created_at, updated_at
       ) VALUES ($1,$2,$3,'',$4,0,'',$5,$6,$7,$8::timestamptz,$8::timestamptz)
       RETURNING id`,
      [
        projectId,
        data.category,
        data.lineItem.slice(0, 200),
        Number(data.plannedVnd),
        (data.subCategory ?? '').slice(0, 40),
        data.sourceType ?? 'plan_sync',
        ref,
        ts,
      ],
    );
    return ['created', Number(ins.rows[0].id)];
  }

  async updateBudgetActual(
    projectId: number,
    budgetId: number,
    actualVnd: number,
    lineItem: string,
    ts: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE crm_re_project_budget_lines
       SET actual_vnd=$3, line_item=$4, updated_at=$5::timestamptz
       WHERE id=$1 AND project_id=$2`,
      [budgetId, projectId, actualVnd, lineItem.slice(0, 200), ts],
    );
  }

  async insertInventoryBudgetLine(
    projectId: number,
    lineItem: string,
    period: string,
    actualVnd: number,
    ts: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_re_project_budget_lines (
         project_id, category, line_item, period_month, planned_vnd, actual_vnd,
         notes, sub_category, source_type, source_ref, created_at, updated_at
       ) VALUES ($1,'revenue',$2,$3,0,$4,'','','inventory','inventory:revenue',$5::timestamptz,$5::timestamptz)`,
      [projectId, lineItem.slice(0, 200), period, actualVnd, ts],
    );
  }

  nowTs(): string {
    return catalogTs();
  }
}

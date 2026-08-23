import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type {
  AdvanceRow,
  InsertAdvanceInput,
  InsertCapiInput,
  InsertLedgerInput,
  InsertSchemeInput,
  InsertSchemeTierInput,
  InsertScoreInput,
  InsertSplitInput,
  LedgerRow,
  SchemeRow,
  SchemeTierRow,
  ScoreRow,
  SplitRow,
  StatementRow,
  StatementStatus,
  UpsertStatementInput,
} from './bds-commission.types';

@Injectable()
export class BdsCommissionRepository implements OnModuleDestroy {
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

  private optStr(value: unknown): string | null {
    return value != null ? String(value) : null;
  }

  private asDate(value: unknown): Date {
    if (value instanceof Date) return value;
    return new Date(String(value));
  }

  private fmtDate(value: unknown): string | null {
    if (value == null) return null;
    if (value instanceof Date) {
      const y = value.getUTCFullYear();
      const m = String(value.getUTCMonth() + 1).padStart(2, '0');
      const d = String(value.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return String(value).slice(0, 10);
  }

  private mapScheme(row: Record<string, unknown>): SchemeRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      project_id: Number(row.project_id),
      phase_id: this.optStr(row.phase_id),
      status: String(row.status) as SchemeRow['status'],
      base: String(row.base) as SchemeRow['base'],
      currency: String(row.currency ?? 'VND'),
      created_at: this.asDate(row.created_at),
      updated_at: this.asDate(row.updated_at),
    };
  }

  private mapSchemeTier(row: Record<string, unknown>): SchemeTierRow {
    return {
      id: String(row.id),
      scheme_id: String(row.scheme_id),
      min_tier_id: String(row.min_tier_id),
      product_line: String(row.product_line ?? ''),
      pct: Number(row.pct ?? 0),
      bonus_units_from: row.bonus_units_from == null ? null : Number(row.bonus_units_from),
      bonus_extra_pct: Number(row.bonus_extra_pct ?? 0),
      created_at: this.asDate(row.created_at),
    };
  }

  private mapSplit(row: Record<string, unknown>): SplitRow {
    return {
      id: String(row.id),
      scheme_id: String(row.scheme_id),
      trigger_stage: String(row.trigger_stage) as SplitRow['trigger_stage'],
      pct: Number(row.pct ?? 0),
    };
  }

  private mapLedger(row: Record<string, unknown>): LedgerRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      agency_id: String(row.agency_id),
      transaction_id: String(row.transaction_id),
      scheme_id: this.optStr(row.scheme_id),
      scheme_tier_id: this.optStr(row.scheme_tier_id),
      trigger_stage: String(row.trigger_stage),
      status: String(row.status) as LedgerRow['status'],
      base_vnd: Number(row.base_vnd ?? 0),
      pct: Number(row.pct ?? 0),
      amount_vnd: Number(row.amount_vnd ?? 0),
      period_month: this.fmtDate(row.period_month),
      created_at: this.asDate(row.created_at),
    };
  }

  private mapStatement(row: Record<string, unknown>): StatementRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      agency_id: String(row.agency_id),
      period_month: this.fmtDate(row.period_month) ?? '',
      gross_vnd: Number(row.gross_vnd ?? 0),
      advance_vnd: Number(row.advance_vnd ?? 0),
      clawback_vnd: Number(row.clawback_vnd ?? 0),
      net_vnd: Number(row.net_vnd ?? 0),
      status: String(row.status) as StatementRow['status'],
      created_at: this.asDate(row.created_at),
      updated_at: this.asDate(row.updated_at),
    };
  }

  private mapAdvance(row: Record<string, unknown>): AdvanceRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      agency_id: String(row.agency_id),
      amount_vnd: Number(row.amount_vnd ?? 0),
      period_month: this.fmtDate(row.period_month) ?? '',
      note: String(row.note ?? ''),
      created_at: this.asDate(row.created_at),
    };
  }

  private mapScore(row: Record<string, unknown>): ScoreRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      agency_id: String(row.agency_id),
      period_month: this.fmtDate(row.period_month) ?? '',
      gmv_score: Number(row.gmv_score ?? 0),
      units_score: Number(row.units_score ?? 0),
      total_score: Number(row.total_score ?? 0),
      from_tier_id: this.optStr(row.from_tier_id),
      to_tier_id: this.optStr(row.to_tier_id),
      created_at: this.asDate(row.created_at),
    };
  }

  async insertScheme(input: InsertSchemeInput): Promise<SchemeRow> {
    const tenantId = String(input.tenant_id ?? '').trim() || null;
    const res = await this.db.query(
      `INSERT INTO bds_commission_schemes (tenant_id, project_id, phase_id, base, status)
       VALUES ($1,$2,$3,$4,'draft')
       RETURNING *`,
      [tenantId, input.project_id, input.phase_id ?? null, input.base ?? 'net'],
    );
    return this.mapScheme(res.rows[0] as Record<string, unknown>);
  }

  async getScheme(id: string): Promise<SchemeRow | null> {
    const res = await this.db.query(`SELECT * FROM bds_commission_schemes WHERE id = $1 LIMIT 1`, [id]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapScheme(row) : null;
  }

  async getActiveScheme(projectId: number, tenantId?: string): Promise<SchemeRow | null> {
    const tid = String(tenantId ?? '').trim() || null;
    const res = await this.db.query(
      `SELECT * FROM bds_commission_schemes
       WHERE project_id = $1 AND status = 'active'
         AND tenant_id IS NOT DISTINCT FROM $2
       LIMIT 1`,
      [projectId, tid],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapScheme(row) : null;
  }

  async listSchemeTiers(schemeId: string): Promise<SchemeTierRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_commission_scheme_tiers WHERE scheme_id = $1 ORDER BY created_at ASC`,
      [schemeId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapSchemeTier(row));
  }

  async replaceSchemeTiers(
    schemeId: string,
    rows: InsertSchemeTierInput[],
  ): Promise<SchemeTierRow[]> {
    await this.db.query(`DELETE FROM bds_commission_scheme_tiers WHERE scheme_id = $1`, [schemeId]);
    const out: SchemeTierRow[] = [];
    for (const row of rows) {
      const res = await this.db.query(
        `INSERT INTO bds_commission_scheme_tiers (scheme_id, min_tier_id, product_line, pct)
         VALUES ($1,$2,$3,$4)
         RETURNING *`,
        [schemeId, row.min_tier_id, row.product_line ?? '', row.pct],
      );
      out.push(this.mapSchemeTier(res.rows[0] as Record<string, unknown>));
    }
    return out;
  }

  async replaceSplits(schemeId: string, rows: InsertSplitInput[]): Promise<SplitRow[]> {
    await this.db.query(`DELETE FROM bds_commission_payout_splits WHERE scheme_id = $1`, [schemeId]);
    const out: SplitRow[] = [];
    for (const row of rows) {
      const res = await this.db.query(
        `INSERT INTO bds_commission_payout_splits (scheme_id, trigger_stage, pct)
         VALUES ($1,$2,$3)
         RETURNING *`,
        [schemeId, row.trigger_stage, row.pct],
      );
      out.push(this.mapSplit(res.rows[0] as Record<string, unknown>));
    }
    return out;
  }

  async listSplits(schemeId: string): Promise<SplitRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_commission_payout_splits WHERE scheme_id = $1 ORDER BY trigger_stage ASC`,
      [schemeId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapSplit(row));
  }

  async activateScheme(id: string): Promise<SchemeRow> {
    const res = await this.db.query(
      `UPDATE bds_commission_schemes SET status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    return this.mapScheme(res.rows[0] as Record<string, unknown>);
  }

  async insertLedger(input: InsertLedgerInput): Promise<LedgerRow | null> {
    const tenantId = String(input.tenant_id ?? '').trim() || null;
    const res = await this.db.query(
      `INSERT INTO bds_commission_ledger (
         tenant_id, agency_id, transaction_id, scheme_id, scheme_tier_id,
         trigger_stage, status, base_vnd, pct, amount_vnd, period_month
       )
       SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
       WHERE NOT EXISTS (
         SELECT 1 FROM bds_commission_ledger
         WHERE transaction_id = $3 AND trigger_stage = $6 AND status <> 'clawback'
       )
       RETURNING *`,
      [
        tenantId,
        input.agency_id,
        input.transaction_id,
        input.scheme_id ?? null,
        input.scheme_tier_id ?? null,
        input.trigger_stage,
        input.status ?? 'accrued',
        input.base_vnd,
        input.pct,
        input.amount_vnd,
        input.period_month ?? null,
      ],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapLedger(row) : null;
  }

  async listLedgerByTx(transactionId: string): Promise<LedgerRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_commission_ledger WHERE transaction_id = $1 ORDER BY created_at ASC`,
      [transactionId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapLedger(row));
  }

  async listLedgerByAgencyPeriod(agencyId: string, periodMonth: string): Promise<LedgerRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_commission_ledger
       WHERE agency_id = $1 AND period_month = $2::date
       ORDER BY created_at ASC`,
      [agencyId, periodMonth],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapLedger(row));
  }

  async clawbackOpenLines(transactionId: string, periodMonth: string): Promise<LedgerRow[]> {
    const client = await this.db.connect();
    const out: LedgerRow[] = [];
    try {
      await client.query('BEGIN');
      const accrued = await client.query(
        `UPDATE bds_commission_ledger
         SET status = 'clawback', period_month = COALESCE(period_month, $2::date)
         WHERE transaction_id = $1 AND status = 'accrued'
         RETURNING *`,
        [transactionId, periodMonth],
      );
      for (const row of accrued.rows as Record<string, unknown>[]) {
        out.push(this.mapLedger(row));
      }

      const paid = await client.query(
        `SELECT * FROM bds_commission_ledger
         WHERE transaction_id = $1 AND status = 'paid'`,
        [transactionId],
      );
      for (const row of paid.rows as Record<string, unknown>[]) {
        const mapped = this.mapLedger(row);
        const ins = await client.query(
          `INSERT INTO bds_commission_ledger (
             tenant_id, agency_id, transaction_id, scheme_id, scheme_tier_id,
             trigger_stage, status, base_vnd, pct, amount_vnd, period_month
           ) VALUES ($1,$2,$3,$4,$5,$6,'clawback',$7,$8,$9,$10)
           RETURNING *`,
          [
            mapped.tenant_id,
            mapped.agency_id,
            mapped.transaction_id,
            mapped.scheme_id,
            mapped.scheme_tier_id,
            mapped.trigger_stage,
            mapped.base_vnd,
            mapped.pct,
            mapped.amount_vnd,
            periodMonth,
          ],
        );
        out.push(this.mapLedger(ins.rows[0] as Record<string, unknown>));
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return out;
  }

  async upsertStatement(input: UpsertStatementInput): Promise<StatementRow> {
    const tenantId = String(input.tenant_id ?? '').trim() || null;
    const res = await this.db.query(
      `INSERT INTO bds_commission_statements (
         tenant_id, agency_id, period_month, gross_vnd, advance_vnd, clawback_vnd, net_vnd, status
       ) VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8)
       ON CONFLICT (agency_id, period_month) DO UPDATE SET
         gross_vnd = EXCLUDED.gross_vnd,
         advance_vnd = EXCLUDED.advance_vnd,
         clawback_vnd = EXCLUDED.clawback_vnd,
         net_vnd = EXCLUDED.net_vnd,
         status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING *`,
      [
        tenantId,
        input.agency_id,
        input.period_month,
        input.gross_vnd,
        input.advance_vnd,
        input.clawback_vnd,
        input.net_vnd,
        input.status,
      ],
    );
    return this.mapStatement(res.rows[0] as Record<string, unknown>);
  }

  async getStatement(id: string, tenantId?: string): Promise<StatementRow | null> {
    const tid = String(tenantId ?? '').trim();
    const res = await this.db.query(`SELECT * FROM bds_commission_statements WHERE id = $1 LIMIT 1`, [id]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const mapped = this.mapStatement(row);
    if (tid && mapped.tenant_id != null && String(mapped.tenant_id).trim() !== '' && mapped.tenant_id !== tid) {
      return null;
    }
    return mapped;
  }

  async getStatementByAgencyPeriod(
    agencyId: string,
    periodMonth: string,
  ): Promise<StatementRow | null> {
    const res = await this.db.query(
      `SELECT * FROM bds_commission_statements WHERE agency_id = $1 AND period_month = $2::date LIMIT 1`,
      [agencyId, periodMonth],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapStatement(row) : null;
  }

  async setStatementStatusIf(
    id: string,
    next: StatementStatus,
    expected: StatementStatus,
  ): Promise<StatementRow | null> {
    const res = await this.db.query(
      `UPDATE bds_commission_statements
       SET status = $2, updated_at = NOW()
       WHERE id = $1 AND status = $3
       RETURNING *`,
      [id, next, expected],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapStatement(row) : null;
  }

  async markAccruedPaidForPeriod(agencyId: string, periodMonth: string): Promise<number> {
    const res = await this.db.query(
      `UPDATE bds_commission_ledger
       SET status = 'paid'
       WHERE agency_id = $1 AND period_month = $2::date AND status = 'accrued'`,
      [agencyId, periodMonth],
    );
    return res.rowCount ?? 0;
  }

  async insertAdvance(input: InsertAdvanceInput): Promise<AdvanceRow> {
    const tenantId = String(input.tenant_id ?? '').trim() || null;
    const res = await this.db.query(
      `INSERT INTO bds_commission_advances (tenant_id, agency_id, amount_vnd, period_month, note)
       VALUES ($1,$2,$3,$4::date,$5)
       RETURNING *`,
      [tenantId, input.agency_id, input.amount_vnd, input.period_month, input.note ?? ''],
    );
    return this.mapAdvance(res.rows[0] as Record<string, unknown>);
  }

  async sumAdvances(agencyId: string, periodMonth: string): Promise<number> {
    const res = await this.db.query(
      `SELECT COALESCE(SUM(amount_vnd), 0)::bigint AS total
       FROM bds_commission_advances
       WHERE agency_id = $1 AND period_month = $2::date`,
      [agencyId, periodMonth],
    );
    return Number((res.rows[0] as { total?: string | number }).total ?? 0);
  }

  async insertScore(input: InsertScoreInput): Promise<ScoreRow> {
    const tenantId = String(input.tenant_id ?? '').trim() || null;
    const res = await this.db.query(
      `INSERT INTO bds_agency_tier_scores (
         tenant_id, agency_id, period_month, gmv_score, units_score, total_score,
         from_tier_id, to_tier_id
       ) VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8)
       ON CONFLICT (agency_id, period_month) DO UPDATE SET
         gmv_score = EXCLUDED.gmv_score,
         units_score = EXCLUDED.units_score,
         total_score = EXCLUDED.total_score,
         from_tier_id = EXCLUDED.from_tier_id,
         to_tier_id = EXCLUDED.to_tier_id
       RETURNING *`,
      [
        tenantId,
        input.agency_id,
        input.period_month,
        input.gmv_score,
        input.units_score,
        input.total_score,
        input.from_tier_id ?? null,
        input.to_tier_id ?? null,
      ],
    );
    return this.mapScore(res.rows[0] as Record<string, unknown>);
  }

  async insertCapiEvent(input: InsertCapiInput): Promise<void> {
    const tenantId = String(input.tenantId ?? '').trim() || null;
    await this.db.query(
      `INSERT INTO bds_capi_events (tenant_id, transaction_id, lead_id, event_name, value_vnd, status)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        tenantId,
        input.transactionId ?? null,
        input.leadId ?? null,
        input.eventName,
        input.valueVnd ?? null,
        input.status ?? 'logged',
      ],
    );
  }
}

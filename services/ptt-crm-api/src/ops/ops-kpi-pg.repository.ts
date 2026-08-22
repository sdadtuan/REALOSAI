import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  computeMetricLabels,
  type OpsKpiDefinition,
  type OpsKpiMetricInput,
} from './ops-kpi-label.util';

export type OpsKpiRecordRow = {
  id: number;
  lifecycle_id: number;
  dv_code: string;
  period_type: 'week' | 'month';
  period_key: string;
  metrics_json: Record<string, unknown>;
  source: string;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class OpsKpiPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      if (!this.config.databaseUrl) {
        throw new Error('ops_kpi_pg_requires_database_url');
      }
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  canUsePg(): boolean {
    return Boolean(this.config.databaseUrl?.trim());
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.schemaReady = null;
  }

  async ensureSchema(): Promise<void> {
    if (!this.canUsePg()) return;
    if (!this.schemaReady) {
      this.schemaReady = this.bootstrapSchema();
    }
    await this.schemaReady;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS ops_kpi_record (
        id SERIAL PRIMARY KEY,
        lifecycle_id INT NOT NULL,
        dv_code VARCHAR(8) NOT NULL,
        period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('week', 'month')),
        period_key VARCHAR(20) NOT NULL,
        metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        source VARCHAR(40) NOT NULL DEFAULT 'manual',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (lifecycle_id, period_type, period_key)
      );

      CREATE INDEX IF NOT EXISTS idx_ops_kpi_record_lifecycle
        ON ops_kpi_record (lifecycle_id);

      CREATE INDEX IF NOT EXISTS idx_ops_kpi_record_dv_period
        ON ops_kpi_record (dv_code, period_type, period_key);
    `);
  }

  async getRecord(
    lifecycleId: number,
    periodType: 'week' | 'month',
    periodKey: string,
  ): Promise<OpsKpiRecordRow | null> {
    if (!this.canUsePg()) return null;
    await this.ensureSchema();
    const res = await this.db.query(
      `SELECT * FROM ops_kpi_record
       WHERE lifecycle_id = $1 AND period_type = $2 AND period_key = $3
       LIMIT 1`,
      [lifecycleId, periodType, periodKey],
    );
    const row = res.rows[0];
    return row ? this.mapRow(row as Record<string, unknown>) : null;
  }

  async listRecords(
    lifecycleId: number,
    periodType?: 'week' | 'month',
  ): Promise<OpsKpiRecordRow[]> {
    if (!this.canUsePg()) return [];
    await this.ensureSchema();
    const params: unknown[] = [lifecycleId];
    let sql = `SELECT * FROM ops_kpi_record WHERE lifecycle_id = $1`;
    if (periodType) {
      params.push(periodType);
      sql += ` AND period_type = $${params.length}`;
    }
    sql += ` ORDER BY period_key DESC`;
    const res = await this.db.query(sql, params);
    return res.rows.map((row) => this.mapRow(row as Record<string, unknown>));
  }

  async upsertMetrics(input: {
    lifecycleId: number;
    dvCode: string;
    periodType: 'week' | 'month';
    periodKey: string;
    metrics: Record<string, { actual?: number | null; target?: number | null; label?: string; unit?: string }>;
    definitions: OpsKpiDefinition[];
    packageTier: string;
    source?: string;
  }): Promise<{ record: OpsKpiRecordRow; metrics: OpsKpiMetricInput[] }> {
    if (!this.canUsePg()) {
      throw new Error('ops_kpi_pg_unavailable');
    }
    await this.ensureSchema();

    const existing = await this.getRecord(input.lifecycleId, input.periodType, input.periodKey);
    const mergedRaw = {
      ...(existing?.metrics_json ?? {}),
      ...input.metrics,
    } as Record<
      string,
      { actual?: number | null; target?: number | null; label?: string; unit?: string }
    >;

    const computed = computeMetricLabels(mergedRaw, input.definitions, input.packageTier);
    const metricsJson: Record<string, unknown> = {};
    for (const m of computed) {
      metricsJson[m.key] = {
        label: m.label,
        unit: m.unit,
        actual: m.actual,
        target: m.target,
        status_label: m.status_label,
      };
    }

    const res = await this.db.query(
      `INSERT INTO ops_kpi_record
         (lifecycle_id, dv_code, period_type, period_key, metrics_json, source)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (lifecycle_id, period_type, period_key) DO UPDATE SET
         dv_code = EXCLUDED.dv_code,
         metrics_json = EXCLUDED.metrics_json,
         source = EXCLUDED.source,
         updated_at = NOW()
       RETURNING *`,
      [
        input.lifecycleId,
        input.dvCode,
        input.periodType,
        input.periodKey,
        JSON.stringify(metricsJson),
        input.source ?? 'manual',
      ],
    );

    return {
      record: this.mapRow(res.rows[0] as Record<string, unknown>),
      metrics: computed,
    };
  }

  async recomputeLabels(
    lifecycleId: number,
    periodType: 'week' | 'month',
    periodKey: string,
    definitions: OpsKpiDefinition[],
    packageTier: string,
  ): Promise<{ record: OpsKpiRecordRow | null; metrics: OpsKpiMetricInput[] }> {
    const existing = await this.getRecord(lifecycleId, periodType, periodKey);
    if (!existing) {
      return { record: null, metrics: computeMetricLabels({}, definitions, packageTier) };
    }
    const raw = existing.metrics_json as Record<
      string,
      { actual?: number | null; target?: number | null; label?: string; unit?: string }
    >;
    const computed = computeMetricLabels(raw, definitions, packageTier);
    const metricsJson: Record<string, unknown> = {};
    for (const m of computed) {
      metricsJson[m.key] = {
        label: m.label,
        unit: m.unit,
        actual: m.actual,
        target: m.target,
        status_label: m.status_label,
      };
    }
    await this.ensureSchema();
    const res = await this.db.query(
      `UPDATE ops_kpi_record
       SET metrics_json = $4, updated_at = NOW()
       WHERE lifecycle_id = $1 AND period_type = $2 AND period_key = $3
       RETURNING *`,
      [lifecycleId, periodType, periodKey, JSON.stringify(metricsJson)],
    );
    return {
      record: res.rows[0] ? this.mapRow(res.rows[0] as Record<string, unknown>) : null,
      metrics: computed,
    };
  }

  private mapRow(row: Record<string, unknown>): OpsKpiRecordRow {
    let metrics: Record<string, unknown> = {};
    if (row.metrics_json != null) {
      if (typeof row.metrics_json === 'object') {
        metrics = row.metrics_json as Record<string, unknown>;
      } else if (typeof row.metrics_json === 'string') {
        try {
          metrics = JSON.parse(row.metrics_json) as Record<string, unknown>;
        } catch {
          metrics = {};
        }
      }
    }
    return {
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      dv_code: String(row.dv_code ?? ''),
      period_type: String(row.period_type ?? 'month') as 'week' | 'month',
      period_key: String(row.period_key ?? ''),
      metrics_json: metrics,
      source: String(row.source ?? 'manual'),
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
    };
  }
}

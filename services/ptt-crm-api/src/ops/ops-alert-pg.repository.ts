import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  OpsAlertPayload,
  OpsAlertRow,
  OpsAlertSeverity,
  OpsAlertStatus,
  OpsAlertType,
} from './ops-alert.types';

export type UpsertOpsAlertInput = {
  lifecycleId: number;
  dvCode: string;
  alertType: OpsAlertType;
  severity: OpsAlertSeverity;
  title: string;
  message: string;
  sourceKey: string;
};

@Injectable()
export class OpsAlertPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      if (!this.config.databaseUrl) throw new Error('ops_alert_pg_requires_database_url');
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
    if (!this.schemaReady) this.schemaReady = this.bootstrapSchema();
    await this.schemaReady;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS ops_alert_log (
        id SERIAL PRIMARY KEY,
        lifecycle_id INT NOT NULL,
        dv_code VARCHAR(8) NOT NULL,
        alert_type VARCHAR(40) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'warning',
        title VARCHAR(500) NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        source_key VARCHAR(160) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        acknowledged_by VARCHAR(80) NULL,
        acknowledged_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (source_key)
      );

      CREATE INDEX IF NOT EXISTS idx_ops_alert_lifecycle
        ON ops_alert_log (lifecycle_id);

      CREATE INDEX IF NOT EXISTS idx_ops_alert_status
        ON ops_alert_log (status)
        WHERE status = 'open';
    `);
  }

  async upsertAlert(input: UpsertOpsAlertInput): Promise<'created' | 'exists'> {
    if (!this.canUsePg()) return 'exists';
    await this.ensureSchema();
    const res = await this.db.query(
      `INSERT INTO ops_alert_log
         (lifecycle_id, dv_code, alert_type, severity, title, message, source_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (source_key) DO NOTHING
       RETURNING id`,
      [
        input.lifecycleId,
        input.dvCode,
        input.alertType,
        input.severity,
        input.title.slice(0, 500),
        input.message.slice(0, 4000),
        input.sourceKey.slice(0, 160),
      ],
    );
    return res.rows[0] ? 'created' : 'exists';
  }

  async listAlerts(input: {
    lifecycleId?: number;
    status?: OpsAlertStatus;
    limit?: number;
  }): Promise<OpsAlertRow[]> {
    if (!this.canUsePg()) return [];
    await this.ensureSchema();
    const params: unknown[] = [];
    const cond: string[] = [];
    if (input.lifecycleId) {
      params.push(input.lifecycleId);
      cond.push(`lifecycle_id = $${params.length}`);
    }
    if (input.status) {
      params.push(input.status);
      cond.push(`status = $${params.length}`);
    }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    params.push(input.limit ?? 100);
    const res = await this.db.query(
      `SELECT * FROM ops_alert_log ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return res.rows.map((row) => this.mapRow(row as Record<string, unknown>));
  }

  async countOpen(lifecycleId?: number): Promise<number> {
    if (!this.canUsePg()) return 0;
    await this.ensureSchema();
    const params: unknown[] = ['open'];
    let sql = `SELECT COUNT(*)::int AS c FROM ops_alert_log WHERE status = $1`;
    if (lifecycleId) {
      params.push(lifecycleId);
      sql += ` AND lifecycle_id = $${params.length}`;
    }
    const res = await this.db.query(sql, params);
    return Number(res.rows[0]?.c ?? 0);
  }

  async acknowledgeAlert(alertId: number, actor: string): Promise<OpsAlertRow | null> {
    if (!this.canUsePg()) return null;
    await this.ensureSchema();
    const res = await this.db.query(
      `UPDATE ops_alert_log
       SET status = 'acknowledged', acknowledged_by = $2, acknowledged_at = NOW()
       WHERE id = $1 AND status = 'open'
       RETURNING *`,
      [alertId, actor.slice(0, 80)],
    );
    const row = res.rows[0];
    return row ? this.mapRow(row as Record<string, unknown>) : null;
  }

  mapToPayload(row: OpsAlertRow): OpsAlertPayload {
    return {
      id: row.id,
      lifecycle_id: row.lifecycle_id,
      dv_code: row.dv_code,
      alert_type: row.alert_type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      status: row.status,
      created_at: row.created_at,
    };
  }

  private mapRow(row: Record<string, unknown>): OpsAlertRow {
    return {
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      dv_code: String(row.dv_code ?? ''),
      alert_type: String(row.alert_type ?? '') as OpsAlertType,
      severity: String(row.severity ?? 'warning') as OpsAlertSeverity,
      title: String(row.title ?? ''),
      message: String(row.message ?? ''),
      source_key: String(row.source_key ?? ''),
      status: String(row.status ?? 'open') as OpsAlertStatus,
      acknowledged_by: row.acknowledged_by != null ? String(row.acknowledged_by) : null,
      acknowledged_at:
        row.acknowledged_at instanceof Date
          ? row.acknowledged_at.toISOString()
          : row.acknowledged_at != null
            ? String(row.acknowledged_at)
            : null,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    };
  }
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { AlertKind, AlertSeverity } from './b2b-alert.util';

export interface B2bLeadAlertRow {
  id: string;
  lead_id: number;
  staff_id: number;
  severity: AlertSeverity;
  kind: AlertKind;
  read_at: string | null;
  created_at: string;
}

@Injectable()
export class B2bAlertsRepository implements OnModuleDestroy {
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

  async insertAlerts(
    rows: Array<{ leadId: number; staffId: number; severity: AlertSeverity; kind: AlertKind }>,
  ): Promise<void> {
    if (!rows.length) return;
    for (const row of rows) {
      await this.db.query(
        `INSERT INTO crm_b2b_lead_alerts (lead_id, staff_id, severity, kind)
         VALUES ($1, $2, $3, $4)`,
        [row.leadId, row.staffId, row.severity, row.kind],
      );
    }
  }

  async markAlertsHandled(input: {
    leadId: number;
    staffId: number;
    handledAt?: Date;
  }): Promise<number> {
    const at = input.handledAt ?? new Date();
    const result = await this.db.query(
      `UPDATE crm_b2b_lead_alerts
       SET read_at = $3
       WHERE lead_id = $1
         AND staff_id = $2
         AND read_at IS NULL`,
      [input.leadId, input.staffId, at],
    );
    return result.rowCount ?? 0;
  }

  async listAlerts(input: { staffId?: number; limit?: number }): Promise<B2bLeadAlertRow[]> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const params: unknown[] = [];
    let where = '';
    if (input.staffId != null) {
      params.push(input.staffId);
      where = ` WHERE staff_id = $${params.length}`;
    }
    params.push(limit);
    const result = await this.db.query(
      `SELECT id::text, lead_id, staff_id, severity, kind,
              read_at::text, created_at::text
       FROM crm_b2b_lead_alerts${where}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      lead_id: Number(row.lead_id),
      staff_id: Number(row.staff_id),
      severity: String(row.severity) as AlertSeverity,
      kind: String(row.kind) as AlertKind,
      read_at: row.read_at ? String(row.read_at) : null,
      created_at: String(row.created_at),
    }));
  }
}

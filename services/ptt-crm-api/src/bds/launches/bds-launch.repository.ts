import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type { LaunchRow, LaunchStatus, QueueRow, QueueStatus } from './bds-launch.types';

const LAUNCH_EXTRA_COLS: Record<string, string> = {
  opened_at: 'opened_at',
  closed_at: 'closed_at',
  price_list_id: 'price_list_id',
  starts_at: 'starts_at',
  ends_at: 'ends_at',
  hold_ttl_seconds: 'hold_ttl_seconds',
  phase_id: 'phase_id',
};

@Injectable()
export class BdsLaunchRepository implements OnModuleDestroy {
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

  private optDate(value: unknown): Date | null {
    if (value == null || value === '') return null;
    return value instanceof Date ? value : new Date(String(value));
  }

  private asDate(value: unknown): Date {
    if (value instanceof Date) return value;
    return new Date(String(value));
  }

  private mapLaunch(row: Record<string, unknown>): LaunchRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      project_id: Number(row.project_id),
      phase_id: this.optStr(row.phase_id),
      starts_at: this.optDate(row.starts_at),
      ends_at: this.optDate(row.ends_at),
      hold_ttl_seconds: Number(row.hold_ttl_seconds ?? 180),
      price_list_id: row.price_list_id == null ? null : Number(row.price_list_id),
      status: String(row.status) as LaunchStatus,
      opened_at: this.optDate(row.opened_at),
      closed_at: this.optDate(row.closed_at),
      created_at: this.asDate(row.created_at),
    };
  }

  private mapQueue(row: Record<string, unknown>): QueueRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      launch_id: String(row.launch_id),
      product_id: Number(row.product_id),
      lead_id: Number(row.lead_id),
      requested_by_staff_id:
        row.requested_by_staff_id == null ? null : Number(row.requested_by_staff_id),
      channel_partner_id: String(row.channel_partner_id ?? ''),
      status: String(row.status) as QueueStatus,
      created_at: this.asDate(row.created_at),
    };
  }

  async insert(input: {
    tenant_id: string | null;
    project_id: number;
    phase_id: string | null;
    starts_at: Date | null;
    ends_at: Date | null;
    hold_ttl_seconds: number;
    price_list_id: number | null;
  }): Promise<LaunchRow> {
    const res = await this.db.query(
      `INSERT INTO bds_launches (
         tenant_id, project_id, phase_id, starts_at, ends_at, hold_ttl_seconds, price_list_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.tenant_id,
        input.project_id,
        input.phase_id,
        input.starts_at,
        input.ends_at,
        input.hold_ttl_seconds,
        input.price_list_id,
      ],
    );
    return this.mapLaunch(res.rows[0] as Record<string, unknown>);
  }

  async getById(id: string): Promise<LaunchRow | null> {
    const res = await this.db.query(`SELECT * FROM bds_launches WHERE id = $1 LIMIT 1`, [id]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapLaunch(row) : null;
  }

  async getOpenByProject(projectId: number): Promise<LaunchRow | null> {
    const res = await this.db.query(
      `SELECT * FROM bds_launches WHERE project_id = $1 AND status = 'open' LIMIT 1`,
      [projectId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapLaunch(row) : null;
  }

  async listByTenant(tenantId: string, projectId?: number): Promise<LaunchRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_launches
       WHERE tenant_id = $1
         AND ($2::int IS NULL OR project_id = $2)
       ORDER BY created_at DESC`,
      [tenantId, projectId ?? null],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapLaunch(row));
  }

  async setStatusIf(
    id: string,
    status: LaunchStatus,
    extra: Record<string, unknown>,
    expected: LaunchStatus,
  ): Promise<LaunchRow | null> {
    const sets: string[] = ['status = $2'];
    const params: unknown[] = [id, status];
    let idx = 3;

    for (const [key, col] of Object.entries(LAUNCH_EXTRA_COLS)) {
      if (extra[key] !== undefined) {
        sets.push(`${col} = $${idx}`);
        params.push(extra[key]);
        idx += 1;
      }
    }

    params.push(expected);
    const res = await this.db.query(
      `UPDATE bds_launches SET ${sets.join(', ')}
       WHERE id = $1 AND status = $${idx}
       RETURNING *`,
      params,
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapLaunch(row) : null;
  }

  async enqueue(input: {
    tenant_id: string | null;
    launch_id: string;
    product_id: number;
    lead_id: number;
    requested_by_staff_id: number | null;
    channel_partner_id: string;
  }): Promise<QueueRow> {
    try {
      const res = await this.db.query(
        `INSERT INTO bds_unit_queues (
           tenant_id, launch_id, product_id, lead_id, requested_by_staff_id, channel_partner_id
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          input.tenant_id,
          input.launch_id,
          input.product_id,
          input.lead_id,
          input.requested_by_staff_id,
          input.channel_partner_id,
        ],
      );
      return this.mapQueue(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        const existing = await this.db.query(
          `SELECT * FROM bds_unit_queues
           WHERE launch_id = $1 AND product_id = $2 AND lead_id = $3 AND status = 'waiting'
           LIMIT 1`,
          [input.launch_id, input.product_id, input.lead_id],
        );
        const row = existing.rows[0] as Record<string, unknown> | undefined;
        if (row) return this.mapQueue(row);
      }
      throw err;
    }
  }

  async peekWaiting(launchId: string, productId: number): Promise<QueueRow | null> {
    const res = await this.db.query(
      `SELECT * FROM bds_unit_queues
       WHERE launch_id = $1 AND product_id = $2 AND status = 'waiting'
       ORDER BY created_at ASC
       LIMIT 1`,
      [launchId, productId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapQueue(row) : null;
  }

  async setQueueStatusIf(
    id: string,
    status: QueueStatus,
    expected: QueueStatus,
  ): Promise<QueueRow | null> {
    const res = await this.db.query(
      `UPDATE bds_unit_queues SET status = $2
       WHERE id = $1 AND status = $3
       RETURNING *`,
      [id, status, expected],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapQueue(row) : null;
  }

  async listWaiting(launchId: string): Promise<QueueRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_unit_queues
       WHERE launch_id = $1 AND status = 'waiting'
       ORDER BY created_at ASC`,
      [launchId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapQueue(row));
  }

  async countWaitingByProduct(
    launchId: string,
  ): Promise<Array<{ product_id: number; waiting: number }>> {
    const res = await this.db.query(
      `SELECT product_id, COUNT(*)::int AS waiting
       FROM bds_unit_queues
       WHERE launch_id = $1 AND status = 'waiting'
       GROUP BY product_id
       ORDER BY product_id`,
      [launchId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => ({
      product_id: Number(row.product_id),
      waiting: Number(row.waiting),
    }));
  }

  async listActiveHoldsForProject(projectId: number): Promise<
    Array<{
      id: string;
      product_id: number;
      lead_id: number;
      status: string;
      expires_at: Date | null;
    }>
  > {
    const res = await this.db.query(
      `SELECT id, product_id, lead_id, status, expires_at
       FROM bds_holds
       WHERE project_id = $1 AND status IN ('active', 'pending')
       ORDER BY created_at ASC`,
      [projectId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      product_id: Number(row.product_id),
      lead_id: Number(row.lead_id),
      status: String(row.status),
      expires_at: this.optDate(row.expires_at),
    }));
  }
}

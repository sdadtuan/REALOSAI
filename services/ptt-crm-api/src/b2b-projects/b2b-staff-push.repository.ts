import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export interface B2bStaffPushSubscriptionRow {
  id: string;
  staff_id: number;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  fcm_token: string | null;
}

@Injectable()
export class B2bStaffPushRepository implements OnModuleDestroy {
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

  async tableReady(): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'crm_b2b_staff_push_subscriptions'`,
      );
      return (result.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async upsertWeb(input: {
    staffId: number;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  }): Promise<void> {
    await this.db.query(
      `DELETE FROM crm_b2b_staff_push_subscriptions
       WHERE staff_id = $1 AND endpoint = $2`,
      [input.staffId, input.endpoint],
    );
    await this.db.query(
      `INSERT INTO crm_b2b_staff_push_subscriptions
         (staff_id, endpoint, p256dh, auth, user_agent, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [input.staffId, input.endpoint, input.p256dh, input.auth, input.userAgent ?? null],
    );
  }

  async deleteWeb(staffId: number, endpoint: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM crm_b2b_staff_push_subscriptions
       WHERE staff_id = $1 AND endpoint = $2`,
      [staffId, endpoint],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listForStaff(staffId: number): Promise<B2bStaffPushSubscriptionRow[]> {
    const result = await this.db.query(
      `SELECT id::text, staff_id, endpoint, p256dh, auth, fcm_token
       FROM crm_b2b_staff_push_subscriptions
       WHERE staff_id = $1
       ORDER BY updated_at DESC`,
      [staffId],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      staff_id: Number(row.staff_id),
      endpoint: row.endpoint ? String(row.endpoint) : null,
      p256dh: row.p256dh ? String(row.p256dh) : null,
      auth: row.auth ? String(row.auth) : null,
      fcm_token: row.fcm_token ? String(row.fcm_token) : null,
    }));
  }

  async deleteStaleWeb(staffId: number, endpoint: string): Promise<void> {
    await this.db.query(
      `DELETE FROM crm_b2b_staff_push_subscriptions
       WHERE staff_id = $1 AND endpoint = $2`,
      [staffId, endpoint],
    );
  }
}

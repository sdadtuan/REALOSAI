import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export interface PortalPushSubscriptionRow {
  id: string;
  client_id: string;
  portal_user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? new Date().toISOString());
}

@Injectable()
export class PortalPushRepository implements OnModuleDestroy {
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
         WHERE table_schema = 'public' AND table_name = 'portal_push_subscriptions'`,
      );
      return (result.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async upsert(params: {
    clientId: string;
    portalUserId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  }): Promise<PortalPushSubscriptionRow | null> {
    const result = await this.db.query(
      `INSERT INTO portal_push_subscriptions
         (client_id, portal_user_id, endpoint, p256dh, auth, user_agent, updated_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, NOW())
       ON CONFLICT (portal_user_id, endpoint) DO UPDATE SET
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         user_agent = EXCLUDED.user_agent,
         updated_at = NOW()
       RETURNING id, client_id, portal_user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at`,
      [
        params.clientId,
        params.portalUserId,
        params.endpoint,
        params.p256dh,
        params.auth,
        params.userAgent ?? null,
      ],
    );
    if (!result.rows.length) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: String(row.id),
      client_id: String(row.client_id),
      portal_user_id: String(row.portal_user_id),
      endpoint: String(row.endpoint),
      p256dh: String(row.p256dh),
      auth: String(row.auth),
      user_agent: row.user_agent != null ? String(row.user_agent) : null,
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
    };
  }

  async deleteForUser(params: {
    clientId: string;
    portalUserId: string;
    endpoint: string;
  }): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM portal_push_subscriptions
       WHERE client_id = $1::uuid
         AND portal_user_id = $2::uuid
         AND endpoint = $3`,
      [params.clientId, params.portalUserId, params.endpoint],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listForUser(params: {
    clientId: string;
    portalUserId: string;
  }): Promise<PortalPushSubscriptionRow[]> {
    const result = await this.db.query(
      `SELECT id, client_id, portal_user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at
       FROM portal_push_subscriptions
       WHERE client_id = $1::uuid AND portal_user_id = $2::uuid
       ORDER BY updated_at DESC`,
      [params.clientId, params.portalUserId],
    );
    return result.rows.map((row) => this.mapRow(row as Record<string, unknown>));
  }

  async listForUsers(params: {
    clientId: string;
    portalUserIds: string[];
  }): Promise<PortalPushSubscriptionRow[]> {
    if (!params.portalUserIds.length) return [];
    const result = await this.db.query(
      `SELECT id, client_id, portal_user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at
       FROM portal_push_subscriptions
       WHERE client_id = $1::uuid
         AND portal_user_id::text = ANY($2::text[])
       ORDER BY updated_at DESC`,
      [params.clientId, params.portalUserIds],
    );
    return result.rows.map((row) => this.mapRow(row as Record<string, unknown>));
  }

  private mapRow(row: Record<string, unknown>): PortalPushSubscriptionRow {
    return {
      id: String(row.id),
      client_id: String(row.client_id),
      portal_user_id: String(row.portal_user_id),
      endpoint: String(row.endpoint),
      p256dh: String(row.p256dh),
      auth: String(row.auth),
      user_agent: row.user_agent != null ? String(row.user_agent) : null,
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
    };
  }
}

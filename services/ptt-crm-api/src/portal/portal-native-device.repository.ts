import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export interface PortalNativeDeviceRow {
  id: string;
  client_id: string;
  portal_user_id: string;
  platform: string;
  device_token: string;
  app_version: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PortalNativeDeviceRepository implements OnModuleDestroy {
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
         WHERE table_schema = 'public' AND table_name = 'portal_native_device_tokens'`,
      );
      return (result.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async upsert(params: {
    clientId: string;
    portalUserId: string;
    platform: string;
    deviceToken: string;
    appVersion?: string | null;
    userAgent?: string | null;
  }): Promise<PortalNativeDeviceRow | null> {
    const result = await this.db.query(
      `INSERT INTO portal_native_device_tokens
         (client_id, portal_user_id, platform, device_token, app_version, user_agent, updated_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, NOW())
       ON CONFLICT (portal_user_id, device_token) DO UPDATE SET
         platform = EXCLUDED.platform,
         app_version = EXCLUDED.app_version,
         user_agent = EXCLUDED.user_agent,
         updated_at = NOW()
       RETURNING id, client_id, portal_user_id, platform, device_token, app_version, user_agent, created_at, updated_at`,
      [
        params.clientId,
        params.portalUserId,
        params.platform,
        params.deviceToken,
        params.appVersion ?? null,
        params.userAgent ?? null,
      ],
    );
    if (!result.rows.length) return null;
    return result.rows[0] as PortalNativeDeviceRow;
  }

  async deleteForUser(params: {
    clientId: string;
    portalUserId: string;
    deviceToken: string;
  }): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM portal_native_device_tokens
       WHERE client_id = $1::uuid AND portal_user_id = $2::uuid AND device_token = $3`,
      [params.clientId, params.portalUserId, params.deviceToken],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listForUsers(params: {
    clientId: string;
    portalUserIds: string[];
  }): Promise<PortalNativeDeviceRow[]> {
    if (!params.portalUserIds.length) return [];
    const result = await this.db.query(
      `SELECT id, client_id, portal_user_id, platform, device_token, app_version, user_agent, created_at, updated_at
       FROM portal_native_device_tokens
       WHERE client_id = $1::uuid AND portal_user_id = ANY($2::uuid[])`,
      [params.clientId, params.portalUserIds],
    );
    return result.rows as PortalNativeDeviceRow[];
  }

  async deleteToken(deviceToken: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM portal_native_device_tokens WHERE device_token = $1`,
      [deviceToken],
    );
    return (result.rowCount ?? 0) > 0;
  }
}

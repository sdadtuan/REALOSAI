import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  CreateStaffNotificationInput,
  StaffNotificationRow,
} from './staff-notifications.types';

@Injectable()
export class StaffNotificationsRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private memory: Array<StaffNotificationRow & { user_id: string; meta_json?: Record<string, unknown> }> = [];
  private seq = 1;
  private pgReady: boolean | null = null;

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

  private async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM staff_notifications LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private mapRow(row: Record<string, unknown>): StaffNotificationRow {
    return {
      id: String(row.id),
      kind: String(row.kind ?? 'info'),
      title: String(row.title ?? ''),
      body: String(row.body ?? ''),
      link_href: row.link_href ? String(row.link_href) : null,
      read: row.read_at != null,
      created_at: String(row.created_at ?? ''),
    };
  }

  async create(input: CreateStaffNotificationInput): Promise<StaffNotificationRow> {
    const kind = String(input.kind ?? 'info').trim() || 'info';
    const title = String(input.title ?? '').trim();
    const body = String(input.body ?? '').trim();
    const link = input.link_href ? String(input.link_href).trim() : null;
    const meta = input.meta_json ?? {};

    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `INSERT INTO staff_notifications (user_id, kind, title, body, link_href, meta_json)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb)
         RETURNING id::text, kind, title, body, link_href, read_at, created_at::text`,
        [input.user_id, kind, title, body, link, JSON.stringify(meta)],
      );
      return this.mapRow(result.rows[0] as Record<string, unknown>);
    }

    const now = new Date().toISOString();
    const row = {
      id: String(this.seq++),
      user_id: input.user_id,
      kind,
      title,
      body,
      link_href: link,
      read: false,
      created_at: now,
      meta_json: meta,
    };
    this.memory.unshift(row);
    return row;
  }

  async createMany(inputs: CreateStaffNotificationInput[]): Promise<number> {
    let count = 0;
    for (const input of inputs) {
      await this.create(input);
      count += 1;
    }
    return count;
  }

  async hasRecentAlertKey(alertKey: string, cooldownDays: number): Promise<boolean> {
    const key = alertKey.trim();
    if (!key) return false;
    const days = Math.max(1, cooldownDays);

    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT 1 FROM staff_notifications
         WHERE meta_json->>'alert_key' = $1
           AND created_at >= NOW() - ($2::text || ' days')::interval
         LIMIT 1`,
        [key, String(days)],
      );
      return (result.rowCount ?? 0) > 0;
    }

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.memory.some((row) => {
      const ak = row.meta_json?.alert_key;
      if (String(ak ?? '') !== key) return false;
      const ts = Date.parse(row.created_at);
      return Number.isFinite(ts) && ts >= cutoff;
    });
  }

  async list(params: {
    userId: string;
    unreadOnly: boolean;
    limit: number;
  }): Promise<{ rows: StaffNotificationRow[]; unread: number }> {
    if (await this.ensurePgReady()) {
      const clauses = ['user_id = $1::uuid'];
      const values: unknown[] = [params.userId];
      if (params.unreadOnly) clauses.push('read_at IS NULL');
      const result = await this.db.query(
        `SELECT id::text, kind, title, body, link_href, read_at, created_at::text
         FROM staff_notifications
         WHERE ${clauses.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT $2`,
        [...values, params.limit],
      );
      const unreadResult = await this.db.query(
        `SELECT COUNT(*)::int AS c FROM staff_notifications
         WHERE user_id = $1::uuid AND read_at IS NULL`,
        [params.userId],
      );
      return {
        rows: result.rows.map((row) => this.mapRow(row as Record<string, unknown>)),
        unread: Number(unreadResult.rows[0]?.c ?? 0),
      };
    }

    const rows = this.memory
      .filter((n) => n.user_id === params.userId && (!params.unreadOnly || !n.read))
      .slice(0, params.limit)
      .map(({ user_id: _uid, ...rest }) => rest);
    const unread = this.memory.filter((n) => n.user_id === params.userId && !n.read).length;
    return { rows, unread };
  }

  async markRead(userId: string, id: string): Promise<StaffNotificationRow> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `UPDATE staff_notifications
         SET read_at = COALESCE(read_at, NOW())
         WHERE id = $1 AND user_id = $2::uuid
         RETURNING id::text, kind, title, body, link_href, read_at, created_at::text`,
        [id, userId],
      );
      const row = result.rows[0];
      if (!row) throw new NotFoundException({ error: 'notification_not_found', id });
      return this.mapRow(row as Record<string, unknown>);
    }

    const row = this.memory.find((n) => n.id === id && n.user_id === userId);
    if (!row) throw new NotFoundException({ error: 'notification_not_found', id });
    row.read = true;
    const { user_id: _uid, ...out } = row;
    return out;
  }
}

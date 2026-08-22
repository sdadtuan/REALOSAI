import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { normalizeGrantPayload } from '../staff-permissions/staff-permissions.catalog';
import type { BreakGlassCap, BreakGlassGrantRow, RequestBreakGlassBody } from './staff-break-glass.types';

const TTL_HOURS = Number(process.env.BREAK_GLASS_TTL_HOURS ?? 4);

@Injectable()
export class StaffBreakGlassRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private memory: BreakGlassGrantRow[] = [];
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
      await this.db.query(`SELECT 1 FROM staff_break_glass_grants LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private normalizeCaps(caps: BreakGlassCap[]): BreakGlassCap[] {
    const raw: Record<string, string[]> = {};
    for (const cap of caps ?? []) {
      const section = String(cap.section || '').trim();
      const action = String(cap.action || '').trim().toLowerCase();
      if (!section || !action) continue;
      if (!raw[section]) raw[section] = [];
      if (!raw[section].includes(action)) raw[section].push(action);
    }
    const normalized = normalizeGrantPayload(raw);
    const out: BreakGlassCap[] = [];
    for (const [section, actions] of Object.entries(normalized)) {
      for (const action of actions) {
        out.push({ section, action });
      }
    }
    return out.sort((a, b) => `${a.section}:${a.action}`.localeCompare(`${b.section}:${b.action}`, 'vi'));
  }

  private mapRow(row: Record<string, unknown>): BreakGlassGrantRow {
    const capsRaw = row.caps_json;
    let caps: BreakGlassCap[] = [];
    if (Array.isArray(capsRaw)) {
      caps = capsRaw as BreakGlassCap[];
    } else if (typeof capsRaw === 'string') {
      try {
        caps = JSON.parse(capsRaw) as BreakGlassCap[];
      } catch {
        caps = [];
      }
    }
    return {
      id: String(row.id),
      user_id: String(row.user_id),
      user_email: row.user_email ? String(row.user_email) : undefined,
      user_display_name: row.user_display_name ? String(row.user_display_name) : undefined,
      caps,
      reason: String(row.reason ?? ''),
      status: String(row.status ?? 'pending') as BreakGlassGrantRow['status'],
      requested_at: String(row.requested_at ?? ''),
      approved_by: String(row.approved_by ?? ''),
      approved_at: row.approved_at ? String(row.approved_at) : null,
      expires_at: row.expires_at ? String(row.expires_at) : null,
      revoked_at: row.revoked_at ? String(row.revoked_at) : null,
    };
  }

  async createRequest(userId: string, body: RequestBreakGlassBody): Promise<BreakGlassGrantRow> {
    const reason = String(body.reason || '').trim();
    if (reason.length < 10) {
      throw new BadRequestException({ error: 'reason_too_short', min: 10 });
    }
    const caps = this.normalizeCaps(body.caps_requested ?? []);
    if (!caps.length) throw new BadRequestException({ error: 'caps_required' });

    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `INSERT INTO staff_break_glass_grants (user_id, caps_json, reason, status)
         VALUES ($1::uuid, $2::jsonb, $3, 'pending')
         RETURNING id::text, user_id::text, caps_json, reason, status, requested_at::text,
                   approved_by, approved_at::text, expires_at::text, revoked_at::text`,
        [userId, JSON.stringify(caps), reason],
      );
      return this.mapRow(result.rows[0] as Record<string, unknown>);
    }

    const row: BreakGlassGrantRow = {
      id: `mem-${Date.now()}`,
      user_id: userId,
      caps,
      reason,
      status: 'pending',
      requested_at: new Date().toISOString(),
      approved_by: '',
    };
    this.memory.unshift(row);
    return row;
  }

  async getById(id: string): Promise<BreakGlassGrantRow | null> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT g.id::text, g.user_id::text, g.caps_json, g.reason, g.status,
                g.requested_at::text, g.approved_by, g.approved_at::text, g.expires_at::text,
                g.revoked_at::text, u.email AS user_email, u.display_name AS user_display_name
         FROM staff_break_glass_grants g
         LEFT JOIN staff_users u ON u.id = g.user_id
         WHERE g.id = $1::uuid
         LIMIT 1`,
        [id],
      );
      const row = result.rows[0];
      return row ? this.mapRow(row as Record<string, unknown>) : null;
    }
    return this.memory.find((g) => g.id === id) ?? null;
  }

  async approve(id: string, approverEmail: string): Promise<BreakGlassGrantRow> {
    const existing = await this.getById(id);
    if (!existing) throw new NotFoundException({ error: 'grant_not_found', id });
    if (existing.status !== 'pending') {
      throw new BadRequestException({ error: 'invalid_status', status: existing.status });
    }

    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `UPDATE staff_break_glass_grants
         SET status = 'approved',
             approved_by = $2,
             approved_at = NOW(),
             expires_at = NOW() + ($3 || ' hours')::interval
         WHERE id = $1::uuid
         RETURNING id::text, user_id::text, caps_json, reason, status, requested_at::text,
                   approved_by, approved_at::text, expires_at::text, revoked_at::text`,
        [id, approverEmail, String(TTL_HOURS)],
      );
      return this.mapRow(result.rows[0] as Record<string, unknown>);
    }

    existing.status = 'approved';
    existing.approved_by = approverEmail;
    existing.approved_at = new Date().toISOString();
    existing.expires_at = new Date(Date.now() + TTL_HOURS * 3600_000).toISOString();
    return existing;
  }

  async reject(id: string, approverEmail: string): Promise<BreakGlassGrantRow> {
    const existing = await this.getById(id);
    if (!existing) throw new NotFoundException({ error: 'grant_not_found', id });
    if (existing.status !== 'pending') {
      throw new BadRequestException({ error: 'invalid_status', status: existing.status });
    }

    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `UPDATE staff_break_glass_grants
         SET status = 'rejected', approved_by = $2, approved_at = NOW()
         WHERE id = $1::uuid
         RETURNING id::text, user_id::text, caps_json, reason, status, requested_at::text,
                   approved_by, approved_at::text, expires_at::text, revoked_at::text`,
        [id, approverEmail],
      );
      return this.mapRow(result.rows[0] as Record<string, unknown>);
    }

    existing.status = 'rejected';
    existing.approved_by = approverEmail;
    existing.approved_at = new Date().toISOString();
    return existing;
  }

  async listActive(): Promise<BreakGlassGrantRow[]> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT g.id::text, g.user_id::text, g.caps_json, g.reason, g.status,
                g.requested_at::text, g.approved_by, g.approved_at::text, g.expires_at::text,
                g.revoked_at::text, u.email AS user_email, u.display_name AS user_display_name
         FROM staff_break_glass_grants g
         LEFT JOIN staff_users u ON u.id = g.user_id
         WHERE g.status IN ('pending', 'approved')
           AND (g.revoked_at IS NULL)
           AND (g.status = 'pending' OR g.expires_at IS NULL OR g.expires_at > NOW())
         ORDER BY g.requested_at DESC
         LIMIT 100`,
      );
      return result.rows.map((row) => this.mapRow(row as Record<string, unknown>));
    }
    return this.memory.filter((g) => g.status === 'pending' || g.status === 'approved');
  }

  async loadActiveCapsForUser(userId: string): Promise<BreakGlassCap[]> {
    if (await this.ensurePgReady()) {
      try {
        const result = await this.db.query<{ caps_json: BreakGlassCap[] }>(
          `SELECT caps_json
           FROM staff_break_glass_grants
           WHERE user_id = $1::uuid
             AND status = 'approved'
             AND revoked_at IS NULL
             AND expires_at > NOW()
           ORDER BY approved_at DESC`,
          [userId],
        );
        const caps: BreakGlassCap[] = [];
        for (const row of result.rows) {
          const list = Array.isArray(row.caps_json) ? row.caps_json : [];
          for (const cap of list) {
            caps.push({ section: String(cap.section), action: String(cap.action) });
          }
        }
        return caps;
      } catch {
        return [];
      }
    }
    const caps: BreakGlassCap[] = [];
    for (const grant of this.memory) {
      if (grant.user_id !== userId || grant.status !== 'approved') continue;
      caps.push(...grant.caps);
    }
    return caps;
  }

  async revokeExpired(): Promise<number> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `UPDATE staff_break_glass_grants
         SET status = 'expired', revoked_at = NOW(), revoked_by = 'system:revoke_expired'
         WHERE status = 'approved'
           AND revoked_at IS NULL
           AND expires_at IS NOT NULL
           AND expires_at <= NOW()`,
      );
      return result.rowCount ?? 0;
    }
    return 0;
  }
}

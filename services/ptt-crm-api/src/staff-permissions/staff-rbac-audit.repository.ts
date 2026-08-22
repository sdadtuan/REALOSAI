import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export type RbacAuditEvent = {
  event_type: string;
  actor_email?: string;
  subject_user_id?: string;
  section_id?: string;
  action?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class StaffRbacAuditRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private memory: Array<RbacAuditEvent & { created_at: string }> = [];
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
      await this.db.query(`SELECT 1 FROM staff_rbac_audit_log LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  async log(event: RbacAuditEvent): Promise<void> {
    const actor = String(event.actor_email ?? '').slice(0, 255);
    const section = String(event.section_id ?? '').slice(0, 64);
    const action = String(event.action ?? '').slice(0, 32);
    const metadata = event.metadata ?? {};

    if (await this.ensurePgReady()) {
      try {
        await this.db.query(
          `INSERT INTO staff_rbac_audit_log
             (event_type, actor_email, subject_user_id, section_id, action, metadata_json)
           VALUES ($1, $2, $3::uuid, $4, $5, $6::jsonb)`,
          [
            event.event_type,
            actor,
            event.subject_user_id ?? null,
            section,
            action,
            JSON.stringify(metadata),
          ],
        );
        return;
      } catch {
        /* fall through to memory */
      }
    }

    this.memory.unshift({ ...event, created_at: new Date().toISOString() });
    if (this.memory.length > 500) this.memory.length = 500;
  }

  async listRecent(limit = 100): Promise<Array<RbacAuditEvent & { created_at: string; id?: number }>> {
    const lim = Math.min(Math.max(limit, 1), 500);
    if (await this.ensurePgReady()) {
      try {
        const result = await this.db.query(
          `SELECT id, event_type, actor_email, subject_user_id::text, section_id, action,
                  metadata_json, created_at::text
           FROM staff_rbac_audit_log
           ORDER BY created_at DESC
           LIMIT $1`,
          [lim],
        );
        return result.rows.map((row) => ({
          id: Number(row.id),
          event_type: String(row.event_type),
          actor_email: String(row.actor_email ?? ''),
          subject_user_id: row.subject_user_id ? String(row.subject_user_id) : undefined,
          section_id: String(row.section_id ?? ''),
          action: String(row.action ?? ''),
          metadata: (row.metadata_json ?? {}) as Record<string, unknown>,
          created_at: String(row.created_at),
        }));
      } catch {
        return this.memory.slice(0, lim);
      }
    }
    return this.memory.slice(0, lim);
  }

  async listForAccessReview(quarter: string): Promise<Array<RbacAuditEvent & { created_at: string; id?: number }>> {
    void quarter;
    return this.listRecent(500);
  }
}

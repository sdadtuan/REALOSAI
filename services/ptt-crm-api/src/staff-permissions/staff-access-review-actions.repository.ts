import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export interface AccessReviewActionRow {
  id: string;
  quarter: string;
  user_email: string;
  action: string;
  actor_email: string | null;
  note: string | null;
  created_at: string;
}

@Injectable()
export class StaffAccessReviewActionsRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private memory: AccessReviewActionRow[] = [];
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
      await this.db.query(`SELECT 1 FROM staff_access_review_actions LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  async insertMany(
    quarter: string,
    rows: Array<{ user_email: string; action: string; note?: string }>,
    actorEmail: string,
  ): Promise<AccessReviewActionRow[]> {
    const out: AccessReviewActionRow[] = [];
    for (const row of rows) {
      const userEmail = String(row.user_email ?? '').trim().toLowerCase();
      const action = String(row.action ?? '').trim().toLowerCase();
      const note = String(row.note ?? '').trim();
      if (!userEmail || !action) continue;

      if (await this.ensurePgReady()) {
        const result = await this.db.query(
          `INSERT INTO staff_access_review_actions (quarter, user_email, action, actor_email, note)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id::text, quarter, user_email, action, actor_email, note, created_at::text`,
          [quarter, userEmail, action, actorEmail || null, note || null],
        );
        const inserted = result.rows[0] as Record<string, unknown>;
        out.push({
          id: String(inserted.id),
          quarter: String(inserted.quarter),
          user_email: String(inserted.user_email),
          action: String(inserted.action),
          actor_email: inserted.actor_email ? String(inserted.actor_email) : null,
          note: inserted.note ? String(inserted.note) : null,
          created_at: String(inserted.created_at),
        });
        continue;
      }

      const mem: AccessReviewActionRow = {
        id: String(this.seq++),
        quarter,
        user_email: userEmail,
        action,
        actor_email: actorEmail || null,
        note: note || null,
        created_at: new Date().toISOString(),
      };
      this.memory.unshift(mem);
      out.push(mem);
    }
    return out;
  }

  async listForQuarter(quarter: string): Promise<AccessReviewActionRow[]> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT id::text, quarter, user_email, action, actor_email, note, created_at::text
         FROM staff_access_review_actions
         WHERE quarter = $1
         ORDER BY created_at DESC
         LIMIT 500`,
        [quarter],
      );
      return result.rows.map((row) => ({
        id: String(row.id),
        quarter: String(row.quarter),
        user_email: String(row.user_email),
        action: String(row.action),
        actor_email: row.actor_email ? String(row.actor_email) : null,
        note: row.note ? String(row.note) : null,
        created_at: String(row.created_at),
      }));
    }
    return this.memory.filter((r) => r.quarter === quarter);
  }
}

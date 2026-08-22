import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';

export type VdWebhookEventRow = {
  id: number;
  provider_code: string;
  event_id: string;
  job_id: number | null;
  created_at: string;
};

type MemoryStore = {
  events: VdWebhookEventRow[];
  nextId: number;
};

@Injectable()
export class VdWebhookEventRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = { events: [], nextId: 1 };

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM vd_webhook_events LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private assertWritableOrThrow(): void {
    if (this.config.contentMarketingVideoCinematicEnabled) {
      throw new Error('vd_tables_missing');
    }
  }

  private mapRow(row: Record<string, unknown>): VdWebhookEventRow {
    return {
      id: Number(row.id),
      provider_code: String(row.provider_code),
      event_id: String(row.event_id),
      job_id: row.job_id != null ? Number(row.job_id) : null,
      created_at: new Date(String(row.created_at)).toISOString(),
    };
  }

  async recordEvent(
    provider_code: string,
    event_id: string,
    job_id: number | null = null,
  ): Promise<{ inserted: boolean; row?: VdWebhookEventRow }> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO vd_webhook_events (provider_code, event_id, job_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (provider_code, event_id) DO NOTHING
         RETURNING id, provider_code, event_id, job_id, created_at`,
        [provider_code, event_id, job_id],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      if (!row) return { inserted: false };
      return { inserted: true, row: this.mapRow(row) };
    }

    this.assertWritableOrThrow();
    const existing = this.memory.events.find(
      (e) => e.provider_code === provider_code && e.event_id === event_id,
    );
    if (existing) return { inserted: false };

    const now = new Date().toISOString();
    const row: VdWebhookEventRow = {
      id: this.memory.nextId++,
      provider_code,
      event_id,
      job_id,
      created_at: now,
    };
    this.memory.events.push(row);
    return { inserted: true, row };
  }
}

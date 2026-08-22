import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';

export type VdPromptRow = {
  id: number;
  shot_id: number;
  body: string;
  bible_snapshot_json: Record<string, unknown>;
  region_locked: boolean;
  created_at: string;
};

type MemoryStore = {
  prompts: VdPromptRow[];
  nextId: number;
};

@Injectable()
export class VdPromptRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = { prompts: [], nextId: 1 };

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
      await this.db.query(`SELECT 1 FROM vd_prompts LIMIT 1`);
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

  private mapRow(row: Record<string, unknown>): VdPromptRow {
    const snapshot = row.bible_snapshot_json;
    return {
      id: Number(row.id),
      shot_id: Number(row.shot_id),
      body: String(row.body ?? ''),
      bible_snapshot_json:
        snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
          ? (snapshot as Record<string, unknown>)
          : {},
      region_locked: Boolean(row.region_locked),
      created_at: new Date(String(row.created_at)).toISOString(),
    };
  }

  async getByShotId(shotId: number): Promise<VdPromptRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, shot_id, body, bible_snapshot_json, region_locked, created_at
         FROM vd_prompts WHERE shot_id = $1 ORDER BY id DESC LIMIT 1`,
        [shotId],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return row ? this.mapRow(row) : null;
    }
    const rows = this.memory.prompts
      .filter((p) => p.shot_id === shotId)
      .sort((a, b) => b.id - a.id);
    return rows[0] ?? null;
  }

  async upsertForShot(input: {
    shot_id: number;
    body: string;
    bible_snapshot_json: Record<string, unknown>;
    region_locked: boolean;
  }): Promise<VdPromptRow> {
    if (await this.ensurePgReady()) {
      await this.db.query(`DELETE FROM vd_prompts WHERE shot_id = $1`, [input.shot_id]);
      const res = await this.db.query(
        `INSERT INTO vd_prompts (shot_id, body, bible_snapshot_json, region_locked)
         VALUES ($1, $2, $3::jsonb, $4)
         RETURNING id, shot_id, body, bible_snapshot_json, region_locked, created_at`,
        [
          input.shot_id,
          input.body,
          JSON.stringify(input.bible_snapshot_json),
          input.region_locked,
        ],
      );
      return this.mapRow(res.rows[0] as Record<string, unknown>);
    }
    this.assertWritableOrThrow();
    this.memory.prompts = this.memory.prompts.filter((p) => p.shot_id !== input.shot_id);
    const row: VdPromptRow = {
      id: this.memory.nextId++,
      shot_id: input.shot_id,
      body: input.body,
      bible_snapshot_json: input.bible_snapshot_json,
      region_locked: input.region_locked,
      created_at: new Date().toISOString(),
    };
    this.memory.prompts.push(row);
    return row;
  }
}

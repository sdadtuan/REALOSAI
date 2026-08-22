import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';

export type VdShotRow = {
  id: number;
  script_id: number;
  ordinal: number;
  status: string;
  duration_ms: number;
  camera: string;
  action: string;
  aspect: string;
  contains_human: boolean;
  text_in_frame: boolean;
  logo_in_ai_frame: boolean;
  seed: number | null;
  take_fail_count: number;
};

export type InsertVdShotInput = {
  script_id: number;
  duration_ms: number;
  camera: string;
  action: string;
  aspect?: string;
  contains_human?: boolean;
  text_in_frame?: boolean;
  logo_in_ai_frame?: boolean;
  seed?: number | null;
};

type MemoryStore = {
  shots: VdShotRow[];
  nextId: number;
};

@Injectable()
export class VdShotRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = { shots: [], nextId: 1 };

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
      await this.db.query(`SELECT 1 FROM vd_shots LIMIT 1`);
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

  private mapRow(row: Record<string, unknown>): VdShotRow {
    return {
      id: Number(row.id),
      script_id: Number(row.script_id),
      ordinal: Number(row.ordinal),
      status: String(row.status ?? 'draft'),
      duration_ms: Number(row.duration_ms),
      camera: String(row.camera ?? ''),
      action: String(row.action ?? ''),
      aspect: String(row.aspect ?? '9:16'),
      contains_human: Boolean(row.contains_human),
      text_in_frame: Boolean(row.text_in_frame),
      logo_in_ai_frame: Boolean(row.logo_in_ai_frame),
      seed: row.seed != null ? Number(row.seed) : null,
      take_fail_count: Number(row.take_fail_count ?? 0),
    };
  }

  async getById(id: number): Promise<VdShotRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, script_id, ordinal, status, duration_ms, camera, action, aspect,
                contains_human, text_in_frame, logo_in_ai_frame, seed, take_fail_count
         FROM vd_shots WHERE id = $1`,
        [id],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return row ? this.mapRow(row) : null;
    }
    return this.memory.shots.find((row) => row.id === id) ?? null;
  }

  async updateStatus(id: number, status: string): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(`UPDATE vd_shots SET status = $2 WHERE id = $1`, [id, status]);
      return;
    }
    this.assertWritableOrThrow();
    const row = this.memory.shots.find((s) => s.id === id);
    if (row) row.status = status;
  }

  async incrementTakeFailCount(id: number, count: number): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(`UPDATE vd_shots SET take_fail_count = $2 WHERE id = $1`, [id, count]);
      return;
    }
    this.assertWritableOrThrow();
    const row = this.memory.shots.find((s) => s.id === id);
    if (row) row.take_fail_count = count;
  }

  async listByProjectId(projectId: number): Promise<VdShotRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT s.id, s.script_id, s.ordinal, s.status, s.duration_ms, s.camera, s.action, s.aspect,
                s.contains_human, s.text_in_frame, s.logo_in_ai_frame, s.seed, s.take_fail_count
         FROM vd_shots s
         INNER JOIN vd_scripts sc ON sc.id = s.script_id
         WHERE sc.project_id = $1
           AND sc.version = (
             SELECT MAX(version) FROM vd_scripts WHERE project_id = $1
           )
         ORDER BY s.ordinal ASC`,
        [projectId],
      );
      return (res.rows as Record<string, unknown>[]).map((row) => this.mapRow(row));
    }
    return [];
  }

  async listByScriptId(scriptId: number): Promise<VdShotRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, script_id, ordinal, status, duration_ms, camera, action, aspect,
                contains_human, text_in_frame, logo_in_ai_frame, seed, take_fail_count
         FROM vd_shots
         WHERE script_id = $1
         ORDER BY ordinal ASC`,
        [scriptId],
      );
      return (res.rows as Record<string, unknown>[]).map((row) => this.mapRow(row));
    }
    return this.memory.shots
      .filter((row) => row.script_id === scriptId)
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal);
  }

  async insert(input: InsertVdShotInput): Promise<VdShotRow> {
    const existing = await this.listByScriptId(input.script_id);
    const ordinal = existing.length === 0 ? 1 : Math.max(...existing.map((s) => s.ordinal)) + 1;
    const aspect = input.aspect?.trim() ? input.aspect.trim() : '9:16';
    const camera = typeof input.camera === 'string' ? input.camera : '';
    const action = typeof input.action === 'string' ? input.action : '';
    const containsHuman = Boolean(input.contains_human);
    const textInFrame = Boolean(input.text_in_frame);
    const logoInAiFrame = Boolean(input.logo_in_ai_frame);
    const seed = input.seed != null && Number.isFinite(input.seed) ? Number(input.seed) : null;

    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO vd_shots (
           script_id, ordinal, status, duration_ms, camera, action, aspect,
           contains_human, text_in_frame, logo_in_ai_frame, seed
         ) VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, script_id, ordinal, status, duration_ms, camera, action, aspect,
                   contains_human, text_in_frame, logo_in_ai_frame, seed, take_fail_count`,
        [
          input.script_id,
          ordinal,
          input.duration_ms,
          camera,
          action,
          aspect,
          containsHuman,
          textInFrame,
          logoInAiFrame,
          seed,
        ],
      );
      return this.mapRow(res.rows[0] as Record<string, unknown>);
    }
    this.assertWritableOrThrow();
    const row: VdShotRow = {
      id: this.memory.nextId++,
      script_id: input.script_id,
      ordinal,
      status: 'draft',
      duration_ms: input.duration_ms,
      camera,
      action,
      aspect,
      contains_human: containsHuman,
      text_in_frame: textInFrame,
      logo_in_ai_frame: logoInAiFrame,
      seed,
      take_fail_count: 0,
    };
    this.memory.shots.push(row);
    return row;
  }

  async replaceForScript(scriptId: number, inputs: InsertVdShotInput[]): Promise<VdShotRow[]> {
    if (await this.ensurePgReady()) {
      await this.db.query(`DELETE FROM vd_shots WHERE script_id = $1`, [scriptId]);
    } else {
      this.assertWritableOrThrow();
      this.memory.shots = this.memory.shots.filter((row) => row.script_id !== scriptId);
    }
    const rows: VdShotRow[] = [];
    for (const input of inputs) {
      rows.push(await this.insert({ ...input, script_id: scriptId }));
    }
    return rows;
  }
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';

export type VdIdeaRow = {
  id: number;
  project_id: number;
  ordinal: number;
  summary: string;
  selected: boolean;
};

export type VdPromptTemplateRow = {
  code: string;
  kind: string;
  body: string;
};

type MemoryStore = {
  ideas: VdIdeaRow[];
  nextId: number;
};

@Injectable()
export class VdIdeaRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = { ideas: [], nextId: 1 };

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
      await this.db.query(`SELECT 1 FROM vd_ideas LIMIT 1`);
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

  private mapRow(row: Record<string, unknown>): VdIdeaRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      ordinal: Number(row.ordinal),
      summary: String(row.summary ?? ''),
      selected: Boolean(row.selected),
    };
  }

  async listByProjectId(projectId: number): Promise<VdIdeaRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, project_id, ordinal, summary, selected
         FROM vd_ideas
         WHERE project_id = $1
         ORDER BY ordinal ASC`,
        [projectId],
      );
      return (res.rows as Record<string, unknown>[]).map((row) => this.mapRow(row));
    }
    return this.memory.ideas
      .filter((row) => row.project_id === projectId)
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal);
  }

  async replaceForProject(projectId: number, summaries: string[]): Promise<VdIdeaRow[]> {
    if (await this.ensurePgReady()) {
      await this.db.query(`DELETE FROM vd_ideas WHERE project_id = $1`, [projectId]);
      const rows: VdIdeaRow[] = [];
      for (let i = 0; i < summaries.length; i += 1) {
        const res = await this.db.query(
          `INSERT INTO vd_ideas (project_id, ordinal, summary, selected)
           VALUES ($1, $2, $3, false)
           RETURNING id, project_id, ordinal, summary, selected`,
          [projectId, i + 1, summaries[i]],
        );
        rows.push(this.mapRow(res.rows[0] as Record<string, unknown>));
      }
      return rows;
    }
    this.assertWritableOrThrow();
    this.memory.ideas = this.memory.ideas.filter((row) => row.project_id !== projectId);
    const rows = summaries.map((summary, i) => ({
      id: this.memory.nextId++,
      project_id: projectId,
      ordinal: i + 1,
      summary,
      selected: false,
    }));
    this.memory.ideas.push(...rows);
    return rows;
  }

  async selectIdea(projectId: number, ideaId: number): Promise<VdIdeaRow[]> {
    if (await this.ensurePgReady()) {
      const found = await this.db.query(
        `SELECT id FROM vd_ideas WHERE id = $1 AND project_id = $2 LIMIT 1`,
        [ideaId, projectId],
      );
      if (!found.rows[0]) throw new Error('vd_idea_not_found');
      await this.db.query(`UPDATE vd_ideas SET selected = (id = $2) WHERE project_id = $1`, [
        projectId,
        ideaId,
      ]);
      return this.listByProjectId(projectId);
    }
    this.assertWritableOrThrow();
    const match = this.memory.ideas.find((row) => row.id === ideaId && row.project_id === projectId);
    if (!match) throw new Error('vd_idea_not_found');
    for (const row of this.memory.ideas) {
      if (row.project_id === projectId) row.selected = row.id === ideaId;
    }
    return this.listByProjectId(projectId);
  }

  async listTemplates(): Promise<VdPromptTemplateRow[]> {
    try {
      const res = await this.db.query(
        `SELECT code, kind, body FROM vd_prompt_templates ORDER BY id ASC`,
      );
      return (res.rows as Array<{ code: unknown; kind: unknown; body: unknown }>).map((row) => ({
        code: String(row.code ?? ''),
        kind: String(row.kind ?? ''),
        body: String(row.body ?? ''),
      }));
    } catch {
      return [];
    }
  }
}

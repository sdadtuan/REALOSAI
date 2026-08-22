import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';

export type VdReviewLinkRow = {
  id: number;
  token: string;
  project_id: number;
  gate_no: number;
  asset_ids: number[];
  expires_at: string;
  watermark_label: string;
  created_at: string;
};

export type VdReviewCommentRow = {
  id: number;
  link_id: number;
  body: string;
  timecode_ms: number | null;
  pin_x: number | null;
  pin_y: number | null;
  created_at: string;
};

type MemoryStore = {
  links: VdReviewLinkRow[];
  comments: VdReviewCommentRow[];
  nextLinkId: number;
  nextCommentId: number;
};

@Injectable()
export class VdReviewRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = {
    links: [],
    comments: [],
    nextLinkId: 1,
    nextCommentId: 1,
  };

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
      await this.db.query(`SELECT 1 FROM vd_review_links LIMIT 1`);
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

  private mapLink(row: Record<string, unknown>): VdReviewLinkRow {
    const assetIds = row.asset_ids;
    return {
      id: Number(row.id),
      token: String(row.token),
      project_id: Number(row.project_id),
      gate_no: Number(row.gate_no),
      asset_ids: Array.isArray(assetIds) ? assetIds.map((v) => Number(v)) : [],
      expires_at: new Date(String(row.expires_at)).toISOString(),
      watermark_label: String(row.watermark_label ?? ''),
      created_at: new Date(String(row.created_at)).toISOString(),
    };
  }

  private mapComment(row: Record<string, unknown>): VdReviewCommentRow {
    return {
      id: Number(row.id),
      link_id: Number(row.link_id),
      body: String(row.body ?? ''),
      timecode_ms: row.timecode_ms != null ? Number(row.timecode_ms) : null,
      pin_x: row.pin_x != null ? Number(row.pin_x) : null,
      pin_y: row.pin_y != null ? Number(row.pin_y) : null,
      created_at: new Date(String(row.created_at)).toISOString(),
    };
  }

  async insertLink(input: {
    token: string;
    project_id: number;
    gate_no: number;
    asset_ids: number[];
    expires_at: Date;
    watermark_label: string;
  }): Promise<VdReviewLinkRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO vd_review_links (token, project_id, gate_no, asset_ids, expires_at, watermark_label)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6)
         RETURNING id, token, project_id, gate_no, asset_ids, expires_at, watermark_label, created_at`,
        [
          input.token,
          input.project_id,
          input.gate_no,
          JSON.stringify(input.asset_ids),
          input.expires_at.toISOString(),
          input.watermark_label,
        ],
      );
      return this.mapLink(res.rows[0] as Record<string, unknown>);
    }
    this.assertWritableOrThrow();
    const row: VdReviewLinkRow = {
      id: this.memory.nextLinkId++,
      token: input.token,
      project_id: input.project_id,
      gate_no: input.gate_no,
      asset_ids: input.asset_ids,
      expires_at: input.expires_at.toISOString(),
      watermark_label: input.watermark_label,
      created_at: new Date().toISOString(),
    };
    this.memory.links.push(row);
    return row;
  }

  async getByToken(token: string): Promise<VdReviewLinkRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, token, project_id, gate_no, asset_ids, expires_at, watermark_label, created_at
         FROM vd_review_links WHERE token = $1`,
        [token],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return row ? this.mapLink(row) : null;
    }
    return this.memory.links.find((row) => row.token === token) ?? null;
  }

  async listComments(linkId: number): Promise<VdReviewCommentRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, link_id, body, timecode_ms, pin_x, pin_y, created_at
         FROM vd_review_comments WHERE link_id = $1 ORDER BY created_at ASC`,
        [linkId],
      );
      return (res.rows as Record<string, unknown>[]).map((row) => this.mapComment(row));
    }
    return this.memory.comments
      .filter((row) => row.link_id === linkId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async insertComment(input: {
    link_id: number;
    body: string;
    timecode_ms?: number | null;
    pin_x?: number | null;
    pin_y?: number | null;
  }): Promise<VdReviewCommentRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO vd_review_comments (link_id, body, timecode_ms, pin_x, pin_y)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, link_id, body, timecode_ms, pin_x, pin_y, created_at`,
        [
          input.link_id,
          input.body,
          input.timecode_ms ?? null,
          input.pin_x ?? null,
          input.pin_y ?? null,
        ],
      );
      return this.mapComment(res.rows[0] as Record<string, unknown>);
    }
    this.assertWritableOrThrow();
    const row: VdReviewCommentRow = {
      id: this.memory.nextCommentId++,
      link_id: input.link_id,
      body: input.body,
      timecode_ms: input.timecode_ms ?? null,
      pin_x: input.pin_x ?? null,
      pin_y: input.pin_y ?? null,
      created_at: new Date().toISOString(),
    };
    this.memory.comments.push(row);
    return row;
  }
}

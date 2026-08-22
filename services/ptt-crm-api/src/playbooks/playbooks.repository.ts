import { Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  CreatePlaybookBody,
  CreatePlaybookChunkBody,
  PlaybookChunkRecord,
  PlaybookRecord,
  embedPlaybookText,
} from './playbooks.types';

function mapPlaybook(row: Record<string, unknown>): PlaybookRecord {
  return {
    id: String(row.id ?? ''),
    client_id: (row.client_id as string | null) ?? null,
    slug: String(row.slug ?? ''),
    title: String(row.title ?? ''),
    category: String(row.category ?? 'sales'),
    summary: String(row.summary ?? ''),
    status: String(row.status ?? 'active') as PlaybookRecord['status'],
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    chunk_count: row.chunk_count != null ? Number(row.chunk_count) : undefined,
  };
}

function mapChunk(row: Record<string, unknown>): PlaybookChunkRecord {
  const emb = row.embedding_json;
  return {
    id: String(row.id ?? ''),
    playbook_id: String(row.playbook_id ?? ''),
    chunk_key: String(row.chunk_key ?? ''),
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    embedding_json: Array.isArray(emb) ? (emb as number[]) : null,
    token_count: row.token_count != null ? Number(row.token_count) : null,
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

const SEED_PLAYBOOKS: Array<{
  slug: string;
  title: string;
  category: string;
  summary: string;
  tags: string[];
  chunks: Array<{ chunk_key: string; title: string; body: string; sort_order: number }>;
}> = [
  {
    slug: 'rescue-stalled-deal',
    title: 'Rescue deal stalled',
    category: 'sales',
    summary: 'Playbook xử lý deal không activity ≥7 ngày.',
    tags: ['nba', 'deal', 'stalled'],
    chunks: [
      {
        chunk_key: 'step-1',
        title: 'Gọi lại khách',
        body: 'Gọi điện xác nhận nhu cầu, hỏi blocker, ghi note vào case event. Ưu tiên trong 24h.',
        sort_order: 1,
      },
      {
        chunk_key: 'step-2',
        title: 'Gửi proposal',
        body: 'Gửi báo giá cập nhật kèm timeline triển khai. CC GDKD nếu deal >500M VND.',
        sort_order: 2,
      },
      {
        chunk_key: 'step-3',
        title: 'Escalate GDKD',
        body: 'Escalate lên GDKD khi 2 lần liên hệ không phản hồi hoặc competitor xuất hiện.',
        sort_order: 3,
      },
    ],
  },
  {
    slug: 'lead-follow-up-sop',
    title: 'Lead follow-up SOP',
    category: 'sales',
    summary: 'Quy trình chăm lead MQL/SQL trong 48h.',
    tags: ['lead', 'follow-up'],
    chunks: [
      {
        chunk_key: 'mql-48h',
        title: 'MQL trong 48h',
        body: 'Lead MQL: gọi + Zalo trong 48h, tóm tắt nhu cầu, chuyển SQL nếu đủ budget và timeline.',
        sort_order: 1,
      },
      {
        chunk_key: 'sql-proposal',
        title: 'SQL → proposal',
        body: 'SQL: lên proposal draft trong 3 ngày làm việc, dùng template agency service catalog.',
        sort_order: 2,
      },
    ],
  },
];

@Injectable()
export class PlaybooksRepository implements OnModuleDestroy {
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
         WHERE table_schema = 'public' AND table_name = 'ai_playbooks'
         LIMIT 1`,
      );
      return (result.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async ensureSeedData(): Promise<void> {
    const count = await this.db.query(`SELECT COUNT(*)::int AS n FROM ai_playbooks`);
    if (Number(count.rows[0]?.n ?? 0) > 0) return;
    for (const seed of SEED_PLAYBOOKS) {
      const pb = await this.insertPlaybook({
        slug: seed.slug,
        title: seed.title,
        category: seed.category,
        summary: seed.summary,
        tags: seed.tags,
        createdBy: 'system-seed',
      });
      for (const chunk of seed.chunks) {
        await this.insertChunk(pb.id, chunk);
      }
    }
  }

  async list(args: { limit: number; offset: number }): Promise<{ rows: PlaybookRecord[]; total: number }> {
    const limit = Math.min(Math.max(args.limit, 1), 100);
    const offset = Math.max(args.offset, 0);
    const totalRow = await this.db.query(`SELECT COUNT(*)::int AS n FROM ai_playbooks WHERE status = 'active'`);
    const total = Number(totalRow.rows[0]?.n ?? 0);
    const result = await this.db.query(
      `SELECT p.id::text, p.client_id::text, p.slug, p.title, p.category, p.summary, p.status, p.tags,
              p.created_by, p.created_at, p.updated_at,
              (SELECT COUNT(*)::int FROM ai_playbook_chunks c WHERE c.playbook_id = p.id) AS chunk_count
       FROM ai_playbooks p
       WHERE p.status = 'active'
       ORDER BY p.updated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return { rows: result.rows.map(mapPlaybook), total };
  }

  async findById(id: string): Promise<PlaybookRecord | null> {
    const result = await this.db.query(
      `SELECT id::text, client_id::text, slug, title, category, summary, status, tags,
              created_by, created_at, updated_at
       FROM ai_playbooks WHERE id = $1::uuid`,
      [id],
    );
    return result.rows[0] ? mapPlaybook(result.rows[0]) : null;
  }

  async listChunks(playbookId: string): Promise<PlaybookChunkRecord[]> {
    const result = await this.db.query(
      `SELECT id::text, playbook_id::text, chunk_key, title, body, embedding_json,
              token_count, sort_order, created_at, updated_at
       FROM ai_playbook_chunks
       WHERE playbook_id = $1::uuid
       ORDER BY sort_order ASC, created_at ASC`,
      [playbookId],
    );
    return result.rows.map(mapChunk);
  }

  async listAllChunks(playbookId?: string): Promise<Array<PlaybookChunkRecord & { playbook_title: string }>> {
    const params: string[] = [];
    let filter = `WHERE p.status = 'active'`;
    if (playbookId) {
      params.push(playbookId);
      filter += ` AND p.id = $1::uuid`;
    }
    const result = await this.db.query(
      `SELECT c.id::text, c.playbook_id::text, c.chunk_key, c.title, c.body, c.embedding_json,
              c.token_count, c.sort_order, c.created_at, c.updated_at, p.title AS playbook_title
       FROM ai_playbook_chunks c
       JOIN ai_playbooks p ON p.id = c.playbook_id
       ${filter}
       ORDER BY c.updated_at DESC`,
      params,
    );
    return result.rows.map((row) => ({ ...mapChunk(row), playbook_title: String(row.playbook_title ?? '') }));
  }

  async insertPlaybook(body: CreatePlaybookBody & { createdBy?: string | null }): Promise<PlaybookRecord> {
    const slug =
      body.slug?.trim() ||
      body.title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120);
    const result = await this.db.query(
      `INSERT INTO ai_playbooks (slug, title, category, summary, tags, created_by, status)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'active')
       RETURNING id::text, client_id::text, slug, title, category, summary, status, tags,
                 created_by, created_at, updated_at`,
      [
        slug,
        body.title.trim(),
        body.category?.trim() || 'sales',
        body.summary?.trim() || '',
        JSON.stringify(body.tags ?? []),
        body.createdBy ?? null,
      ],
    );
    return mapPlaybook(result.rows[0]);
  }

  async insertChunk(playbookId: string, body: CreatePlaybookChunkBody): Promise<PlaybookChunkRecord> {
    const playbook = await this.findById(playbookId);
    if (!playbook) throw new NotFoundException({ error: 'playbook_not_found' });
    const embedding = embedPlaybookText(`${body.title ?? ''} ${body.body}`);
    const tokenCount = body.body.trim().split(/\s+/).filter(Boolean).length;
    const result = await this.db.query(
      `INSERT INTO ai_playbook_chunks (
         playbook_id, chunk_key, title, body, embedding_json, token_count, sort_order
       ) VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7)
       RETURNING id::text, playbook_id::text, chunk_key, title, body, embedding_json,
                 token_count, sort_order, created_at, updated_at`,
      [
        playbookId,
        body.chunk_key.trim(),
        body.title?.trim() || body.chunk_key.trim(),
        body.body.trim(),
        JSON.stringify(embedding),
        tokenCount,
        body.sort_order ?? 0,
      ],
    );
    await this.db.query(`UPDATE ai_playbooks SET updated_at = NOW() WHERE id = $1::uuid`, [playbookId]);
    return mapChunk(result.rows[0]);
  }
}

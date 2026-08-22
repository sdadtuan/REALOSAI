import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  CmsArticleRow,
  CmsArticleStatus,
  CmsEventRow,
  CmsEventStatus,
  CmsMediaRow,
  CmsSlotRow,
  CreateArticleBody,
  CreateEventBody,
  ListArticlesQuery,
  ListEventsQuery,
  ListPublicArticlesQuery,
  ListPublicEventsQuery,
  PatchArticleBody,
  PatchEventBody,
  PatchMediaBody,
  PutSlotBody,
} from './cms.types';

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function isoOrNull(value: unknown): string | null {
  if (value == null) return null;
  return iso(value);
}

function rowToMedia(row: Record<string, unknown>): CmsMediaRow {
  return {
    id: String(row.id),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    storage_key: String(row.storage_key),
    public_url: String(row.public_url),
    mime: String(row.mime),
    bytes: Number(row.bytes),
    width: row.width != null ? Number(row.width) : null,
    height: row.height != null ? Number(row.height) : null,
    alt_vi: row.alt_vi != null ? String(row.alt_vi) : null,
    alt_en: row.alt_en != null ? String(row.alt_en) : null,
    credit: row.credit != null ? String(row.credit) : null,
    status: row.status as CmsMediaRow['status'],
    uploaded_by: String(row.uploaded_by),
  };
}

function rowToArticle(row: Record<string, unknown>): CmsArticleRow {
  return {
    id: String(row.id),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    slug: String(row.slug),
    category: row.category as CmsArticleRow['category'],
    status: row.status as CmsArticleRow['status'],
    published_at: isoOrNull(row.published_at),
    cover_media_id: row.cover_media_id != null ? String(row.cover_media_id) : null,
    title_vi: String(row.title_vi),
    title_en: row.title_en != null ? String(row.title_en) : null,
    dek_vi: String(row.dek_vi),
    dek_en: row.dek_en != null ? String(row.dek_en) : null,
    body_vi: String(row.body_vi),
    body_en: row.body_en != null ? String(row.body_en) : null,
    seo_title_vi: row.seo_title_vi != null ? String(row.seo_title_vi) : null,
    seo_title_en: row.seo_title_en != null ? String(row.seo_title_en) : null,
    seo_desc_vi: row.seo_desc_vi != null ? String(row.seo_desc_vi) : null,
    seo_desc_en: row.seo_desc_en != null ? String(row.seo_desc_en) : null,
    featured_home: Boolean(row.featured_home),
    created_by: String(row.created_by),
    updated_by: String(row.updated_by),
  };
}

function rowToEvent(row: Record<string, unknown>): CmsEventRow {
  return {
    id: String(row.id),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    slug: String(row.slug),
    kind: row.kind as CmsEventRow['kind'],
    status: row.status as CmsEventRow['status'],
    start_at: iso(row.start_at),
    end_at: iso(row.end_at),
    timezone: String(row.timezone),
    location_type: row.location_type as CmsEventRow['location_type'],
    location_vi: row.location_vi != null ? String(row.location_vi) : null,
    location_en: row.location_en != null ? String(row.location_en) : null,
    title_vi: String(row.title_vi),
    title_en: row.title_en != null ? String(row.title_en) : null,
    dek_vi: String(row.dek_vi),
    dek_en: row.dek_en != null ? String(row.dek_en) : null,
    body_vi: String(row.body_vi),
    body_en: row.body_en != null ? String(row.body_en) : null,
    cover_media_id: row.cover_media_id != null ? String(row.cover_media_id) : null,
    cta_type: row.cta_type as CmsEventRow['cta_type'],
    cta_url: row.cta_url != null ? String(row.cta_url) : null,
    published_at: isoOrNull(row.published_at),
    created_by: String(row.created_by),
    updated_by: String(row.updated_by),
  };
}

function rowToSlot(row: Record<string, unknown>): CmsSlotRow {
  return {
    slot_key: String(row.slot_key),
    media_id: String(row.media_id),
    caption_vi: row.caption_vi != null ? String(row.caption_vi) : null,
    caption_en: row.caption_en != null ? String(row.caption_en) : null,
    updated_at: iso(row.updated_at),
    updated_by: String(row.updated_by),
  };
}

@Injectable()
export class CmsRepository implements OnModuleDestroy {
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

  async insertMedia(input: {
    storage_key: string;
    public_url: string;
    mime: string;
    bytes: number;
    width: number | null;
    height: number | null;
    alt_vi: string | null;
    alt_en: string | null;
    credit: string | null;
    uploaded_by: string;
  }): Promise<CmsMediaRow> {
    const result = await this.db.query(
      `INSERT INTO gtm_cms_media (
         storage_key, public_url, mime, bytes, width, height,
         alt_vi, alt_en, credit, uploaded_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.storage_key,
        input.public_url,
        input.mime,
        input.bytes,
        input.width,
        input.height,
        input.alt_vi,
        input.alt_en,
        input.credit,
        input.uploaded_by,
      ],
    );
    return rowToMedia(result.rows[0] as Record<string, unknown>);
  }

  async getMediaById(id: string): Promise<CmsMediaRow | null> {
    const result = await this.db.query(`SELECT * FROM gtm_cms_media WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row ? rowToMedia(row as Record<string, unknown>) : null;
  }

  async listMedia(limit = 100, offset = 0): Promise<CmsMediaRow[]> {
    const result = await this.db.query(
      `SELECT * FROM gtm_cms_media ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [Math.min(Math.max(limit, 1), 200), Math.max(offset, 0)],
    );
    return result.rows.map((row) => rowToMedia(row as Record<string, unknown>));
  }

  async patchMedia(id: string, body: PatchMediaBody, actor: string): Promise<CmsMediaRow | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    const push = (clause: string, value: unknown) => {
      params.push(value);
      sets.push(clause.replace('?', `$${params.length}`));
    };

    if (body.alt_vi !== undefined) push('alt_vi = ?', body.alt_vi);
    if (body.alt_en !== undefined) push('alt_en = ?', body.alt_en);
    if (body.credit !== undefined) push('credit = ?', body.credit);
    if (body.status !== undefined) push('status = ?', body.status);

    if (sets.length === 1) {
      return this.getMediaById(id);
    }

    params.push(id);
    const result = await this.db.query(
      `UPDATE gtm_cms_media SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    const row = result.rows[0];
    return row ? rowToMedia(row as Record<string, unknown>) : null;
  }

  async deleteMedia(id: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM gtm_cms_media WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async mediaRefCount(id: string): Promise<number> {
    const result = await this.db.query(
      `SELECT (
         (SELECT COUNT(*)::int FROM gtm_cms_article WHERE cover_media_id = $1) +
         (SELECT COUNT(*)::int FROM gtm_cms_event WHERE cover_media_id = $1) +
         (SELECT COUNT(*)::int FROM gtm_cms_slot WHERE media_id = $1)
       ) AS refs`,
      [id],
    );
    return Number(result.rows[0]?.refs ?? 0);
  }

  async insertArticle(body: CreateArticleBody, actor: string): Promise<CmsArticleRow> {
    const result = await this.db.query(
      `INSERT INTO gtm_cms_article (
         slug, category, title_vi, title_en, dek_vi, dek_en, body_vi, body_en,
         cover_media_id, seo_title_vi, seo_title_en, seo_desc_vi, seo_desc_en,
         featured_home, created_by, updated_by
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13,
         $14, $15, $15
       ) RETURNING *`,
      [
        body.slug,
        body.category,
        body.title_vi,
        body.title_en ?? null,
        body.dek_vi,
        body.dek_en ?? null,
        body.body_vi,
        body.body_en ?? null,
        body.cover_media_id ?? null,
        body.seo_title_vi ?? null,
        body.seo_title_en ?? null,
        body.seo_desc_vi ?? null,
        body.seo_desc_en ?? null,
        body.featured_home ?? false,
        actor,
      ],
    );
    return rowToArticle(result.rows[0] as Record<string, unknown>);
  }

  async getArticleById(id: string): Promise<CmsArticleRow | null> {
    const result = await this.db.query(`SELECT * FROM gtm_cms_article WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row ? rowToArticle(row as Record<string, unknown>) : null;
  }

  async getArticleBySlug(slug: string): Promise<CmsArticleRow | null> {
    const result = await this.db.query(`SELECT * FROM gtm_cms_article WHERE slug = $1`, [slug]);
    const row = result.rows[0];
    return row ? rowToArticle(row as Record<string, unknown>) : null;
  }

  async listArticles(query: ListArticlesQuery): Promise<{ rows: CmsArticleRow[]; total: number }> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const push = (clause: string, value: unknown) => {
      params.push(value);
      clauses.push(clause.replace('?', `$${params.length}`));
    };
    if (query.status) push('status = ?', query.status);
    if (query.category) push('category = ?', query.category);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);

    const countResult = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM gtm_cms_article ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    params.push(limit, offset);
    const listResult = await this.db.query(
      `SELECT * FROM gtm_cms_article ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      rows: listResult.rows.map((row) => rowToArticle(row as Record<string, unknown>)),
      total,
    };
  }

  async listPublicArticles(query: ListPublicArticlesQuery): Promise<CmsArticleRow[]> {
    const params: unknown[] = ['published'];
    let sql = `SELECT * FROM gtm_cms_article WHERE status = $1`;
    if (query.category) {
      params.push(query.category);
      sql += ` AND category = $${params.length}`;
    }
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    params.push(limit, offset);
    sql += ` ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await this.db.query(sql, params);
    return result.rows.map((row) => rowToArticle(row as Record<string, unknown>));
  }

  async patchArticle(id: string, body: PatchArticleBody, actor: string): Promise<CmsArticleRow | null> {
    const sets: string[] = ['updated_at = NOW()', 'updated_by = $1'];
    const params: unknown[] = [actor];

    const push = (clause: string, value: unknown) => {
      params.push(value);
      sets.push(clause.replace('?', `$${params.length}`));
    };

    if (body.slug !== undefined) push('slug = ?', body.slug);
    if (body.category !== undefined) push('category = ?', body.category);
    if (body.title_vi !== undefined) push('title_vi = ?', body.title_vi);
    if (body.title_en !== undefined) push('title_en = ?', body.title_en);
    if (body.dek_vi !== undefined) push('dek_vi = ?', body.dek_vi);
    if (body.dek_en !== undefined) push('dek_en = ?', body.dek_en);
    if (body.body_vi !== undefined) push('body_vi = ?', body.body_vi);
    if (body.body_en !== undefined) push('body_en = ?', body.body_en);
    if (body.cover_media_id !== undefined) push('cover_media_id = ?', body.cover_media_id);
    if (body.seo_title_vi !== undefined) push('seo_title_vi = ?', body.seo_title_vi);
    if (body.seo_title_en !== undefined) push('seo_title_en = ?', body.seo_title_en);
    if (body.seo_desc_vi !== undefined) push('seo_desc_vi = ?', body.seo_desc_vi);
    if (body.seo_desc_en !== undefined) push('seo_desc_en = ?', body.seo_desc_en);
    if (body.featured_home !== undefined) push('featured_home = ?', body.featured_home);

    params.push(id);
    const result = await this.db.query(
      `UPDATE gtm_cms_article SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    const row = result.rows[0];
    return row ? rowToArticle(row as Record<string, unknown>) : null;
  }

  async setArticleStatus(
    id: string,
    status: CmsArticleStatus,
    actor: string,
    publishedAt: Date | null,
  ): Promise<CmsArticleRow | null> {
    const result = await this.db.query(
      `UPDATE gtm_cms_article
       SET status = $1, published_at = $2, updated_at = NOW(), updated_by = $3
       WHERE id = $4
       RETURNING *`,
      [status, publishedAt, actor, id],
    );
    const row = result.rows[0];
    return row ? rowToArticle(row as Record<string, unknown>) : null;
  }

  async insertEvent(body: CreateEventBody, actor: string): Promise<CmsEventRow> {
    const result = await this.db.query(
      `INSERT INTO gtm_cms_event (
         slug, kind, start_at, end_at, timezone, location_type,
         location_vi, location_en, title_vi, title_en, dek_vi, dek_en,
         body_vi, body_en, cover_media_id, cta_type, cta_url,
         created_by, updated_by
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12,
         $13, $14, $15, $16, $17,
         $18, $18
       ) RETURNING *`,
      [
        body.slug,
        body.kind,
        body.start_at,
        body.end_at,
        body.timezone ?? 'Asia/Ho_Chi_Minh',
        body.location_type,
        body.location_vi ?? null,
        body.location_en ?? null,
        body.title_vi,
        body.title_en ?? null,
        body.dek_vi,
        body.dek_en ?? null,
        body.body_vi,
        body.body_en ?? null,
        body.cover_media_id ?? null,
        body.cta_type,
        body.cta_url ?? null,
        actor,
      ],
    );
    return rowToEvent(result.rows[0] as Record<string, unknown>);
  }

  async getEventById(id: string): Promise<CmsEventRow | null> {
    const result = await this.db.query(`SELECT * FROM gtm_cms_event WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row ? rowToEvent(row as Record<string, unknown>) : null;
  }

  async getEventBySlug(slug: string): Promise<CmsEventRow | null> {
    const result = await this.db.query(`SELECT * FROM gtm_cms_event WHERE slug = $1`, [slug]);
    const row = result.rows[0];
    return row ? rowToEvent(row as Record<string, unknown>) : null;
  }

  async listEvents(query: ListEventsQuery): Promise<{ rows: CmsEventRow[]; total: number }> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const push = (clause: string, value: unknown) => {
      params.push(value);
      clauses.push(clause.replace('?', `$${params.length}`));
    };
    if (query.status) push('status = ?', query.status);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);

    const countResult = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM gtm_cms_event ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    params.push(limit, offset);
    const listResult = await this.db.query(
      `SELECT * FROM gtm_cms_event ${where}
       ORDER BY start_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      rows: listResult.rows.map((row) => rowToEvent(row as Record<string, unknown>)),
      total,
    };
  }

  async listPublicEvents(query: ListPublicEventsQuery): Promise<CmsEventRow[]> {
    const params: unknown[] = [];
    let sql = `SELECT * FROM gtm_cms_event WHERE status IN ('published', 'cancelled')`;
    const when = query.when ?? 'upcoming';
    if (when === 'upcoming') {
      sql += ` AND end_at >= NOW()`;
    } else if (when === 'past') {
      sql += ` AND end_at < NOW()`;
    }
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    params.push(limit, offset);
    sql += ` ORDER BY start_at ASC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await this.db.query(sql, params);
    return result.rows.map((row) => rowToEvent(row as Record<string, unknown>));
  }

  async patchEvent(id: string, body: PatchEventBody, actor: string): Promise<CmsEventRow | null> {
    const sets: string[] = ['updated_at = NOW()', 'updated_by = $1'];
    const params: unknown[] = [actor];

    const push = (clause: string, value: unknown) => {
      params.push(value);
      sets.push(clause.replace('?', `$${params.length}`));
    };

    if (body.slug !== undefined) push('slug = ?', body.slug);
    if (body.kind !== undefined) push('kind = ?', body.kind);
    if (body.start_at !== undefined) push('start_at = ?', body.start_at);
    if (body.end_at !== undefined) push('end_at = ?', body.end_at);
    if (body.timezone !== undefined) push('timezone = ?', body.timezone);
    if (body.location_type !== undefined) push('location_type = ?', body.location_type);
    if (body.location_vi !== undefined) push('location_vi = ?', body.location_vi);
    if (body.location_en !== undefined) push('location_en = ?', body.location_en);
    if (body.title_vi !== undefined) push('title_vi = ?', body.title_vi);
    if (body.title_en !== undefined) push('title_en = ?', body.title_en);
    if (body.dek_vi !== undefined) push('dek_vi = ?', body.dek_vi);
    if (body.dek_en !== undefined) push('dek_en = ?', body.dek_en);
    if (body.body_vi !== undefined) push('body_vi = ?', body.body_vi);
    if (body.body_en !== undefined) push('body_en = ?', body.body_en);
    if (body.cover_media_id !== undefined) push('cover_media_id = ?', body.cover_media_id);
    if (body.cta_type !== undefined) push('cta_type = ?', body.cta_type);
    if (body.cta_url !== undefined) push('cta_url = ?', body.cta_url);
    if (body.status !== undefined) push('status = ?', body.status);

    params.push(id);
    const result = await this.db.query(
      `UPDATE gtm_cms_event SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    const row = result.rows[0];
    return row ? rowToEvent(row as Record<string, unknown>) : null;
  }

  async setEventStatus(
    id: string,
    status: CmsEventStatus,
    actor: string,
    publishedAt: Date | null,
  ): Promise<CmsEventRow | null> {
    const result = await this.db.query(
      `UPDATE gtm_cms_event
       SET status = $1, published_at = $2, updated_at = NOW(), updated_by = $3
       WHERE id = $4
       RETURNING *`,
      [status, publishedAt, actor, id],
    );
    const row = result.rows[0];
    return row ? rowToEvent(row as Record<string, unknown>) : null;
  }

  async getSlot(slotKey: string): Promise<CmsSlotRow | null> {
    const result = await this.db.query(`SELECT * FROM gtm_cms_slot WHERE slot_key = $1`, [slotKey]);
    const row = result.rows[0];
    return row ? rowToSlot(row as Record<string, unknown>) : null;
  }

  async listSlots(keys: string[]): Promise<CmsSlotRow[]> {
    if (!keys.length) return [];
    const result = await this.db.query(
      `SELECT * FROM gtm_cms_slot WHERE slot_key = ANY($1::text[])`,
      [keys],
    );
    return result.rows.map((row) => rowToSlot(row as Record<string, unknown>));
  }

  async upsertSlot(slotKey: string, body: PutSlotBody, actor: string): Promise<CmsSlotRow> {
    const result = await this.db.query(
      `INSERT INTO gtm_cms_slot (slot_key, media_id, caption_vi, caption_en, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slot_key) DO UPDATE SET
         media_id = EXCLUDED.media_id,
         caption_vi = EXCLUDED.caption_vi,
         caption_en = EXCLUDED.caption_en,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by
       RETURNING *`,
      [slotKey, body.media_id, body.caption_vi ?? null, body.caption_en ?? null, actor],
    );
    return rowToSlot(result.rows[0] as Record<string, unknown>);
  }
}

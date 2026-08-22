import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { RagEmbeddingRow } from '../market-research/market-research.types';
import { PGVECTOR_READY_SQL, parsePgvectorReadyRow } from '../market-research/pgvector-ready.util';
import { toPgvectorLiteral } from '../market-research/pgvector.util';
import type { PortalCjSummary, PortalResearchVersionRecord } from './portal-research.types';

function parseJsonCol<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

@Injectable()
export class PortalResearchRepository implements OnModuleDestroy {
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

  async listPortalVisibleVersions(clientId: string): Promise<PortalResearchVersionRecord[]> {
    const result = await this.db.query(
      `SELECT v.id, v.report_id, v.version, v.content_snapshot, v.generated_by,
              v.content_hash, v.embargo_until::text AS embargo_until,
              v.expires_at::text AS expires_at, v.portal_visible,
              v.created_at::text AS created_at, p.client_id
       FROM crm_research_report_versions v
       JOIN crm_research_reports r ON r.id = v.report_id
       JOIN crm_research_projects p ON p.id = r.project_id
       WHERE v.portal_visible = true AND p.client_id = $1
       ORDER BY v.created_at DESC, v.id DESC`,
      [clientId],
    );
    return result.rows.map((row) => this.mapPortalVersion(row));
  }

  async getPortalReportVersion(versionId: number): Promise<PortalResearchVersionRecord | null> {
    const result = await this.db.query(
      `SELECT v.id, v.report_id, v.version, v.content_snapshot, v.generated_by,
              v.content_hash, v.embargo_until::text AS embargo_until,
              v.expires_at::text AS expires_at, v.portal_visible,
              v.created_at::text AS created_at, p.client_id
       FROM crm_research_report_versions v
       JOIN crm_research_reports r ON r.id = v.report_id
       JOIN crm_research_projects p ON p.id = r.project_id
       WHERE v.id = $1`,
      [versionId],
    );
    const row = result.rows[0];
    return row ? this.mapPortalVersion(row) : null;
  }

  async listPublishedEmbeddings(clientId: string, themeCode?: string): Promise<RagEmbeddingRow[]> {
    const params: unknown[] = [clientId];
    const where = [`p.client_id = $1`, `i.status = 'published'`];
    const theme = themeCode?.trim();
    if (theme) {
      params.push(theme);
      where.push(`EXISTS (
        SELECT 1
        FROM crm_research_insight_themes it2
        JOIN crm_research_taxonomy t2 ON t2.id = it2.taxonomy_id
        WHERE it2.insight_id = i.id
          AND (
            lower(t2.theme_code) = lower($${params.length})
            OR EXISTS (
              SELECT 1 FROM unnest(t2.synonyms) syn
              WHERE lower(syn) = lower($${params.length})
            )
          )
      )`);
    }
    const result = await this.db.query(
      `SELECT e.insight_id,
              e.project_id,
              e.embedding,
              i.status,
              i.statement,
              i.observation,
              i.valid_to::text AS valid_to,
              p.client_id,
              COALESCE(
                array_agg(t.theme_code) FILTER (WHERE t.theme_code IS NOT NULL),
                '{}'
              ) AS theme_codes,
              COALESCE(
                (
                  SELECT array_agg(s)
                  FROM crm_research_insight_themes it3
                  JOIN crm_research_taxonomy t3 ON t3.id = it3.taxonomy_id
                  CROSS JOIN unnest(t3.synonyms) s
                  WHERE it3.insight_id = i.id
                ),
                '{}'
              ) AS theme_synonyms
       FROM crm_research_insight_embeddings e
       JOIN crm_research_insights i ON i.id = e.insight_id
       JOIN crm_research_projects p ON p.id = e.project_id
       LEFT JOIN crm_research_insight_themes it ON it.insight_id = i.id
       LEFT JOIN crm_research_taxonomy t ON t.id = it.taxonomy_id
       WHERE ${where.join(' AND ')}
       GROUP BY e.insight_id, e.project_id, e.embedding, i.status, i.statement, i.observation, p.client_id, i.valid_to
       ORDER BY e.insight_id ASC`,
      params,
    );
    return result.rows.map((row) => ({
      insight_id: Number(row.insight_id),
      project_id: Number(row.project_id),
      status: String(row.status),
      statement: String(row.statement),
      observation: row.observation != null ? String(row.observation) : null,
      embedding: parseJsonCol<number[]>(row.embedding, []).map(Number),
      theme_codes: Array.isArray(row.theme_codes)
        ? row.theme_codes.map((code: unknown) => String(code))
        : [],
      theme_synonyms: Array.isArray(row.theme_synonyms)
        ? row.theme_synonyms.map((syn: unknown) => String(syn))
        : [],
      client_id: String(row.client_id),
      valid_to: row.valid_to != null ? String(row.valid_to) : null,
    }));
  }

  async listPublishedEmbeddingsByVec(
    clientId: string,
    themeCode: string | undefined,
    queryVec: number[],
    limit = 50,
  ): Promise<RagEmbeddingRow[]> {
    const params: unknown[] = [clientId];
    const where = [`p.client_id = $1`, `i.status = 'published'`, 'e.embedding_vec IS NOT NULL'];
    params.push(queryVec.length);
    where.push(`vector_dims(e.embedding_vec) = $${params.length}`);
    const theme = themeCode?.trim();
    if (theme) {
      params.push(theme);
      where.push(`EXISTS (
        SELECT 1
        FROM crm_research_insight_themes it2
        JOIN crm_research_taxonomy t2 ON t2.id = it2.taxonomy_id
        WHERE it2.insight_id = i.id
          AND (
            lower(t2.theme_code) = lower($${params.length})
            OR EXISTS (
              SELECT 1 FROM unnest(t2.synonyms) syn
              WHERE lower(syn) = lower($${params.length})
            )
          )
      )`);
    }
    params.push(toPgvectorLiteral(queryVec));
    const vecIdx = params.length;
    params.push(Math.min(Math.max(limit, 1), 50));
    const limitIdx = params.length;
    const result = await this.db.query(
      `SELECT e.insight_id,
              e.project_id,
              e.embedding,
              i.status,
              i.statement,
              i.observation,
              i.valid_to::text AS valid_to,
              p.client_id,
              COALESCE(
                array_agg(t.theme_code) FILTER (WHERE t.theme_code IS NOT NULL),
                '{}'
              ) AS theme_codes,
              COALESCE(
                (
                  SELECT array_agg(s)
                  FROM crm_research_insight_themes it3
                  JOIN crm_research_taxonomy t3 ON t3.id = it3.taxonomy_id
                  CROSS JOIN unnest(t3.synonyms) s
                  WHERE it3.insight_id = i.id
                ),
                '{}'
              ) AS theme_synonyms
       FROM crm_research_insight_embeddings e
       JOIN crm_research_insights i ON i.id = e.insight_id
       JOIN crm_research_projects p ON p.id = e.project_id
       LEFT JOIN crm_research_insight_themes it ON it.insight_id = i.id
       LEFT JOIN crm_research_taxonomy t ON t.id = it.taxonomy_id
       WHERE ${where.join(' AND ')}
       GROUP BY e.insight_id, e.project_id, e.embedding, i.status, i.statement, i.observation, p.client_id, i.valid_to, e.embedding_vec
       ORDER BY e.embedding_vec <=> $${vecIdx}::vector
       LIMIT $${limitIdx}`,
      params,
    );
    return result.rows.map((row) => ({
      insight_id: Number(row.insight_id),
      project_id: Number(row.project_id),
      status: String(row.status),
      statement: String(row.statement),
      observation: row.observation != null ? String(row.observation) : null,
      embedding: parseJsonCol<number[]>(row.embedding, []).map(Number),
      theme_codes: Array.isArray(row.theme_codes)
        ? row.theme_codes.map((code: unknown) => String(code))
        : [],
      theme_synonyms: Array.isArray(row.theme_synonyms)
        ? row.theme_synonyms.map((syn: unknown) => String(syn))
        : [],
      client_id: String(row.client_id),
      valid_to: row.valid_to != null ? String(row.valid_to) : null,
    }));
  }

  async listPublishedInsightValidTo(
    clientId: string,
    insightIds: number[],
  ): Promise<Map<number, string | null>> {
    const ids = [...new Set(insightIds.filter((n) => Number.isFinite(n) && n > 0))];
    const map = new Map<number, string | null>();
    if (!ids.length) return map;
    const result = await this.db.query(
      `SELECT i.id, i.valid_to::text AS valid_to
       FROM crm_research_insights i
       JOIN crm_research_projects p ON p.id = i.project_id
       WHERE p.client_id = $1
         AND i.status = 'published'
         AND i.id = ANY($2::int[])`,
      [clientId, ids],
    );
    for (const row of result.rows) {
      map.set(Number(row.id), row.valid_to != null ? String(row.valid_to) : null);
    }
    return map;
  }

  async getThemeQuarterAnalytics(clientId: string, year: number): Promise<
    Array<{ quarter: number; theme_code: string; label_vi: string; insight_count: number }>
  > {
    const result = await this.db.query(
      `SELECT EXTRACT(QUARTER FROM date_trunc('quarter', i.updated_at))::int AS quarter,
              t.theme_code,
              t.label_vi,
              COUNT(DISTINCT i.id)::int AS insight_count
       FROM crm_research_insights i
       JOIN crm_research_projects p ON p.id = i.project_id
       JOIN crm_research_insight_themes it ON it.insight_id = i.id
       JOIN crm_research_taxonomy t ON t.id = it.taxonomy_id
       WHERE i.status = 'published'
         AND p.client_id = $1
         AND EXTRACT(YEAR FROM i.updated_at) = $2
       GROUP BY quarter, t.theme_code, t.label_vi
       ORDER BY quarter ASC, insight_count DESC, t.theme_code ASC`,
      [clientId, year],
    );
    return result.rows.map((row) => ({
      quarter: Number(row.quarter),
      theme_code: String(row.theme_code),
      label_vi: String(row.label_vi),
      insight_count: Number(row.insight_count ?? 0),
    }));
  }

  private mapPortalVersion(row: Record<string, unknown>): PortalResearchVersionRecord {
    return {
      id: Number(row.id),
      report_id: Number(row.report_id),
      version: Number(row.version),
      content_snapshot: parseJsonCol<Record<string, unknown>>(row.content_snapshot, {}),
      generated_by: row.generated_by != null ? String(row.generated_by) : null,
      content_hash: String(row.content_hash ?? ''),
      embargo_until: row.embargo_until != null ? String(row.embargo_until) : null,
      expires_at: row.expires_at != null ? String(row.expires_at) : null,
      portal_visible: Boolean(row.portal_visible),
      created_at: String(row.created_at ?? ''),
      client_id: String(row.client_id),
    };
  }

  async getLatestCjSummaryForClient(clientId: string): Promise<PortalCjSummary | null> {
    const result = await this.db.query(
      `SELECT s.n, s.n_choices, s.attributes, s.recommendation,
              s.limitation_note, s.statistical_inference
       FROM crm_research_cj_summaries s
       JOIN crm_research_projects p ON p.id = s.project_id
       WHERE p.client_id = $1 AND p.product_type = 'PRICE_OFFER'
       ORDER BY s.id DESC
       LIMIT 1`,
      [clientId],
    );
    const row = result.rows[0];
    return row ? this.mapPortalCjSummary(row) : null;
  }

  private mapPortalCjSummary(row: Record<string, unknown>): PortalCjSummary {
    return {
      n: Number(row.n),
      n_choices: Number(row.n_choices),
      attributes: parseJsonCol(row.attributes, []),
      recommendation: parseJsonCol(row.recommendation, { levels: [] }),
      limitation_note: String(row.limitation_note ?? ''),
      statistical_inference: false,
    };
  }

  async probePgvectorReady(): Promise<boolean> {
    try {
      const result = await this.db.query(PGVECTOR_READY_SQL);
      return parsePgvectorReadyRow(result.rows[0] as { ext_ok?: boolean; col_ok?: boolean });
    } catch {
      return false;
    }
  }
}

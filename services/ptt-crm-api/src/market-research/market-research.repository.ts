import { createHash } from 'crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { APPROVED_INTERNAL_PLUS, type InsightStatus, type ProductType, type ProjectStatus } from './market-research.constants';
import { normalizeReportExec } from './report-exec.util';
import { isInsightStale } from './insight-stale.util';
import { PGVECTOR_READY_SQL, parsePgvectorReadyRow } from './pgvector-ready.util';
import { IVFFLAT_READY_SQL, parseIvfflatReadyRow } from './pgvector-ivfflat.util';
import { toPgvectorLiteral } from './pgvector.util';
import type {
  CreateEvidenceInput,
  CreateInsightInput,
  CreateProjectInput,
  CreateQuestionInput,
  CreateCompetitorInput,
  CreateCompetitorSnapshotInput,
  CreateConsentInput,
  CreateSourceInput,
  CreateStudyInput,
  CreateWaveInput,
  CreateDecisionInput,
  PatchDecisionInput,
  PatchStudyInput,
  ResearchConsent,
  ResearchStudy,
  ResearchWave,
  ResearchDecision,
  ResearchCjSummaryRow,
  CjWhatIfResult,
  CjWhatIfRunRow,
  CjAttributeSummary,
  CjRecommendation,
  ResearchVwSummaryRow,
  VwBin,
  VwPoints,
  InsertReviewInput,
  ListEmbeddingsFilters,
  ListProjectsFilters,
  RagEmbeddingRow,
  ReembedCandidate,
  UpsertInsightEmbeddingInput,
  TaxonomyTheme,
  CreateTaxonomyInput,
  PatchTaxonomyInput,
  OpsAnalyticsRaw,
  IsoGapFactsRow,
  ThemeQuarterRow,
  ThemeQuarterCountRow,
  PatchCompetitorInput,
  PatchEvidenceInput,
  PatchInsightInput,
  PatchProjectInput,
  PatchQuestionInput,
  ResearchAiRunRow,
  ResearchCompetitorRow,
  ResearchCompetitorSnapshotRow,
  ResearchEvidenceRow,
  ResearchInsightRow,
  ResearchProjectRow,
  ResearchQuestionRow,
  ResearchReportRow,
  ResearchReportVersionRow,
  ResearchSourceRow,
  TrendSignal,
} from './market-research.types';

function mapTaxonomy(row: Record<string, unknown>): TaxonomyTheme {
  return {
    id: Number(row.id),
    theme_code: String(row.theme_code),
    label_vi: String(row.label_vi),
    synonyms: Array.isArray(row.synonyms) ? row.synonyms.map((s) => String(s)) : [],
    active: Boolean(row.active),
  };
}

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

const PROJECT_SELECT = `
  SELECT p.id,
         p.client_id,
         c.name AS client_name,
         p.lifecycle_id,
         p.title,
         p.product_type,
         p.dv12_tier,
         p.decision_statement,
         p.geo,
         p.languages,
         p.risk_class,
         p.status,
         p.owner_user_id,
         p.data_residency,
         p.related_sales_market_id,
         p.created_by,
         p.updated_by,
         p.created_at::text AS created_at,
         p.updated_at::text AS updated_at,
         (SELECT COUNT(*)::int FROM crm_research_questions q WHERE q.project_id = p.id) AS rq_count,
         (SELECT COUNT(*)::int FROM crm_research_insights i
           WHERE i.project_id = p.id
             AND i.status IN ('analyst_verified','peer_reviewed','approved_internal','approved_client_facing','published')
         ) AS verified_insight_count
  FROM crm_research_projects p
  LEFT JOIN clients c ON c.id::text = p.client_id
`;

@Injectable()
export class MarketResearchRepository implements OnModuleDestroy {
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

  private mapProject(row: Record<string, unknown>): ResearchProjectRow {
    return {
      id: Number(row.id),
      client_id: String(row.client_id),
      client_name: row.client_name != null ? String(row.client_name) : null,
      lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
      title: String(row.title),
      product_type: row.product_type as ProductType,
      dv12_tier: row.dv12_tier as ResearchProjectRow['dv12_tier'],
      decision_statement: String(row.decision_statement),
      geo: parseJsonCol<string[]>(row.geo, []),
      languages: parseJsonCol<string[]>(row.languages, ['vi']),
      risk_class: row.risk_class as ResearchProjectRow['risk_class'],
      status: row.status as ProjectStatus,
      owner_user_id: row.owner_user_id != null ? Number(row.owner_user_id) : null,
      data_residency: row.data_residency != null ? String(row.data_residency) : null,
      related_sales_market_id:
        row.related_sales_market_id != null ? Number(row.related_sales_market_id) : null,
      created_by: row.created_by != null ? String(row.created_by) : null,
      updated_by: row.updated_by != null ? String(row.updated_by) : null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      rq_count: Number(row.rq_count ?? 0),
      verified_insight_count: Number(row.verified_insight_count ?? 0),
    };
  }

  private mapQuestion(row: Record<string, unknown>): ResearchQuestionRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      sort_order: Number(row.sort_order ?? 0),
      question_vi: String(row.question_vi),
      question_en: row.question_en != null ? String(row.question_en) : null,
      analysis_frame: row.analysis_frame != null ? String(row.analysis_frame) : null,
      created_at: String(row.created_at),
    };
  }

  async listProjects(
    filters: ListProjectsFilters,
    allowedClientIds?: string[],
  ): Promise<ResearchProjectRow[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };

    if (filters.client_id?.trim()) add('p.client_id = ?', filters.client_id.trim());
    if (filters.status?.trim()) add('p.status = ?', filters.status.trim());
    if (filters.product_type?.trim()) add('p.product_type = ?', filters.product_type.trim());
    if (filters.q?.trim()) add('p.title ILIKE ?', `%${filters.q.trim()}%`);
    if (filters.lifecycle_id != null && Number.isFinite(filters.lifecycle_id)) {
      add('p.lifecycle_id = ?', filters.lifecycle_id);
    }
    if (allowedClientIds) {
      params.push(allowedClientIds);
      where.push(`p.client_id = ANY($${params.length}::text[])`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await this.db.query(
      `${PROJECT_SELECT} ${clause} ORDER BY p.updated_at DESC LIMIT 200`,
      params,
    );
    return result.rows.map((row) => this.mapProject(row));
  }

  async getProject(id: number): Promise<ResearchProjectRow | null> {
    const result = await this.db.query(`${PROJECT_SELECT} WHERE p.id = $1`, [id]);
    const row = result.rows[0];
    return row ? this.mapProject(row) : null;
  }

  async getProjectClientId(id: number): Promise<string | null> {
    const result = await this.db.query(
      `SELECT client_id FROM crm_research_projects WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? String(row.client_id) : null;
  }

  async findConsultFormDataByClientId(clientId: string): Promise<Record<string, unknown> | null> {
    const result = await this.db.query(
      `SELECT t.form_data
       FROM crm_svc_tasks t
       INNER JOIN crm_service_lifecycle sl ON sl.id = t.lifecycle_id
       INNER JOIN crm_contracts ct ON ct.id = sl.contract_id
       WHERE t.stage = 'consult'
         AND TRIM(COALESCE(ct.agency_client_id, '')) = $1
       ORDER BY t.updated_at DESC, t.id DESC
       LIMIT 1`,
      [clientId.trim()],
    );
    const row = result.rows[0] as { form_data?: unknown } | undefined;
    if (!row) return null;
    return parseJsonCol<Record<string, unknown>>(row.form_data, {});
  }

  async listQuestions(projectId: number): Promise<ResearchQuestionRow[]> {
    const result = await this.db.query(
      `SELECT id, project_id, sort_order, question_vi, question_en, analysis_frame,
              created_at::text AS created_at
       FROM crm_research_questions
       WHERE project_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [projectId],
    );
    return result.rows.map((row) => this.mapQuestion(row));
  }

  async createProject(input: CreateProjectInput, actor: string): Promise<ResearchProjectRow> {
    const client = await this.db.connect();
    let id: number;
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO crm_research_projects (
           client_id, title, product_type, dv12_tier, decision_statement,
           geo, languages, risk_class, lifecycle_id, status, created_by, updated_by
         ) VALUES (
           $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, 'intake', $10, $10
         ) RETURNING id`,
        [
          input.client_id.trim(),
          input.title.trim(),
          input.product_type,
          ['CB', 'TC', 'CS'].includes(String(input.dv12_tier ?? '')) ? input.dv12_tier : 'CB',
          input.decision_statement.trim(),
          JSON.stringify(input.geo?.length ? input.geo : ['VN']),
          JSON.stringify(input.languages?.length ? input.languages : ['vi']),
          ['low', 'medium', 'high'].includes(String(input.risk_class ?? ''))
            ? input.risk_class
            : 'low',
          input.lifecycle_id ?? null,
          actor,
        ],
      );
      id = Number(inserted.rows[0].id);
      for (const [idx, q] of input.questions.entries()) {
        await client.query(
          `INSERT INTO crm_research_questions (project_id, sort_order, question_vi, question_en, analysis_frame)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            id,
            q.sort_order ?? idx + 1,
            q.question_vi.trim(),
            q.question_en?.trim() || null,
            q.analysis_frame?.trim() || null,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    const row = await this.getProject(id);
    if (!row) throw new Error(`createProject failed for id ${id}`);
    return row;
  }

  async patchProject(
    id: number,
    input: PatchProjectInput,
    actor: string,
  ): Promise<ResearchProjectRow | null> {
    const sets: string[] = ['updated_at = now()', 'updated_by = $1'];
    const params: unknown[] = [actor];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if (input.title != null) add('title', input.title.trim());
    if (input.decision_statement != null) add('decision_statement', input.decision_statement.trim());
    if (input.geo != null) {
      params.push(JSON.stringify(input.geo));
      sets.push(`geo = $${params.length}::jsonb`);
    }
    if (input.languages != null) {
      params.push(JSON.stringify(input.languages));
      sets.push(`languages = $${params.length}::jsonb`);
    }
    if (input.risk_class != null) add('risk_class', input.risk_class);
    if (input.dv12_tier != null) add('dv12_tier', input.dv12_tier);
    if (input.status != null) add('status', input.status);
    params.push(id);
    await this.db.query(
      `UPDATE crm_research_projects SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    );
    return this.getProject(id);
  }

  async addQuestion(projectId: number, input: CreateQuestionInput): Promise<ResearchQuestionRow> {
    const result = await this.db.query(
      `INSERT INTO crm_research_questions (project_id, sort_order, question_vi, question_en, analysis_frame)
       VALUES (
         $1,
         COALESCE($2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM crm_research_questions WHERE project_id = $1)),
         $3, $4, $5
       )
       RETURNING id, project_id, sort_order, question_vi, question_en, analysis_frame,
                 created_at::text AS created_at`,
      [
        projectId,
        input.sort_order ?? null,
        input.question_vi.trim(),
        input.question_en?.trim() || null,
        input.analysis_frame?.trim() || null,
      ],
    );
    await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
      projectId,
    ]);
    return this.mapQuestion(result.rows[0]);
  }

  async getQuestion(id: number): Promise<ResearchQuestionRow | null> {
    const result = await this.db.query(
      `SELECT id, project_id, sort_order, question_vi, question_en, analysis_frame,
              created_at::text AS created_at
       FROM crm_research_questions WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.mapQuestion(row) : null;
  }

  async patchQuestion(id: number, input: PatchQuestionInput): Promise<ResearchQuestionRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if (input.question_vi != null) add('question_vi', input.question_vi.trim());
    if (input.question_en !== undefined) add('question_en', input.question_en?.trim() || null);
    if (input.analysis_frame !== undefined) {
      add('analysis_frame', input.analysis_frame?.trim() || null);
    }
    if (input.sort_order != null) add('sort_order', input.sort_order);
    if (!sets.length) return this.getQuestion(id);
    params.push(id);
    const result = await this.db.query(
      `UPDATE crm_research_questions SET ${sets.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, project_id, sort_order, question_vi, question_en, analysis_frame,
                 created_at::text AS created_at`,
      params,
    );
    const row = result.rows[0];
    if (row) {
      await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
        row.project_id,
      ]);
    }
    return row ? this.mapQuestion(row) : null;
  }

  async countEvidenceForQuestion(questionId: number): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM crm_research_evidence WHERE question_id = $1`,
      [questionId],
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  async deleteQuestion(id: number): Promise<void> {
    const existing = await this.getQuestion(id);
    await this.db.query(`DELETE FROM crm_research_questions WHERE id = $1`, [id]);
    if (existing) {
      await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
        existing.project_id,
      ]);
    }
  }

  private mapSource(row: Record<string, unknown>): ResearchSourceRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      question_id: row.question_id != null ? Number(row.question_id) : null,
      source_type: String(row.source_type),
      title: String(row.title),
      publisher: row.publisher != null ? String(row.publisher) : null,
      url: row.url != null ? String(row.url) : null,
      published_at: row.published_at != null ? String(row.published_at) : null,
      accessed_at: row.accessed_at != null ? String(row.accessed_at) : null,
      geo: row.geo != null ? String(row.geo) : null,
      license_note: row.license_note != null ? String(row.license_note) : null,
      reliability_tier: String(row.reliability_tier ?? 'unknown'),
      limitation_note: row.limitation_note != null ? String(row.limitation_note) : null,
      snapshot_uri: row.snapshot_uri != null ? String(row.snapshot_uri) : null,
      content_hash: row.content_hash != null ? String(row.content_hash) : null,
      ai_generated: Boolean(row.ai_generated),
      keep: row.keep == null ? null : Boolean(row.keep),
      triangulated: Boolean(row.triangulated),
      single_source_accepted: Boolean(row.single_source_accepted),
      superseded_by: row.superseded_by != null ? Number(row.superseded_by) : null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapEvidence(row: Record<string, unknown>): ResearchEvidenceRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      source_id: row.source_id != null ? Number(row.source_id) : null,
      study_id: row.study_id != null ? Number(row.study_id) : null,
      question_id: row.question_id != null ? Number(row.question_id) : null,
      locator: String(row.locator),
      excerpt: row.excerpt != null ? String(row.excerpt) : null,
      value_num: row.value_num != null ? Number(row.value_num) : null,
      unit: row.unit != null ? String(row.unit) : null,
      value_base: row.value_base != null ? String(row.value_base) : null,
      period_note: row.period_note != null ? String(row.period_note) : null,
      geography: row.geography != null ? String(row.geography) : null,
      captured_at: String(row.captured_at),
      pii_class: String(row.pii_class ?? 'none'),
      qc_status: String(row.qc_status ?? 'pending'),
      checksum: row.checksum != null ? String(row.checksum) : null,
      created_by: row.created_by != null ? String(row.created_by) : null,
      superseded_by: row.superseded_by != null ? Number(row.superseded_by) : null,
      created_at: String(row.created_at),
    };
  }

  private readonly sourceSelect = `
    SELECT id, project_id, question_id, source_type, title, publisher, url,
           published_at::text AS published_at, accessed_at::text AS accessed_at,
           geo, license_note, reliability_tier, limitation_note, snapshot_uri, content_hash,
           ai_generated, keep, triangulated, single_source_accepted, superseded_by,
           created_at::text AS created_at, updated_at::text AS updated_at
    FROM crm_research_sources
  `;

  private readonly evidenceSelect = `
    SELECT id, project_id, source_id, study_id, question_id, locator, excerpt,
           value_num, unit, value_base, period_note, geography,
           captured_at::text AS captured_at, pii_class, qc_status, checksum,
           created_by, superseded_by, created_at::text AS created_at
    FROM crm_research_evidence
  `;

  async listSources(projectId: number): Promise<ResearchSourceRow[]> {
    const result = await this.db.query(
      `${this.sourceSelect} WHERE project_id = $1 ORDER BY id ASC`,
      [projectId],
    );
    return result.rows.map((row) => this.mapSource(row));
  }

  async getSource(id: number): Promise<ResearchSourceRow | null> {
    const result = await this.db.query(`${this.sourceSelect} WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row ? this.mapSource(row) : null;
  }

  async createSource(projectId: number, input: CreateSourceInput): Promise<ResearchSourceRow> {
    const result = await this.db.query(
      `INSERT INTO crm_research_sources (
         project_id, question_id, source_type, title, publisher, url,
         published_at, accessed_at, geo, license_note, reliability_tier, limitation_note,
         ai_generated, keep
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, project_id, question_id, source_type, title, publisher, url,
                 published_at::text AS published_at, accessed_at::text AS accessed_at,
                 geo, license_note, reliability_tier, limitation_note, snapshot_uri, content_hash,
                 ai_generated, keep, triangulated, single_source_accepted, superseded_by,
                 created_at::text AS created_at, updated_at::text AS updated_at`,
      [
        projectId,
        input.question_id ?? null,
        String(input.source_type ?? 'web').trim() || 'web',
        input.title.trim(),
        input.publisher?.trim() || null,
        input.url?.trim() || null,
        input.published_at?.trim() || null,
        input.accessed_at?.trim() || null,
        input.geo?.trim() || null,
        input.license_note?.trim() || null,
        String(input.reliability_tier ?? 'unknown').trim() || 'unknown',
        input.limitation_note?.trim() || null,
        input.ai_generated === true,
        input.keep === undefined ? null : input.keep,
      ],
    );
    await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
      projectId,
    ]);
    return this.mapSource(result.rows[0]);
  }

  async patchSourceKeep(id: number, keep: boolean): Promise<ResearchSourceRow | null> {
    const result = await this.db.query(
      `UPDATE crm_research_sources SET keep = $1, updated_at = now() WHERE id = $2
       RETURNING id, project_id, question_id, source_type, title, publisher, url,
                 published_at::text AS published_at, accessed_at::text AS accessed_at,
                 geo, license_note, reliability_tier, limitation_note, snapshot_uri, content_hash,
                 ai_generated, keep, triangulated, single_source_accepted, superseded_by,
                 created_at::text AS created_at, updated_at::text AS updated_at`,
      [keep, id],
    );
    const row = result.rows[0];
    return row ? this.mapSource(row) : null;
  }

  async listEvidence(projectId: number): Promise<ResearchEvidenceRow[]> {
    const result = await this.db.query(
      `${this.evidenceSelect} WHERE project_id = $1 ORDER BY id ASC`,
      [projectId],
    );
    return result.rows.map((row) => this.mapEvidence(row));
  }

  async getEvidence(id: number): Promise<ResearchEvidenceRow | null> {
    const result = await this.db.query(`${this.evidenceSelect} WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row ? this.mapEvidence(row) : null;
  }

  async createEvidence(
    projectId: number,
    input: CreateEvidenceInput,
    actor: string,
  ): Promise<ResearchEvidenceRow> {
    const result = await this.db.query(
      `INSERT INTO crm_research_evidence (
         project_id, source_id, study_id, question_id, locator, excerpt,
         value_num, unit, value_base, period_note, geography, pii_class, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, project_id, source_id, study_id, question_id, locator, excerpt,
                 value_num, unit, value_base, period_note, geography,
                 captured_at::text AS captured_at, pii_class, qc_status, checksum,
                 created_by, superseded_by, created_at::text AS created_at`,
      [
        projectId,
        input.source_id ?? null,
        input.study_id ?? null,
        input.question_id ?? null,
        String(input.locator ?? '').trim(),
        input.excerpt?.trim() || null,
        input.value_num ?? null,
        input.unit?.trim() || null,
        input.value_base?.trim() || null,
        input.period_note?.trim() || null,
        input.geography?.trim() || null,
        input.pii_class?.trim() || 'none',
        actor,
      ],
    );
    await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
      projectId,
    ]);
    return this.mapEvidence(result.rows[0]);
  }

  async patchEvidence(id: number, input: PatchEvidenceInput): Promise<ResearchEvidenceRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if (input.locator != null) add('locator', input.locator.trim());
    if (input.excerpt !== undefined) add('excerpt', input.excerpt?.trim() || null);
    if (input.value_num !== undefined) add('value_num', input.value_num);
    if (input.unit !== undefined) add('unit', input.unit?.trim() || null);
    if (input.value_base !== undefined) add('value_base', input.value_base?.trim() || null);
    if (input.period_note !== undefined) add('period_note', input.period_note?.trim() || null);
    if (input.geography !== undefined) add('geography', input.geography?.trim() || null);
    if (input.pii_class !== undefined) add('pii_class', input.pii_class?.trim() || 'none');
    if (input.question_id !== undefined) add('question_id', input.question_id);
    if (!sets.length) return this.getEvidence(id);
    params.push(id);
    const result = await this.db.query(
      `UPDATE crm_research_evidence SET ${sets.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, project_id, source_id, study_id, question_id, locator, excerpt,
                 value_num, unit, value_base, period_note, geography,
                 captured_at::text AS captured_at, pii_class, qc_status, checksum,
                 created_by, superseded_by, created_at::text AS created_at`,
      params,
    );
    const row = result.rows[0];
    return row ? this.mapEvidence(row) : null;
  }

  async verifyEvidence(id: number, checksum: string): Promise<ResearchEvidenceRow | null> {
    const result = await this.db.query(
      `UPDATE crm_research_evidence
       SET qc_status = 'verified', checksum = $1
       WHERE id = $2
       RETURNING id, project_id, source_id, study_id, question_id, locator, excerpt,
                 value_num, unit, value_base, period_note, geography,
                 captured_at::text AS captured_at, pii_class, qc_status, checksum,
                 created_by, superseded_by, created_at::text AS created_at`,
      [checksum, id],
    );
    const row = result.rows[0];
    return row ? this.mapEvidence(row) : null;
  }

  async supersedeEvidence(
    existing: ResearchEvidenceRow,
    input: CreateEvidenceInput,
    actor: string,
  ): Promise<{ old: ResearchEvidenceRow; evidence: ResearchEvidenceRow }> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO crm_research_evidence (
           project_id, source_id, study_id, question_id, locator, excerpt,
           value_num, unit, value_base, period_note, geography, pii_class, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id, project_id, source_id, study_id, question_id, locator, excerpt,
                   value_num, unit, value_base, period_note, geography,
                   captured_at::text AS captured_at, pii_class, qc_status, checksum,
                   created_by, superseded_by, created_at::text AS created_at`,
        [
          existing.project_id,
          input.source_id ?? null,
          input.study_id ?? null,
          input.question_id ?? null,
          String(input.locator ?? '').trim(),
          input.excerpt?.trim() || null,
          input.value_num ?? null,
          input.unit?.trim() || null,
          input.value_base?.trim() || null,
          input.period_note?.trim() || null,
          input.geography?.trim() || null,
          input.pii_class?.trim() || 'none',
          actor,
        ],
      );
      const created = this.mapEvidence(inserted.rows[0]);
      const updated = await client.query(
        `UPDATE crm_research_evidence
         SET qc_status = 'superseded', superseded_by = $1
         WHERE id = $2
         RETURNING id, project_id, source_id, study_id, question_id, locator, excerpt,
                   value_num, unit, value_base, period_note, geography,
                   captured_at::text AS captured_at, pii_class, qc_status, checksum,
                   created_by, superseded_by, created_at::text AS created_at`,
        [created.id, existing.id],
      );
      await client.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
        existing.project_id,
      ]);
      await client.query('COMMIT');
      return { old: this.mapEvidence(updated.rows[0]), evidence: created };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private readonly insightSelect = `
    SELECT i.id, i.project_id, i.statement, i.observation, i.interpretation, i.implication,
           i.recommendation, i.audience, i.status, i.confidence_rationale, i.confidence_json,
           i.ai_generated, i.created_by,
           i.valid_from::text AS valid_from, i.valid_to::text AS valid_to,
           i.created_at::text AS created_at, i.updated_at::text AS updated_at,
           COALESCE((
             SELECT json_agg(ie.evidence_id ORDER BY ie.evidence_id)
             FROM crm_research_insight_evidence ie
             WHERE ie.insight_id = i.id
           ), '[]'::json) AS evidence_ids
    FROM crm_research_insights i
  `;

  private mapInsight(row: Record<string, unknown>): ResearchInsightRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      statement: String(row.statement),
      observation: row.observation != null ? String(row.observation) : null,
      interpretation: row.interpretation != null ? String(row.interpretation) : null,
      implication: row.implication != null ? String(row.implication) : null,
      recommendation: row.recommendation != null ? String(row.recommendation) : null,
      audience: row.audience != null ? String(row.audience) : null,
      status: row.status as InsightStatus,
      confidence_rationale: row.confidence_rationale != null ? String(row.confidence_rationale) : null,
      confidence_json: row.confidence_json != null ? parseJsonCol(row.confidence_json, null) : null,
      ai_generated: Boolean(row.ai_generated),
      created_by: row.created_by != null ? String(row.created_by) : null,
      valid_from: row.valid_from != null ? String(row.valid_from) : null,
      valid_to: row.valid_to != null ? String(row.valid_to) : null,
      is_stale: isInsightStale(row.valid_to != null ? String(row.valid_to) : null),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      evidence_ids: parseJsonCol<number[]>(row.evidence_ids, []).map(Number),
    };
  }

  async listInsights(projectId: number): Promise<ResearchInsightRow[]> {
    const result = await this.db.query(
      `${this.insightSelect} WHERE i.project_id = $1 ORDER BY i.id ASC`,
      [projectId],
    );
    return result.rows.map((row) => this.mapInsight(row));
  }

  async listInsightValidToForProject(
    projectId: number,
    insightIds: number[],
  ): Promise<Map<number, string | null>> {
    const ids = [...new Set(insightIds.filter((n) => Number.isFinite(n) && n > 0))];
    const map = new Map<number, string | null>();
    if (!ids.length) return map;
    const result = await this.db.query(
      `SELECT i.id, i.valid_to::text AS valid_to
       FROM crm_research_insights i
       WHERE i.project_id = $1 AND i.id = ANY($2::int[])`,
      [projectId, ids],
    );
    for (const row of result.rows) {
      map.set(Number(row.id), row.valid_to != null ? String(row.valid_to) : null);
    }
    return map;
  }

  async listApprovedInsightsByClient(clientId: string): Promise<ResearchInsightRow[]> {
    const result = await this.db.query(
      `${this.insightSelect}
       JOIN crm_research_projects p ON p.id = i.project_id
       WHERE p.client_id = $1
         AND i.status = ANY($2::text[])
       ORDER BY i.id ASC`,
      [clientId, APPROVED_INTERNAL_PLUS],
    );
    return result.rows.map((row) => this.mapInsight(row));
  }

  async getInsight(id: number): Promise<ResearchInsightRow | null> {
    const result = await this.db.query(`${this.insightSelect} WHERE i.id = $1`, [id]);
    const row = result.rows[0];
    return row ? this.mapInsight(row) : null;
  }

  async createInsight(
    projectId: number,
    input: CreateInsightInput,
    actor: string,
  ): Promise<ResearchInsightRow> {
    const result = await this.db.query(
      `INSERT INTO crm_research_insights (
         project_id, statement, observation, interpretation, implication, recommendation,
         audience, status, confidence_rationale, confidence_json, created_by, valid_from, valid_to, ai_generated
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        projectId,
        input.statement.trim(),
        input.observation?.trim() || null,
        input.interpretation?.trim() || null,
        input.implication?.trim() || null,
        input.recommendation?.trim() || null,
        input.audience?.trim() || null,
        input.confidence_rationale?.trim() || null,
        input.confidence_json != null ? JSON.stringify(input.confidence_json) : null,
        actor,
        input.valid_from?.trim() || null,
        input.valid_to?.trim() || null,
        Boolean(input.ai_generated),
      ],
    );
    await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
      projectId,
    ]);
    const row = await this.getInsight(Number(result.rows[0].id));
    if (!row) throw new Error(`createInsight failed for project ${projectId}`);
    return row;
  }

  async patchInsight(id: number, input: PatchInsightInput): Promise<ResearchInsightRow | null> {
    const sets: string[] = ['updated_at = now()'];
    const params: unknown[] = [];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if (input.statement != null) add('statement', input.statement.trim());
    if (input.observation !== undefined) add('observation', input.observation?.trim() || null);
    if (input.interpretation !== undefined) {
      add('interpretation', input.interpretation?.trim() || null);
    }
    if (input.implication !== undefined) add('implication', input.implication?.trim() || null);
    if (input.recommendation !== undefined) {
      add('recommendation', input.recommendation?.trim() || null);
    }
    if (input.audience !== undefined) add('audience', input.audience?.trim() || null);
    if (input.confidence_rationale !== undefined) {
      add('confidence_rationale', input.confidence_rationale?.trim() || null);
    }
    if (input.confidence_json !== undefined) {
      add('confidence_json', input.confidence_json == null ? null : JSON.stringify(input.confidence_json));
    }
    if (input.valid_from !== undefined) add('valid_from', input.valid_from?.trim() || null);
    if (input.valid_to !== undefined) add('valid_to', input.valid_to?.trim() || null);
    if (sets.length === 1) return this.getInsight(id);
    params.push(id);
    await this.db.query(
      `UPDATE crm_research_insights SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    );
    return this.getInsight(id);
  }

  async replaceInsightEvidence(insightId: number, evidenceIds: number[]): Promise<void> {
    await this.db.query(`DELETE FROM crm_research_insight_evidence WHERE insight_id = $1`, [
      insightId,
    ]);
    for (const evidenceId of evidenceIds) {
      await this.db.query(
        `INSERT INTO crm_research_insight_evidence (insight_id, evidence_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [insightId, evidenceId],
      );
    }
  }

  async countVerifiedEvidenceForInsight(insightId: number): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS n
       FROM crm_research_insight_evidence ie
       JOIN crm_research_evidence e ON e.id = ie.evidence_id
       WHERE ie.insight_id = $1 AND e.qc_status = 'verified'`,
      [insightId],
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  async updateInsightStatus(id: number, status: InsightStatus): Promise<ResearchInsightRow | null> {
    await this.db.query(
      `UPDATE crm_research_insights SET status = $1, updated_at = now() WHERE id = $2`,
      [status, id],
    );
    return this.getInsight(id);
  }

  private readonly aiRunSelect = `
    SELECT id, project_id, question_id, job_type, provider, model, status,
           credits_used, error_message, actor,
           created_at::text AS created_at, finished_at::text AS finished_at
    FROM crm_research_ai_runs
  `;

  private mapAiRun(row: Record<string, unknown>): ResearchAiRunRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      question_id: row.question_id != null ? Number(row.question_id) : null,
      job_type: String(row.job_type),
      provider: String(row.provider),
      model: row.model != null ? String(row.model) : null,
      status: String(row.status),
      credits_used: Number(row.credits_used ?? 0),
      error_message: row.error_message != null ? String(row.error_message) : null,
      actor: row.actor != null ? String(row.actor) : null,
      created_at: String(row.created_at),
      finished_at: row.finished_at != null ? String(row.finished_at) : null,
    };
  }

  async findInFlightDeskRun(
    projectId: number,
    questionId: number,
  ): Promise<ResearchAiRunRow | null> {
    const result = await this.db.query(
      `${this.aiRunSelect}
       WHERE project_id = $1 AND question_id = $2
         AND job_type = 'desk_tavily'
         AND status IN ('pending', 'running')
       ORDER BY id DESC LIMIT 1`,
      [projectId, questionId],
    );
    const row = result.rows[0];
    return row ? this.mapAiRun(row) : null;
  }

  async findInFlightDeepRun(
    projectId: number,
    questionId: number,
  ): Promise<ResearchAiRunRow | null> {
    const result = await this.db.query(
      `${this.aiRunSelect}
       WHERE project_id = $1 AND question_id = $2
         AND job_type = 'deep_research'
         AND status IN ('pending', 'running')
       ORDER BY id DESC LIMIT 1`,
      [projectId, questionId],
    );
    const row = result.rows[0];
    return row ? this.mapAiRun(row) : null;
  }

  async findInFlightTriangulateRun(
    projectId: number,
    questionId: number,
  ): Promise<ResearchAiRunRow | null> {
    const result = await this.db.query(
      `${this.aiRunSelect}
       WHERE project_id = $1 AND question_id = $2
         AND job_type = 'research_triangulate'
         AND status IN ('pending', 'running')
       ORDER BY id DESC LIMIT 1`,
      [projectId, questionId],
    );
    const row = result.rows[0];
    return row ? this.mapAiRun(row) : null;
  }

  async findInFlightPulseRun(projectId: number): Promise<ResearchAiRunRow | null> {
    const result = await this.db.query(
      `${this.aiRunSelect}
       WHERE project_id = $1
         AND job_type = 'research_pulse'
         AND status IN ('pending', 'running')
       ORDER BY id DESC LIMIT 1`,
      [projectId],
    );
    const row = result.rows[0];
    return row ? this.mapAiRun(row) : null;
  }

  async acceptSingleSource(id: number): Promise<ResearchSourceRow | null> {
    const result = await this.db.query(
      `UPDATE crm_research_sources
       SET single_source_accepted = true, updated_at = now()
       WHERE id = $1
       RETURNING id, project_id, question_id, source_type, title, publisher, url,
                 published_at::text AS published_at, accessed_at::text AS accessed_at,
                 geo, license_note, reliability_tier, limitation_note, snapshot_uri, content_hash,
                 ai_generated, keep, triangulated, single_source_accepted, superseded_by,
                 created_at::text AS created_at, updated_at::text AS updated_at`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.mapSource(row) : null;
  }

  async insertAiRun(input: {
    projectId: number;
    questionId?: number | null;
    jobType: string;
    provider: string;
    actor: string;
    model?: string | null;
  }): Promise<ResearchAiRunRow> {
    const result = await this.db.query(
      `INSERT INTO crm_research_ai_runs (
         project_id, question_id, job_type, provider, model, status, actor
       ) VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING id, project_id, question_id, job_type, provider, model, status,
                 credits_used, error_message, actor,
                 created_at::text AS created_at, finished_at::text AS finished_at`,
      [
        input.projectId,
        input.questionId ?? null,
        input.jobType,
        input.provider,
        input.model ?? null,
        input.actor,
      ],
    );
    return this.mapAiRun(result.rows[0]);
  }

  async succeedAiRun(
    runId: number,
    input: {
      model?: string | null;
      promptVersion?: string | null;
      inputHash?: string | null;
      outputJson?: unknown;
      creditsUsed?: number;
    },
  ): Promise<ResearchAiRunRow | null> {
    const result = await this.db.query(
      `UPDATE crm_research_ai_runs
       SET status = 'succeeded',
           model = COALESCE($1, model),
           prompt_version = $2,
           input_hash = $3,
           output_json = $4::jsonb,
           credits_used = $5,
           finished_at = now()
       WHERE id = $6
       RETURNING id, project_id, question_id, job_type, provider, model, status,
                 credits_used, error_message, actor,
                 created_at::text AS created_at, finished_at::text AS finished_at`,
      [
        input.model ?? null,
        input.promptVersion ?? null,
        input.inputHash ?? null,
        JSON.stringify(input.outputJson ?? {}),
        input.creditsUsed ?? 0,
        runId,
      ],
    );
    const row = result.rows[0];
    return row ? this.mapAiRun(row) : null;
  }

  async createReportDraft(input: {
    projectId: number;
    contentSnapshot: Record<string, unknown>;
    generatedBy: string;
  }): Promise<{
    report_id: number;
    version_id: number;
    version: number;
    content_snapshot: Record<string, unknown>;
    content_hash: string;
  }> {
    return this.insertReportVersion(input);
  }

  async insertReportVersion(input: {
    projectId: number;
    contentSnapshot: Record<string, unknown>;
    generatedBy: string;
  }): Promise<{
    report_id: number;
    version_id: number;
    version: number;
    content_snapshot: Record<string, unknown>;
    content_hash: string;
  }> {
    const snapshot = { ...input.contentSnapshot, status: 'draft' };
    const hash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    const existing = await this.db.query(
      `SELECT id FROM crm_research_reports WHERE project_id = $1 ORDER BY id DESC LIMIT 1`,
      [input.projectId],
    );
    let reportId: number;
    if (existing.rows[0]) {
      reportId = Number(existing.rows[0].id);
    } else {
      const report = await this.db.query(
        `INSERT INTO crm_research_reports (project_id, template, status)
         VALUES ($1, 'dv12_cb_v1', 'draft')
         RETURNING id`,
        [input.projectId],
      );
      reportId = Number(report.rows[0].id);
    }
    const next = await this.db.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS version
       FROM crm_research_report_versions WHERE report_id = $1`,
      [reportId],
    );
    const version = Number(next.rows[0].version);
    const inserted = await this.db.query(
      `INSERT INTO crm_research_report_versions (
         report_id, version, content_snapshot, generated_by, content_hash
       ) VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING id`,
      [reportId, version, JSON.stringify(snapshot), input.generatedBy, hash],
    );
    return {
      report_id: reportId,
      version_id: Number(inserted.rows[0].id),
      version,
      content_snapshot: snapshot,
      content_hash: hash,
    };
  }

  async listReports(projectId: number): Promise<ResearchReportRow[]> {
    const reports = await this.db.query(
      `SELECT id, project_id, template, status, created_at::text AS created_at
       FROM crm_research_reports
       WHERE project_id = $1
       ORDER BY id ASC`,
      [projectId],
    );
    const versions = await this.db.query(
      `SELECT v.id, v.report_id, v.version, v.content_snapshot, v.generated_by,
              v.content_hash, v.embargo_until::text AS embargo_until,
              v.expires_at::text AS expires_at, v.portal_visible,
              v.published_by, v.published_at::text AS published_at,
              v.created_at::text AS created_at
       FROM crm_research_report_versions v
       JOIN crm_research_reports r ON r.id = v.report_id
       WHERE r.project_id = $1
       ORDER BY v.report_id ASC, v.version ASC`,
      [projectId],
    );
    const byReport = new Map<number, ResearchReportVersionRow[]>();
    for (const row of versions.rows) {
      const reportId = Number(row.report_id);
      const list = byReport.get(reportId) ?? [];
      list.push(this.mapReportVersion(row));
      byReport.set(reportId, list);
    }
    return reports.rows.map((row) => ({
      id: Number(row.id),
      project_id: Number(row.project_id),
      template: String(row.template),
      status: String(row.status),
      created_at: String(row.created_at),
      versions: byReport.get(Number(row.id)) ?? [],
    }));
  }

  async getReport(reportId: number): Promise<{ id: number; project_id: number; status: string } | null> {
    const result = await this.db.query(
      `SELECT id, project_id, status FROM crm_research_reports WHERE id = $1`,
      [reportId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      status: String(row.status),
    };
  }

  async updateReportVersionSnapshot(
    reportId: number,
    versionId: number,
    contentSnapshot: Record<string, unknown>,
  ): Promise<ResearchReportVersionRow | null> {
    const hash = createHash('sha256').update(JSON.stringify(contentSnapshot)).digest('hex');
    const result = await this.db.query(
      `UPDATE crm_research_report_versions
       SET content_snapshot = $3::jsonb, content_hash = $4
       WHERE id = $1 AND report_id = $2
       RETURNING id, report_id, version, content_snapshot, generated_by, content_hash,
                 embargo_until::text AS embargo_until, expires_at::text AS expires_at,
                 portal_visible, published_by, published_at::text AS published_at,
                 created_at::text AS created_at`,
      [versionId, reportId, JSON.stringify(contentSnapshot), hash],
    );
    const row = result.rows[0];
    return row ? this.mapReportVersion(row) : null;
  }

  async getReportVersion(
    reportId: number,
    versionId: number,
  ): Promise<ResearchReportVersionRow | null> {
    const result = await this.db.query(
      `SELECT id, report_id, version, content_snapshot, generated_by, content_hash,
              embargo_until::text AS embargo_until, expires_at::text AS expires_at,
              portal_visible, published_by, published_at::text AS published_at,
              created_at::text AS created_at
       FROM crm_research_report_versions
       WHERE id = $1 AND report_id = $2`,
      [versionId, reportId],
    );
    const row = result.rows[0];
    return row ? this.mapReportVersion(row) : null;
  }

  async updateReportVersionEmbargo(
    reportId: number,
    versionId: number,
    input: { embargo_until?: string | null; expires_at?: string | null },
  ): Promise<ResearchReportVersionRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (input.embargo_until !== undefined) {
      params.push(input.embargo_until);
      sets.push(`embargo_until = $${params.length}`);
    }
    if (input.expires_at !== undefined) {
      params.push(input.expires_at);
      sets.push(`expires_at = $${params.length}`);
    }
    if (!sets.length) return this.getReportVersion(reportId, versionId);
    params.push(versionId, reportId);
    const result = await this.db.query(
      `UPDATE crm_research_report_versions
       SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND report_id = $${params.length}
       RETURNING id, report_id, version, content_snapshot, generated_by, content_hash,
                 embargo_until::text AS embargo_until, expires_at::text AS expires_at,
                 portal_visible, published_by, published_at::text AS published_at,
                 created_at::text AS created_at`,
      params,
    );
    const row = result.rows[0];
    return row ? this.mapReportVersion(row) : null;
  }

  async updateReportVersionPortalVisible(
    reportId: number,
    versionId: number,
    visible: boolean,
    actor?: string,
  ): Promise<ResearchReportVersionRow | null> {
    const result = await this.db.query(
      visible
        ? `UPDATE crm_research_report_versions
       SET portal_visible = $3, published_by = $4, published_at = now()
       WHERE id = $1 AND report_id = $2
       RETURNING id, report_id, version, content_snapshot, generated_by, content_hash,
                 embargo_until::text AS embargo_until, expires_at::text AS expires_at,
                 portal_visible, published_by, published_at::text AS published_at,
                 created_at::text AS created_at`
        : `UPDATE crm_research_report_versions
       SET portal_visible = $3
       WHERE id = $1 AND report_id = $2
       RETURNING id, report_id, version, content_snapshot, generated_by, content_hash,
                 embargo_until::text AS embargo_until, expires_at::text AS expires_at,
                 portal_visible, published_by, published_at::text AS published_at,
                 created_at::text AS created_at`,
      visible ? [versionId, reportId, visible, actor ?? null] : [versionId, reportId, visible],
    );
    const row = result.rows[0];
    return row ? this.mapReportVersion(row) : null;
  }

  private mapReportVersion(row: Record<string, unknown>): ResearchReportVersionRow {
    const snapshot = parseJsonCol<Record<string, unknown>>(row.content_snapshot, {});
    return {
      id: Number(row.id),
      report_id: Number(row.report_id),
      version: Number(row.version),
      content_snapshot: {
        ...snapshot,
        exec: normalizeReportExec(snapshot.exec),
      },
      generated_by: row.generated_by != null ? String(row.generated_by) : null,
      content_hash: String(row.content_hash),
      embargo_until: row.embargo_until != null ? String(row.embargo_until) : null,
      expires_at: row.expires_at != null ? String(row.expires_at) : null,
      portal_visible: Boolean(row.portal_visible),
      published_by: row.published_by != null ? String(row.published_by) : null,
      published_at: row.published_at != null ? String(row.published_at) : null,
      created_at: String(row.created_at),
    };
  }

  async failAiRun(runId: number, error: string): Promise<ResearchAiRunRow | null> {
    const result = await this.db.query(
      `UPDATE crm_research_ai_runs
       SET status = 'failed', error_message = $1, finished_at = now()
       WHERE id = $2
       RETURNING id, project_id, question_id, job_type, provider, model, status,
                 credits_used, error_message, actor,
                 created_at::text AS created_at, finished_at::text AS finished_at`,
      [error, runId],
    );
    const row = result.rows[0];
    return row ? this.mapAiRun(row) : null;
  }

  async getAiRun(projectId: number, runId: number): Promise<ResearchAiRunRow | null> {
    const result = await this.db.query(
      `${this.aiRunSelect} WHERE id = $1 AND project_id = $2`,
      [runId, projectId],
    );
    const row = result.rows[0];
    return row ? this.mapAiRun(row) : null;
  }

  async listRecentAiRuns(projectId: number, limit = 20): Promise<ResearchAiRunRow[]> {
    const result = await this.db.query(
      `${this.aiRunSelect} WHERE project_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
      [projectId, limit],
    );
    return result.rows.map((row) => this.mapAiRun(row));
  }

  async sumTavilyCredits(projectId: number): Promise<number> {
    const result = await this.db.query(
      `SELECT COALESCE(SUM(credits_used), 0)::int AS n
       FROM crm_research_ai_runs
       WHERE project_id = $1 AND job_type IN ('desk_tavily', 'deep_research', 'research_triangulate', 'research_pulse')`,
      [projectId],
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  private mapCompetitorSnapshot(row: Record<string, unknown>): ResearchCompetitorSnapshotRow {
    return {
      id: Number(row.id),
      competitor_id: Number(row.competitor_id),
      project_id: Number(row.project_id),
      source_id: Number(row.source_id),
      observed_at: String(row.observed_at),
      kind: row.kind === 'hypothesis' ? 'hypothesis' : 'fact',
      fact: parseJsonCol(row.fact, {}),
      limitation_note: row.limitation_note != null ? String(row.limitation_note) : null,
      created_by: row.created_by != null ? String(row.created_by) : null,
      created_at: String(row.created_at),
    };
  }

  private mapCompetitor(
    row: Record<string, unknown>,
    snapshots: ResearchCompetitorSnapshotRow[],
  ): ResearchCompetitorRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      name: String(row.name),
      aliases: parseJsonCol<string[]>(row.aliases, []),
      created_by: row.created_by != null ? String(row.created_by) : null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      snapshots,
    };
  }

  private readonly competitorSelect = `
    SELECT id, project_id, name, aliases,
           created_by, created_at::text AS created_at, updated_at::text AS updated_at
    FROM crm_research_competitors
  `;

  private readonly snapshotSelect = `
    SELECT id, competitor_id, project_id, source_id, observed_at::text AS observed_at,
           kind, fact, limitation_note, created_by, created_at::text AS created_at
    FROM crm_research_competitor_snapshots
  `;

  async listSnapshots(projectId: number): Promise<ResearchCompetitorSnapshotRow[]> {
    const result = await this.db.query(
      `${this.snapshotSelect} WHERE project_id = $1 ORDER BY id ASC`,
      [projectId],
    );
    return result.rows.map((row) => this.mapCompetitorSnapshot(row));
  }

  async listCompetitors(projectId: number): Promise<ResearchCompetitorRow[]> {
    const [comps, snaps] = await Promise.all([
      this.db.query(`${this.competitorSelect} WHERE project_id = $1 ORDER BY id ASC`, [projectId]),
      this.listSnapshots(projectId),
    ]);
    const byComp = new Map<number, ResearchCompetitorSnapshotRow[]>();
    for (const snap of snaps) {
      const list = byComp.get(snap.competitor_id) ?? [];
      list.push(snap);
      byComp.set(snap.competitor_id, list);
    }
    return comps.rows.map((row) => this.mapCompetitor(row, byComp.get(Number(row.id)) ?? []));
  }

  async getCompetitor(id: number): Promise<ResearchCompetitorRow | null> {
    const result = await this.db.query(`${this.competitorSelect} WHERE id = $1`, [id]);
    const row = result.rows[0];
    if (!row) return null;
    const snaps = await this.db.query(
      `${this.snapshotSelect} WHERE competitor_id = $1 ORDER BY id ASC`,
      [id],
    );
    return this.mapCompetitor(
      row,
      snaps.rows.map((s) => this.mapCompetitorSnapshot(s)),
    );
  }

  async createCompetitor(
    projectId: number,
    input: CreateCompetitorInput,
    actor: string,
  ): Promise<ResearchCompetitorRow> {
    const result = await this.db.query(
      `INSERT INTO crm_research_competitors (project_id, name, aliases, created_by)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING id, project_id, name, aliases,
                 created_by, created_at::text AS created_at, updated_at::text AS updated_at`,
      [projectId, input.name.trim(), JSON.stringify(input.aliases ?? []), actor],
    );
    await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
      projectId,
    ]);
    return this.mapCompetitor(result.rows[0], []);
  }

  async patchCompetitor(id: number, input: PatchCompetitorInput): Promise<ResearchCompetitorRow | null> {
    const sets: string[] = ['updated_at = now()'];
    const vals: unknown[] = [];
    if (input.name != null) {
      vals.push(input.name.trim());
      sets.push(`name = $${vals.length}`);
    }
    if (input.aliases != null) {
      vals.push(JSON.stringify(input.aliases));
      sets.push(`aliases = $${vals.length}::jsonb`);
    }
    vals.push(id);
    const result = await this.db.query(
      `UPDATE crm_research_competitors SET ${sets.join(', ')} WHERE id = $${vals.length}
       RETURNING id, project_id, name, aliases,
                 created_by, created_at::text AS created_at, updated_at::text AS updated_at`,
      vals,
    );
    const row = result.rows[0];
    if (!row) return null;
    const snaps = await this.db.query(
      `${this.snapshotSelect} WHERE competitor_id = $1 ORDER BY id ASC`,
      [id],
    );
    return this.mapCompetitor(
      row,
      snaps.rows.map((s) => this.mapCompetitorSnapshot(s)),
    );
  }

  async createCompetitorSnapshot(
    competitorId: number,
    projectId: number,
    input: CreateCompetitorSnapshotInput & {
      source_id: number;
      observed_at: string;
      kind: 'fact' | 'hypothesis';
      fact: unknown;
    },
    actor: string,
  ): Promise<ResearchCompetitorSnapshotRow> {
    const result = await this.db.query(
      `INSERT INTO crm_research_competitor_snapshots (
         competitor_id, project_id, source_id, observed_at, kind, fact, limitation_note, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       RETURNING id, competitor_id, project_id, source_id, observed_at::text AS observed_at,
                 kind, fact, limitation_note, created_by, created_at::text AS created_at`,
      [
        competitorId,
        projectId,
        input.source_id,
        input.observed_at,
        input.kind,
        JSON.stringify(input.fact ?? {}),
        input.limitation_note?.trim() || null,
        actor,
      ],
    );
    return this.mapCompetitorSnapshot(result.rows[0]);
  }

  private mapWave(row: Record<string, unknown>): ResearchWave {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      wave_no: Number(row.wave_no),
      label: row.label != null ? String(row.label) : null,
      field_start: row.field_start != null ? String(row.field_start) : null,
      field_end: row.field_end != null ? String(row.field_end) : null,
      metric_json: parseJsonCol<{ key: string; value: number | null }[]>(row.metric_json, []),
      created_at: String(row.created_at),
    };
  }

  private readonly waveSelect = `
    SELECT id, project_id, wave_no, label,
           field_start::text AS field_start, field_end::text AS field_end,
           metric_json, created_at::text AS created_at
    FROM crm_research_waves
  `;

  async listWaves(projectId: number): Promise<ResearchWave[]> {
    const result = await this.db.query(
      `${this.waveSelect} WHERE project_id = $1 ORDER BY wave_no ASC`,
      [projectId],
    );
    return result.rows.map((row) => this.mapWave(row));
  }

  async createWave(
    projectId: number,
    input: CreateWaveInput,
    actor: string,
  ): Promise<ResearchWave> {
    const result = await this.db.query(
      `INSERT INTO crm_research_waves (
         project_id, wave_no, label, field_start, field_end, metric_json, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING id, project_id, wave_no, label,
                 field_start::text AS field_start, field_end::text AS field_end,
                 metric_json, created_at::text AS created_at`,
      [
        projectId,
        input.wave_no,
        input.label ?? null,
        input.field_start ?? null,
        input.field_end ?? null,
        JSON.stringify(input.metric_json ?? []),
        actor,
      ],
    );
    await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
      projectId,
    ]);
    return this.mapWave(result.rows[0]);
  }

  private mapVwSummary(row: Record<string, unknown>): ResearchVwSummaryRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      study_id: row.study_id != null ? Number(row.study_id) : null,
      unit: String(row.unit),
      n: Number(row.n),
      bins: parseJsonCol<VwBin[]>(row.bins, []),
      points: parseJsonCol<VwPoints>(row.points, { pmc: null, pme: null, opp: null, idp: null }),
      limitation_note: String(row.limitation_note),
      statistical_inference: false,
      created_by: row.created_by != null ? String(row.created_by) : null,
      created_at: String(row.created_at),
    };
  }

  private readonly vwSummarySelect = `
    SELECT id, project_id, study_id, unit, n, bins, points, limitation_note,
           statistical_inference, created_by, created_at::text AS created_at
    FROM crm_research_vw_summaries
  `;

  async getLatestVwSummary(projectId: number): Promise<ResearchVwSummaryRow | null> {
    const result = await this.db.query(
      `${this.vwSummarySelect} WHERE project_id = $1 ORDER BY id DESC LIMIT 1`,
      [projectId],
    );
    const row = result.rows[0];
    return row ? this.mapVwSummary(row) : null;
  }

  async insertVwSummary(
    projectId: number,
    input: {
      study_id: number | null;
      unit: string;
      n: number;
      bins: VwBin[];
      points: VwPoints;
      limitation_note: string;
      statistical_inference: false;
    },
    actor: string,
  ): Promise<ResearchVwSummaryRow> {
    const result = await this.db.query(
      `INSERT INTO crm_research_vw_summaries (
         project_id, study_id, unit, n, bins, points, limitation_note,
         statistical_inference, created_by
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)
       RETURNING id, project_id, study_id, unit, n, bins, points, limitation_note,
                 statistical_inference, created_by, created_at::text AS created_at`,
      [
        projectId,
        input.study_id,
        input.unit,
        input.n,
        JSON.stringify(input.bins ?? []),
        JSON.stringify(input.points ?? { pmc: null, pme: null, opp: null, idp: null }),
        input.limitation_note,
        false,
        actor,
      ],
    );
    return this.mapVwSummary(result.rows[0]);
  }

  private mapCjSummary(row: Record<string, unknown>): ResearchCjSummaryRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      study_id: row.study_id != null ? Number(row.study_id) : null,
      n: Number(row.n),
      n_choices: Number(row.n_choices),
      attributes: parseJsonCol(row.attributes, []),
      recommendation: parseJsonCol(row.recommendation, { levels: [] }),
      limitation_note: String(row.limitation_note),
      statistical_inference: false,
      created_by: row.created_by != null ? String(row.created_by) : null,
      created_at: String(row.created_at),
    };
  }

  private readonly cjSummarySelect = `
    SELECT id, project_id, study_id, n, n_choices, attributes, recommendation,
           limitation_note, statistical_inference, created_by, created_at::text AS created_at
    FROM crm_research_cj_summaries
  `;

  async getLatestCjSummary(projectId: number): Promise<ResearchCjSummaryRow | null> {
    const result = await this.db.query(
      `${this.cjSummarySelect} WHERE project_id = $1 ORDER BY id DESC LIMIT 1`,
      [projectId],
    );
    const row = result.rows[0];
    return row ? this.mapCjSummary(row) : null;
  }

  async insertCjSummary(
    projectId: number,
    input: {
      study_id: number | null;
      n: number;
      n_choices: number;
      attributes: CjAttributeSummary[];
      recommendation: CjRecommendation;
      limitation_note: string;
      statistical_inference: false;
    },
    actor: string,
  ): Promise<ResearchCjSummaryRow> {
    const result = await this.db.query(
      `INSERT INTO crm_research_cj_summaries (
         project_id, study_id, n, n_choices, attributes, recommendation,
         limitation_note, statistical_inference, created_by
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)
       RETURNING id, project_id, study_id, n, n_choices, attributes, recommendation,
                 limitation_note, statistical_inference, created_by, created_at::text AS created_at`,
      [
        projectId,
        input.study_id,
        input.n,
        input.n_choices,
        JSON.stringify(input.attributes ?? []),
        JSON.stringify(input.recommendation ?? { levels: [] }),
        input.limitation_note,
        false,
        actor,
      ],
    );
    return this.mapCjSummary(result.rows[0]);
  }

  async insertCjWhatIfRun(
    projectId: number,
    studyId: number | null,
    result: CjWhatIfResult,
    actor: string,
  ): Promise<CjWhatIfRunRow> {
    const inserted = await this.db.query(
      `INSERT INTO crm_research_cj_whatif_runs (
         project_id, study_id, scenario, n_match, n_choices, match_pct,
         limitation_note, statistical_inference, created_by
       ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9)
       RETURNING id, project_id, study_id, scenario, n_match, n_choices, match_pct,
                 limitation_note, statistical_inference, created_by, created_at::text AS created_at`,
      [
        projectId,
        studyId,
        JSON.stringify(result.scenario ?? {}),
        result.n_match,
        result.n_choices,
        result.match_pct,
        result.limitation_note,
        false,
        actor,
      ],
    );
    return this.mapCjWhatIfRun(inserted.rows[0]);
  }

  async listCjWhatIfRuns(projectId: number, limit = 20): Promise<CjWhatIfRunRow[]> {
    const capped = Math.min(Math.max(Number(limit) || 20, 1), 20);
    const result = await this.db.query(
      `SELECT id, project_id, study_id, scenario, n_match, n_choices, match_pct,
              limitation_note, statistical_inference, created_by, created_at::text AS created_at
         FROM crm_research_cj_whatif_runs
        WHERE project_id = $1
        ORDER BY id DESC
        LIMIT $2`,
      [projectId, capped],
    );
    return result.rows.map((row) => this.mapCjWhatIfRun(row));
  }

  private mapCjWhatIfRun(row: Record<string, unknown>): CjWhatIfRunRow {
    const scenarioRaw = parseJsonCol<Record<string, string>>(row.scenario, {});
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      study_id: row.study_id != null ? Number(row.study_id) : null,
      scenario: scenarioRaw,
      n_match: Number(row.n_match),
      n_choices: Number(row.n_choices),
      match_pct: Number(row.match_pct),
      limitation_note: String(row.limitation_note),
      statistical_inference: false,
      created_by: row.created_by != null ? String(row.created_by) : null,
      created_at: String(row.created_at),
    };
  }

  private mapDecision(row: Record<string, unknown>): ResearchDecision {
    const status = String(row.status);
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      insight_id: Number(row.insight_id),
      decision_text: String(row.decision_text),
      owner_email: String(row.owner_email),
      due_at: row.due_at != null ? String(row.due_at) : null,
      status: status as ResearchDecision['status'],
      created_by: row.created_by != null ? String(row.created_by) : null,
      created_at: String(row.created_at),
    };
  }

  private readonly decisionSelect = `
    SELECT id, project_id, insight_id, decision_text, owner_email,
           due_at::text AS due_at, status, created_by,
           created_at::text AS created_at
    FROM crm_research_decisions
  `;

  async listDecisions(projectId: number): Promise<ResearchDecision[]> {
    const result = await this.db.query(
      `${this.decisionSelect} WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId],
    );
    return result.rows.map((row) => this.mapDecision(row));
  }

  async getDecision(id: number): Promise<ResearchDecision | null> {
    const result = await this.db.query(`${this.decisionSelect} WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row ? this.mapDecision(row) : null;
  }

  async createDecision(
    projectId: number,
    input: CreateDecisionInput,
    actor: string,
  ): Promise<ResearchDecision> {
    const result = await this.db.query(
      `INSERT INTO crm_research_decisions (
         project_id, insight_id, decision_text, owner_email, due_at, status, created_by
       ) VALUES ($1, $2, $3, $4, $5, 'open', $6)
       RETURNING id, project_id, insight_id, decision_text, owner_email,
                 due_at::text AS due_at, status, created_by,
                 created_at::text AS created_at`,
      [
        projectId,
        input.insight_id,
        input.decision_text,
        input.owner_email,
        input.due_at ?? null,
        actor,
      ],
    );
    await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
      projectId,
    ]);
    return this.mapDecision(result.rows[0]);
  }

  async patchDecision(id: number, input: PatchDecisionInput): Promise<ResearchDecision | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, value: unknown) => {
      vals.push(value);
      sets.push(`${col} = $${vals.length}`);
    };
    if (input.status != null) add('status', input.status);
    if (input.due_at !== undefined) add('due_at', input.due_at);
    if (input.owner_email != null) add('owner_email', input.owner_email);
    if (sets.length === 0) {
      return this.getDecision(id);
    }
    vals.push(id);
    const result = await this.db.query(
      `UPDATE crm_research_decisions SET ${sets.join(', ')} WHERE id = $${vals.length}
       RETURNING id, project_id, insight_id, decision_text, owner_email,
                 due_at::text AS due_at, status, created_by,
                 created_at::text AS created_at`,
      vals,
    );
    const row = result.rows[0];
    return row ? this.mapDecision(row) : null;
  }

  private mapStudy(row: Record<string, unknown>): ResearchStudy {
    const method = String(row.method);
    const mode = row.mode != null ? String(row.mode) : null;
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      name: String(row.name),
      method: method as ResearchStudy['method'],
      n: row.n != null ? Number(row.n) : null,
      field_start: row.field_start != null ? String(row.field_start) : null,
      field_end: row.field_end != null ? String(row.field_end) : null,
      mode: mode as ResearchStudy['mode'],
      instrument_version: row.instrument_version != null ? String(row.instrument_version) : null,
      weighting_note: row.weighting_note != null ? String(row.weighting_note) : null,
    };
  }

  private mapConsent(row: Record<string, unknown>): ResearchConsent {
    const consentType = String(row.consent_type);
    return {
      id: Number(row.id),
      study_id: Number(row.study_id),
      project_id: Number(row.project_id),
      subject_code: String(row.subject_code),
      consent_type: consentType as ResearchConsent['consent_type'],
      recorded_at: String(row.recorded_at),
      expires_at: String(row.expires_at),
      notes: row.notes != null ? String(row.notes) : null,
    };
  }

  private readonly studySelect = `
    SELECT id, project_id, name, method, n,
           field_start::text AS field_start, field_end::text AS field_end,
           mode, instrument_version, weighting_note
    FROM crm_research_studies
  `;

  private readonly consentSelect = `
    SELECT id, study_id, project_id, subject_code, consent_type,
           recorded_at::text AS recorded_at, expires_at::text AS expires_at, notes
    FROM crm_research_consents
  `;

  async listStudies(projectId: number): Promise<ResearchStudy[]> {
    const result = await this.db.query(`${this.studySelect} WHERE project_id = $1 ORDER BY id ASC`, [
      projectId,
    ]);
    return result.rows.map((row) => this.mapStudy(row));
  }

  async getStudy(id: number): Promise<ResearchStudy | null> {
    const result = await this.db.query(`${this.studySelect} WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row ? this.mapStudy(row) : null;
  }

  async createStudy(
    projectId: number,
    input: CreateStudyInput,
    actor: string,
  ): Promise<ResearchStudy> {
    const result = await this.db.query(
      `INSERT INTO crm_research_studies (
         project_id, name, method, n, field_start, field_end, mode,
         instrument_version, weighting_note, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, project_id, name, method, n,
                 field_start::text AS field_start, field_end::text AS field_end,
                 mode, instrument_version, weighting_note`,
      [
        projectId,
        input.name.trim(),
        input.method,
        input.n ?? null,
        input.field_start ?? null,
        input.field_end ?? null,
        input.mode ?? null,
        input.instrument_version ?? null,
        input.weighting_note ?? null,
        actor,
      ],
    );
    await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
      projectId,
    ]);
    return this.mapStudy(result.rows[0]);
  }

  async patchStudy(id: number, input: PatchStudyInput): Promise<ResearchStudy | null> {
    const sets: string[] = ['updated_at = now()'];
    const vals: unknown[] = [];
    const add = (col: string, value: unknown) => {
      vals.push(value);
      sets.push(`${col} = $${vals.length}`);
    };
    if (input.name != null) add('name', input.name.trim());
    if (input.n !== undefined) add('n', input.n);
    if (input.field_start !== undefined) add('field_start', input.field_start);
    if (input.field_end !== undefined) add('field_end', input.field_end);
    if (input.mode !== undefined) add('mode', input.mode);
    if (input.instrument_version !== undefined) add('instrument_version', input.instrument_version);
    if (input.weighting_note !== undefined) add('weighting_note', input.weighting_note);
    vals.push(id);
    const result = await this.db.query(
      `UPDATE crm_research_studies SET ${sets.join(', ')} WHERE id = $${vals.length}
       RETURNING id, project_id, name, method, n,
                 field_start::text AS field_start, field_end::text AS field_end,
                 mode, instrument_version, weighting_note`,
      vals,
    );
    const row = result.rows[0];
    return row ? this.mapStudy(row) : null;
  }

  async listConsents(studyId: number): Promise<ResearchConsent[]> {
    const result = await this.db.query(`${this.consentSelect} WHERE study_id = $1 ORDER BY id ASC`, [
      studyId,
    ]);
    return result.rows.map((row) => this.mapConsent(row));
  }

  async createConsent(
    studyId: number,
    projectId: number,
    input: CreateConsentInput & { recorded_at: Date; expires_at: Date },
    actor: string,
  ): Promise<ResearchConsent> {
    const result = await this.db.query(
      `INSERT INTO crm_research_consents (
         study_id, project_id, subject_code, consent_type, recorded_at, expires_at, notes, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, study_id, project_id, subject_code, consent_type,
                 recorded_at::text AS recorded_at, expires_at::text AS expires_at, notes`,
      [
        studyId,
        projectId,
        input.subject_code.trim(),
        input.consent_type,
        input.recorded_at,
        input.expires_at,
        input.notes?.trim() || null,
        actor,
      ],
    );
    return this.mapConsent(result.rows[0]);
  }

  private mapTrendSignal(row: Record<string, unknown>): TrendSignal {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      topic: String(row.topic),
      metric: String(row.metric),
      baseline: row.baseline != null ? Number(row.baseline) : null,
      current: row.current != null ? Number(row.current) : null,
      velocity: row.velocity != null ? Number(row.velocity) : null,
      lifecycle: row.lifecycle as TrendSignal['lifecycle'],
    };
  }

  async listTrendSignals(projectId: number): Promise<TrendSignal[]> {
    const result = await this.db.query(
      `SELECT id, project_id, topic, metric, baseline, current, velocity, lifecycle
       FROM crm_research_trend_signals
       WHERE project_id = $1
       ORDER BY id DESC`,
      [projectId],
    );
    return result.rows.map((row) => this.mapTrendSignal(row));
  }

  async insertTrendSignal(input: {
    projectId: number;
    topic: string;
    metric: string;
    baseline: number | null;
    current: number | null;
    velocity: number | null;
    lifecycle: TrendSignal['lifecycle'];
  }): Promise<TrendSignal> {
    const result = await this.db.query(
      `INSERT INTO crm_research_trend_signals (
         project_id, topic, metric, baseline, current, velocity, lifecycle
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, project_id, topic, metric, baseline, current, velocity, lifecycle`,
      [
        input.projectId,
        input.topic,
        input.metric,
        input.baseline,
        input.current,
        input.velocity,
        input.lifecycle,
      ],
    );
    return this.mapTrendSignal(result.rows[0]);
  }

  async insertReview(input: InsertReviewInput): Promise<{ id: number }> {
    const result = await this.db.query(
      `INSERT INTO crm_research_reviews (
         project_id, object_type, object_id, reviewer, role, decision, comments
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.project_id,
        input.object_type,
        input.object_id,
        input.reviewer,
        input.role,
        input.decision,
        input.comments ?? null,
      ],
    );
    return { id: Number(result.rows[0].id) };
  }

  async upsertInsightEmbedding(input: UpsertInsightEmbeddingInput): Promise<void> {
    if (input.write_vec) {
      await this.db.query(
        `INSERT INTO crm_research_insight_embeddings (insight_id, project_id, embedding, embed_text, embed_model, embed_dims, embedding_vec)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::vector)
         ON CONFLICT (insight_id) DO UPDATE SET
           project_id = EXCLUDED.project_id,
           embedding = EXCLUDED.embedding,
           embed_text = EXCLUDED.embed_text,
           embed_model = EXCLUDED.embed_model,
           embed_dims = EXCLUDED.embed_dims,
           embedding_vec = EXCLUDED.embedding_vec,
           updated_at = now()`,
        [
          input.insight_id,
          input.project_id,
          JSON.stringify(input.embedding),
          input.embed_text,
          input.embed_model,
          input.embed_dims,
          toPgvectorLiteral(input.embedding),
        ],
      );
      return;
    }
    await this.db.query(
      `INSERT INTO crm_research_insight_embeddings (insight_id, project_id, embedding, embed_text, embed_model, embed_dims)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)
       ON CONFLICT (insight_id) DO UPDATE SET
         project_id = EXCLUDED.project_id,
         embedding = EXCLUDED.embedding,
         embed_text = EXCLUDED.embed_text,
         embed_model = EXCLUDED.embed_model,
         embed_dims = EXCLUDED.embed_dims,
         updated_at = now()`,
      [
        input.insight_id,
        input.project_id,
        JSON.stringify(input.embedding),
        input.embed_text,
        input.embed_model,
        input.embed_dims,
      ],
    );
  }

  async deleteInsightEmbedding(insightId: number): Promise<void> {
    await this.db.query(`DELETE FROM crm_research_insight_embeddings WHERE insight_id = $1`, [
      insightId,
    ]);
  }

  private buildReembedStaleWhere(
    filters: {
      client_id?: string;
      allowedClientIds?: string[];
      target_dims: number;
      target_model: string;
    },
    params: unknown[],
  ): string {
    params.push(filters.target_dims);
    const dimsIdx = params.length;
    params.push(filters.target_model);
    const modelIdx = params.length;
    const where: string[] = [
      `i.status IN ('approved_client_facing', 'published')`,
      `(e.insight_id IS NULL OR e.embed_dims IS DISTINCT FROM $${dimsIdx} OR COALESCE(e.embed_model, '') <> $${modelIdx})`,
    ];
    const clientId = filters.client_id?.trim();
    if (clientId) {
      params.push(clientId);
      where.push(`p.client_id = $${params.length}`);
    }
    if (filters.allowedClientIds) {
      params.push(filters.allowedClientIds);
      where.push(`p.client_id = ANY($${params.length}::text[])`);
    }
    return where.join(' AND ');
  }

  async countReembedStale(filters: {
    client_id?: string;
    allowedClientIds?: string[];
    target_dims: number;
    target_model: string;
  }): Promise<number> {
    const params: unknown[] = [];
    const where = this.buildReembedStaleWhere(filters, params);
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS n
       FROM crm_research_insights i
       JOIN crm_research_projects p ON p.id = i.project_id
       LEFT JOIN crm_research_insight_embeddings e ON e.insight_id = i.id
       WHERE ${where}`,
      params,
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  async listReembedCandidates(filters: {
    client_id?: string;
    allowedClientIds?: string[];
    target_dims: number;
    target_model: string;
    limit: number;
  }): Promise<ReembedCandidate[]> {
    const params: unknown[] = [];
    const where = this.buildReembedStaleWhere(filters, params);
    params.push(Math.max(1, Math.min(filters.limit, 200)));
    const result = await this.db.query(
      `SELECT i.id AS insight_id,
              i.project_id,
              i.status,
              i.statement,
              i.observation,
              p.client_id,
              e.embed_dims,
              e.embed_model
       FROM crm_research_insights i
       JOIN crm_research_projects p ON p.id = i.project_id
       LEFT JOIN crm_research_insight_embeddings e ON e.insight_id = i.id
       WHERE ${where}
       ORDER BY i.id ASC
       LIMIT $${params.length}`,
      params,
    );
    return result.rows.map((row) => ({
      insight_id: Number(row.insight_id),
      project_id: Number(row.project_id),
      status: String(row.status),
      observation: row.observation != null ? String(row.observation) : null,
      statement: String(row.statement),
      client_id: row.client_id != null ? String(row.client_id) : undefined,
      embed_dims: row.embed_dims != null ? Number(row.embed_dims) : null,
      embed_model: row.embed_model != null ? String(row.embed_model) : null,
    }));
  }

  async listEmbeddings(filters: ListEmbeddingsFilters = {}): Promise<RagEmbeddingRow[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const clientId = filters.client_id?.trim();
    if (clientId) {
      params.push(clientId);
      where.push(`p.client_id = $${params.length}`);
    }
    if (filters.allowedClientIds) {
      params.push(filters.allowedClientIds);
      where.push(`p.client_id = ANY($${params.length}::text[])`);
    }
    const themeCode = filters.theme_code?.trim();
    if (themeCode) {
      params.push(themeCode);
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
    const extra = where.length ? `WHERE ${where.join(' AND ')}` : '';
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
       ${extra}
       GROUP BY e.insight_id, e.project_id, e.embedding, i.status, i.statement, i.observation, i.valid_to, p.client_id
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
      client_id: row.client_id != null ? String(row.client_id) : undefined,
      valid_to: row.valid_to != null ? String(row.valid_to) : null,
    }));
  }

  async listEmbeddingsByVec(
    filters: ListEmbeddingsFilters,
    queryVec: number[],
    limit = 50,
  ): Promise<RagEmbeddingRow[]> {
    const where: string[] = [
      'e.embedding_vec IS NOT NULL',
    ];
    const params: unknown[] = [];
    params.push(queryVec.length);
    where.push(`vector_dims(e.embedding_vec) = $${params.length}`);
    const clientId = filters.client_id?.trim();
    if (clientId) {
      params.push(clientId);
      where.push(`p.client_id = $${params.length}`);
    }
    if (filters.allowedClientIds) {
      params.push(filters.allowedClientIds);
      where.push(`p.client_id = ANY($${params.length}::text[])`);
    }
    const themeCode = filters.theme_code?.trim();
    if (themeCode) {
      params.push(themeCode);
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
      client_id: row.client_id != null ? String(row.client_id) : undefined,
      valid_to: row.valid_to != null ? String(row.valid_to) : null,
    }));
  }

  async listTaxonomy(): Promise<TaxonomyTheme[]> {
    const result = await this.db.query(
      `SELECT id, theme_code, label_vi, synonyms, active
       FROM crm_research_taxonomy
       ORDER BY theme_code ASC`,
    );
    return result.rows.map((row) => mapTaxonomy(row));
  }

  async getTaxonomy(id: number): Promise<TaxonomyTheme | null> {
    const result = await this.db.query(
      `SELECT id, theme_code, label_vi, synonyms, active
       FROM crm_research_taxonomy WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapTaxonomy(result.rows[0]) : null;
  }

  async createTaxonomy(input: CreateTaxonomyInput & { synonyms: string[] }): Promise<TaxonomyTheme> {
    const result = await this.db.query(
      `INSERT INTO crm_research_taxonomy (theme_code, label_vi, synonyms)
       VALUES ($1, $2, $3::text[])
       RETURNING id, theme_code, label_vi, synonyms, active`,
      [input.theme_code, input.label_vi, input.synonyms],
    );
    return mapTaxonomy(result.rows[0]);
  }

  async patchTaxonomy(id: number, input: PatchTaxonomyInput): Promise<TaxonomyTheme | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (input.label_vi != null) {
      params.push(input.label_vi);
      sets.push(`label_vi = $${params.length}`);
    }
    if (input.synonyms != null) {
      params.push(input.synonyms);
      sets.push(`synonyms = $${params.length}::text[]`);
    }
    if (input.active != null) {
      params.push(input.active);
      sets.push(`active = $${params.length}`);
    }
    if (sets.length === 0) return this.getTaxonomy(id);
    params.push(id);
    const result = await this.db.query(
      `UPDATE crm_research_taxonomy SET ${sets.join(', ')} WHERE id = $${params.length}
       RETURNING id, theme_code, label_vi, synonyms, active`,
      params,
    );
    return result.rows[0] ? mapTaxonomy(result.rows[0]) : null;
  }

  async attachInsightTheme(insightId: number, taxonomyId: number, actor: string): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_research_insight_themes (insight_id, taxonomy_id, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (insight_id, taxonomy_id) DO NOTHING`,
      [insightId, taxonomyId, actor],
    );
  }

  async detachInsightTheme(insightId: number, taxonomyId: number): Promise<void> {
    await this.db.query(
      `DELETE FROM crm_research_insight_themes WHERE insight_id = $1 AND taxonomy_id = $2`,
      [insightId, taxonomyId],
    );
  }

  async getOpsAnalytics(
    filters: { client_id?: string },
    allowedClientIds?: string[],
  ): Promise<OpsAnalyticsRaw> {
    const scope: string[] = [];
    const params: unknown[] = [];
    if (filters.client_id?.trim()) {
      params.push(filters.client_id.trim());
      scope.push(`p.client_id = $${params.length}`);
    }
    if (allowedClientIds) {
      params.push(allowedClientIds);
      scope.push(`p.client_id = ANY($${params.length}::text[])`);
    }
    const extra = scope.length ? `AND ${scope.join(' AND ')}` : '';
    const where = scope.length ? `WHERE ${scope.join(' AND ')}` : '';

    const cycle = await this.db.query(
      `SELECT EXTRACT(EPOCH FROM (p.updated_at - p.created_at))/3600 AS hours
       FROM crm_research_projects p
       WHERE p.status IN ('approved','distributed') ${extra}`,
      params,
    );
    const totals = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM crm_research_projects p ${where}`,
      params,
    );
    const verified = await this.db.query(
      `SELECT COUNT(DISTINCT e.project_id)::int AS n
       FROM crm_research_evidence e
       JOIN crm_research_projects p ON p.id = e.project_id
       WHERE e.qc_status = 'verified' ${extra}`,
      params,
    );
    const distributed = await this.db.query(
      `SELECT COUNT(*)::int AS n
       FROM crm_research_projects p
       WHERE p.status = 'distributed' ${extra}`,
      params,
    );
    const versions = await this.db.query(
      `SELECT COUNT(*)::int AS n
       FROM crm_research_report_versions v
       JOIN crm_research_reports r ON r.id = v.report_id
       JOIN crm_research_projects p ON p.id = r.project_id
       ${where}`,
      params,
    );
    const projects = await this.db.query(
      `SELECT p.id, p.client_id, p.status,
              (SELECT COUNT(*)::int FROM crm_research_evidence e
                WHERE e.project_id = p.id AND e.qc_status = 'verified') AS verified_ev
       FROM crm_research_projects p
       ${where}
       ORDER BY p.updated_at DESC
       LIMIT 200`,
      params,
    );

    return {
      cycleHours: cycle.rows.map((row) => Number(row.hours)),
      totalProjects: Number(totals.rows[0]?.n ?? 0),
      withVerified: Number(verified.rows[0]?.n ?? 0),
      distributedProjects: Number(distributed.rows[0]?.n ?? 0),
      approvedReports: Number(versions.rows[0]?.n ?? 0),
      projects: projects.rows.map((row) => ({
        id: Number(row.id),
        client_id: String(row.client_id),
        status: row.status as ProjectStatus,
        verified_ev: Number(row.verified_ev ?? 0),
      })),
    };
  }

  async getThemeQuarterAnalytics(
    filters: { client_id?: string; year: number },
    allowedClientIds?: string[],
  ): Promise<ThemeQuarterCountRow[]> {
    const scope: string[] = [
      `i.status IN ('approved_client_facing', 'published')`,
      `EXTRACT(YEAR FROM i.updated_at) = $1`,
    ];
    const params: unknown[] = [filters.year];
    if (filters.client_id?.trim()) {
      params.push(filters.client_id.trim());
      scope.push(`p.client_id = $${params.length}`);
    }
    if (allowedClientIds) {
      params.push(allowedClientIds);
      scope.push(`p.client_id = ANY($${params.length}::text[])`);
    }
    const where = `WHERE ${scope.join(' AND ')}`;
    const result = await this.db.query(
      `SELECT EXTRACT(QUARTER FROM date_trunc('quarter', i.updated_at))::int AS quarter,
              t.theme_code,
              t.label_vi,
              COUNT(DISTINCT i.id)::int AS insight_count
       FROM crm_research_insights i
       JOIN crm_research_projects p ON p.id = i.project_id
       JOIN crm_research_insight_themes it ON it.insight_id = i.id
       JOIN crm_research_taxonomy t ON t.id = it.taxonomy_id
       ${where}
       GROUP BY quarter, t.theme_code, t.label_vi
       ORDER BY quarter ASC, insight_count DESC, t.theme_code ASC`,
      params,
    );
    return result.rows.map((row) => ({
      quarter: Number(row.quarter),
      theme_code: String(row.theme_code),
      label_vi: String(row.label_vi),
      insight_count: Number(row.insight_count ?? 0),
    }));
  }

  async probePgvectorReady(): Promise<boolean> {
    try {
      const result = await this.db.query(PGVECTOR_READY_SQL);
      return parsePgvectorReadyRow(result.rows[0] as { ext_ok?: boolean; col_ok?: boolean });
    } catch {
      return false;
    }
  }

  async probeIvfflatReady(): Promise<boolean> {
    try {
      const result = await this.db.query(IVFFLAT_READY_SQL);
      return parseIvfflatReadyRow(result.rows[0] as { idx_ok?: boolean });
    } catch {
      return false;
    }
  }

  async getIsoGapFacts(projectId: number): Promise<IsoGapFactsRow | null> {
    const result = await this.db.query(
      `SELECT p.decision_statement,
              p.product_type,
              p.dv12_tier,
              p.geo,
              (SELECT COUNT(*)::int FROM crm_research_questions q WHERE q.project_id = p.id) AS rq_count,
              (SELECT COUNT(*)::int FROM crm_research_sources s WHERE s.project_id = p.id) AS source_count,
              (SELECT COUNT(*)::int FROM crm_research_evidence e
                WHERE e.project_id = p.id AND e.qc_status = 'verified') AS verified_evidence_count,
              (SELECT COUNT(*)::int FROM crm_research_studies st WHERE st.project_id = p.id) AS study_count,
              (SELECT COUNT(*)::int FROM crm_research_ai_runs ar WHERE ar.project_id = p.id) AS ai_run_count,
              (SELECT COUNT(*)::int FROM crm_research_reviews rv WHERE rv.project_id = p.id) AS review_count,
              (SELECT COUNT(*)::int FROM crm_research_insights i
                WHERE i.project_id = p.id AND i.status = 'draft') AS draft_count,
              (SELECT COUNT(*)::int FROM crm_research_insights i
                WHERE i.project_id = p.id AND i.status = 'published') AS published_count,
              (SELECT COUNT(*)::int FROM crm_research_insights i
                WHERE i.project_id = p.id AND i.status = 'approved_client_facing') AS acf_count,
              (SELECT COUNT(DISTINCT i.id)::int
                 FROM crm_research_insights i
                 JOIN crm_research_insight_evidence ie ON ie.insight_id = i.id
                 JOIN crm_research_evidence e ON e.id = ie.evidence_id
                WHERE i.project_id = p.id
                  AND i.status = 'approved_client_facing'
                  AND e.qc_status = 'verified') AS acf_with_verified_evidence,
              (
                SELECT v.content_snapshot
                  FROM crm_research_report_versions v
                  JOIN crm_research_reports r ON r.id = v.report_id
                 WHERE r.project_id = p.id
                 ORDER BY v.id DESC
                 LIMIT 1
              ) AS latest_report_snapshot,
              (SELECT COUNT(*)::int
                 FROM crm_research_report_versions v
                 JOIN crm_research_reports r ON r.id = v.report_id
                WHERE r.project_id = p.id) AS report_version_count
         FROM crm_research_projects p
        WHERE p.id = $1`,
      [projectId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;

    const snapshot = parseJsonCol<Record<string, unknown>>(row.latest_report_snapshot, {});
    const methodologyRaw = snapshot.methodology;
    const methodology =
      methodologyRaw && typeof methodologyRaw === 'object'
        ? (methodologyRaw as Record<string, unknown>)
        : null;
    const findings = Array.isArray(snapshot.findings) ? snapshot.findings : [];

    return {
      decision_statement: String(row.decision_statement ?? ''),
      product_type: String(row.product_type ?? ''),
      dv12_tier: String(row.dv12_tier ?? 'CB'),
      geo: row.geo,
      rq_count: Number(row.rq_count ?? 0),
      source_count: Number(row.source_count ?? 0),
      verified_evidence_count: Number(row.verified_evidence_count ?? 0),
      study_count: Number(row.study_count ?? 0),
      ai_run_count: Number(row.ai_run_count ?? 0),
      review_count: Number(row.review_count ?? 0),
      draft_count: Number(row.draft_count ?? 0),
      published_count: Number(row.published_count ?? 0),
      acf_count: Number(row.acf_count ?? 0),
      acf_with_verified_evidence: Number(row.acf_with_verified_evidence ?? 0),
      report_version_count: Number(row.report_version_count ?? 0),
      latest_report_methodology: methodology,
      latest_report_findings_count: findings.length,
    };
  }
}

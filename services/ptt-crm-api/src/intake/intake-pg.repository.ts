import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import { LeadIngestRulesRepository } from '../leads/ingest/lead-ingest-rules.repository';
import {
  BANT_KEYS,
  COMMON_FORM_SLUG,
  isCommonSlug,
  normalizeIntakeSlug,
  resolveDefinitionSlug,
} from './intake-definitions.util';
import { extractDiscoveryResponseSnippets } from './intake-answers.util';
import { syncPresalesLeadTasksFromIntake } from './intake-presales-sync.util';
import {
  CreateIntakeSessionBody,
  IntakeEntryResult,
  IntakeSessionRow,
  IntakeStatsResult,
  PatchIntakeSessionBody,
  STAKEHOLDER_ROLES,
  VALID_DECISIONS,
  VALID_MODES,
  VALID_STATUS,
  VALID_TEMPERATURES,
} from './intake.types';

const SESSION_SELECT = `
  SELECT s.id,
         s.sqlite_intake_id,
         s.lead_id,
         COALESCE(lc.sqlite_lifecycle_id, s.lifecycle_id) AS lifecycle_id,
         s.service_slug,
         s.mode,
         s.status,
         s.am_id,
         s.contact_name,
         s.contact_role,
         s.company_name,
         s.source,
         s.bant_json,
         s.bant_total,
         s.lead_temperature,
         s.decision,
         s.decision_reason,
         s.answers_json,
         s.stakeholders_json,
         s.commitments_json,
         s.next_meeting_at,
         s.next_meeting_note,
         s.proposal_date,
         s.ai_summary,
         s.ai_suggested_questions,
         s.started_at,
         s.completed_at,
         s.created_at,
         s.updated_at
  FROM crm_lead_intake_sessions s
  LEFT JOIN crm_service_lifecycle lc ON lc.id = s.lifecycle_id`;

type PgIntakeRow = {
  id: string | number;
  sqlite_intake_id: string | number | null;
  lead_id: string | number | null;
  lifecycle_id: string | number | null;
  service_slug: string;
  mode: string;
  status: string;
  am_id: string | number | null;
  contact_name: string;
  contact_role: string;
  company_name: string;
  source: string;
  bant_json: unknown;
  bant_total: string | number;
  lead_temperature: string;
  decision: string;
  decision_reason: string;
  answers_json: unknown;
  stakeholders_json: unknown;
  commitments_json: unknown;
  next_meeting_at: string;
  next_meeting_note: string;
  proposal_date: string;
  ai_summary: string;
  ai_suggested_questions: unknown;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

function iso(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      const val = JSON.parse(raw || '');
      return (val ?? fallback) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

@Injectable()
export class IntakePgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private lifecycleTableExists: boolean | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly ingestRules: LeadIngestRulesRepository,
  ) {}

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

  async listSessions(opts: {
    lifecycleId?: number;
    leadId?: number;
    limit?: number;
  }): Promise<IntakeSessionRow[]> {
    const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
    if (opts.lifecycleId) {
      const pgLcId = await this.resolvePgLifecycleId(opts.lifecycleId);
      if (!pgLcId) return [];
      const result = await this.db.query(
        `${SESSION_SELECT}
         WHERE s.lifecycle_id = $1
         ORDER BY s.updated_at DESC, s.id DESC
         LIMIT $2`,
        [pgLcId, limit],
      );
      return result.rows.map((r) => this.mapSession(r as PgIntakeRow));
    }
    if (opts.leadId) {
      const result = await this.db.query(
        `${SESSION_SELECT}
         WHERE s.lead_id = $1
         ORDER BY s.updated_at DESC, s.id DESC
         LIMIT $2`,
        [opts.leadId, limit],
      );
      return result.rows.map((r) => this.mapSession(r as PgIntakeRow));
    }
    return [];
  }

  async getSession(sessionId: number): Promise<IntakeSessionRow | null> {
    const result = await this.db.query(
      `${SESSION_SELECT} WHERE s.id = $1 OR s.sqlite_intake_id = $1`,
      [sessionId],
    );
    const row = result.rows[0] as PgIntakeRow | undefined;
    return row ? this.mapSession(row) : null;
  }

  async createSession(body: CreateIntakeSessionBody): Promise<IntakeSessionRow> {
    const lifecycleIdRaw = body.lifecycle_id ?? null;
    let leadId = body.lead_id ?? null;
    if (!lifecycleIdRaw && !leadId) {
      throw new Error('lifecycle_id hoặc lead_id bắt buộc');
    }

    let pgLifecycleId: number | null = null;
    if (lifecycleIdRaw) {
      pgLifecycleId = await this.resolvePgLifecycleId(lifecycleIdRaw);
    }

    let serviceSlug = normalizeIntakeSlug(body.service_slug ?? '') || COMMON_FORM_SLUG;
    if (!body.service_slug && pgLifecycleId) {
      const lcResult = await this.db.query(
        `SELECT service_slug FROM crm_service_lifecycle WHERE id = $1`,
        [pgLifecycleId],
      );
      const lcRow = lcResult.rows[0] as { service_slug: string } | undefined;
      if (lcRow) {
        serviceSlug = normalizeIntakeSlug(String(lcRow.service_slug ?? '')) || COMMON_FORM_SLUG;
      }
    }

    let mode = String(body.mode ?? 'phone').trim();
    if (!VALID_MODES.has(mode)) mode = 'phone';

    if (!leadId && pgLifecycleId) {
      leadId = await this.resolveLeadId(pgLifecycleId, null);
    }

    const stakeholders = JSON.stringify(this.defaultStakeholders());
    const commitments = JSON.stringify(this.defaultCommitments());
    const ts = catalogTs();

    const insert = await this.db.query(
      `INSERT INTO crm_lead_intake_sessions (
         lead_id, lifecycle_id, service_slug, mode, status, am_id,
         contact_name, contact_role, company_name, source,
         bant_json, bant_total, stakeholders_json, commitments_json,
         answers_json, started_at, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, 'draft', $5,
         $6, $7, $8, $9,
         '{}'::jsonb, 0, $10::jsonb, $11::jsonb,
         '{}'::jsonb, $12::timestamptz, $12::timestamptz, $12::timestamptz
       )
       RETURNING id`,
      [
        leadId,
        pgLifecycleId,
        String(serviceSlug).trim(),
        mode,
        body.am_id ?? null,
        String(body.contact_name ?? '').slice(0, 500),
        String(body.contact_role ?? '').slice(0, 200),
        String(body.company_name ?? '').slice(0, 500),
        String(body.source ?? '').slice(0, 200),
        stakeholders,
        commitments,
        ts,
      ],
    );

    const sessionId = Number(insert.rows[0]?.id);
    await this.prefillSession(sessionId, {
      lifecycleId: lifecycleIdRaw,
      pgLifecycleId,
      leadId,
      mode,
    });
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Failed to create intake session');
    return session;
  }

  private async resolvePgSessionId(sessionId: number): Promise<number | null> {
    const result = await this.db.query(
      `SELECT id FROM crm_lead_intake_sessions
       WHERE id = $1 OR sqlite_intake_id = $1
       LIMIT 1`,
      [sessionId],
    );
    const row = result.rows[0] as { id: string | number } | undefined;
    return row ? Number(row.id) : null;
  }

  async updateSession(
    sessionId: number,
    payload: PatchIntakeSessionBody,
  ): Promise<IntakeSessionRow | null> {
    const pgSessionId = await this.resolvePgSessionId(sessionId);
    if (!pgSessionId) return null;

    const prev = await this.getSession(sessionId);
    if (!prev) return null;

    const merged: IntakeSessionRow = { ...prev };

    const scalarFields = [
      'mode',
      'contact_name',
      'contact_role',
      'company_name',
      'source',
      'lead_temperature',
      'decision',
      'decision_reason',
      'next_meeting_at',
      'next_meeting_note',
      'proposal_date',
      'status',
    ] as const;

    for (const field of scalarFields) {
      if (!(field in payload)) continue;
      const val = payload[field];
      if (field === 'mode' && !VALID_MODES.has(String(val))) continue;
      if (field === 'decision' && !VALID_DECISIONS.has(String(val))) continue;
      if (field === 'lead_temperature' && !VALID_TEMPERATURES.has(String(val))) continue;
      if (field === 'status' && !VALID_STATUS.has(String(val))) continue;
      const nextVal = typeof val === 'string' ? String(val).slice(0, 4000) : val;
      switch (field) {
        case 'mode':
          merged.mode = String(nextVal);
          break;
        case 'contact_name':
          merged.contact_name = String(nextVal);
          break;
        case 'contact_role':
          merged.contact_role = String(nextVal);
          break;
        case 'company_name':
          merged.company_name = String(nextVal);
          break;
        case 'source':
          merged.source = String(nextVal);
          break;
        case 'lead_temperature':
          merged.lead_temperature = String(nextVal);
          break;
        case 'decision':
          merged.decision = String(nextVal);
          break;
        case 'decision_reason':
          merged.decision_reason = String(nextVal);
          break;
        case 'next_meeting_at':
          merged.next_meeting_at = String(nextVal);
          break;
        case 'next_meeting_note':
          merged.next_meeting_note = String(nextVal);
          break;
        case 'proposal_date':
          merged.proposal_date = String(nextVal);
          break;
        case 'status':
          merged.status = String(nextVal);
          break;
      }
    }

    if (payload.bant_json && typeof payload.bant_json === 'object') {
      merged.bant_json = payload.bant_json;
    }
    if (payload.answers_json && typeof payload.answers_json === 'object') {
      merged.answers_json = payload.answers_json;
    }
    if (payload.stakeholders_json && Array.isArray(payload.stakeholders_json)) {
      merged.stakeholders_json = payload.stakeholders_json;
    }
    if (payload.commitments_json && Array.isArray(payload.commitments_json)) {
      merged.commitments_json = payload.commitments_json;
    }

    merged.bant_total = this.computeBantTotal(merged.bant_json);

    await this.db.query(
      `UPDATE crm_lead_intake_sessions SET
         mode = $2, contact_name = $3, contact_role = $4, company_name = $5, source = $6,
         bant_json = $7::jsonb, bant_total = $8, lead_temperature = $9, decision = $10,
         decision_reason = $11,
         answers_json = $12::jsonb, stakeholders_json = $13::jsonb, commitments_json = $14::jsonb,
         next_meeting_at = $15, next_meeting_note = $16, proposal_date = $17,
         status = $18, updated_at = NOW()
       WHERE id = $1`,
      [
        pgSessionId,
        merged.mode || 'phone',
        String(merged.contact_name ?? '').slice(0, 500),
        String(merged.contact_role ?? '').slice(0, 200),
        String(merged.company_name ?? '').slice(0, 500),
        String(merged.source ?? '').slice(0, 200),
        JSON.stringify(merged.bant_json ?? {}),
        Number(merged.bant_total ?? 0),
        String(merged.lead_temperature ?? '').slice(0, 20),
        String(merged.decision ?? '').slice(0, 20),
        String(merged.decision_reason ?? '').slice(0, 4000),
        JSON.stringify(merged.answers_json ?? {}),
        JSON.stringify(merged.stakeholders_json ?? []),
        JSON.stringify(merged.commitments_json ?? []),
        String(merged.next_meeting_at ?? '').slice(0, 50),
        String(merged.next_meeting_note ?? '').slice(0, 4000),
        String(merged.proposal_date ?? '').slice(0, 50),
        String(merged.status ?? 'draft').slice(0, 20),
      ],
    );

    return this.getSession(sessionId);
  }

  async completeSession(
    sessionId: number,
    actorId: number | null,
  ): Promise<IntakeSessionRow | null> {
    const pgSessionId = await this.resolvePgSessionId(sessionId);
    if (!pgSessionId) return null;

    const session = await this.getSession(sessionId);
    if (!session) return null;
    if (!String(session.decision ?? '').trim()) {
      throw new Error('Cần chọn quyết định Go / Nurture / No-Go trước khi hoàn thành');
    }

    await this.db.query(
      `UPDATE crm_lead_intake_sessions
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [pgSessionId],
    );

    const completed = await this.getSession(sessionId);
    if (!completed) return null;

    await this.syncCommonIntakeToLead(completed);
    await this.logIntakeActivity(completed, actorId);
    await syncPresalesLeadTasksFromIntake(this.db, completed, actorId);
    return this.getSession(sessionId);
  }

  async hasLifecycleTable(): Promise<boolean> {
    if (this.lifecycleTableExists != null) return this.lifecycleTableExists;
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'crm_service_lifecycle'
         LIMIT 1`,
      );
      this.lifecycleTableExists = Boolean(result.rows[0]);
    } catch {
      this.lifecycleTableExists = false;
    }
    return this.lifecycleTableExists;
  }

  async getIntakeStats(amId?: number, byAm = false): Promise<IntakeStatsResult> {
    const lifecycleExists = await this.hasLifecycleTable();
    let totalLifecycles = 0;
    let withCompletedIntake = 0;

    if (lifecycleExists) {
      const lcParams: number[] = [];
      let lcFilter = "status IN ('active', 'draft')";
      if (amId != null && Number.isFinite(amId)) {
        lcFilter += ` AND assigned_am = $${lcParams.length + 1}`;
        lcParams.push(amId);
      }
      const totalRow = await this.db.query(
        `SELECT COUNT(*)::int AS n FROM crm_service_lifecycle WHERE ${lcFilter}`,
        lcParams,
      );
      totalLifecycles = Number(totalRow.rows[0]?.n ?? 0);

      const intakeLcFilter = lcFilter.replace(/\bstatus IN/g, 'lc.status IN');
      const withRow = await this.db.query(
        `SELECT COUNT(DISTINCT s.lifecycle_id)::int AS n
         FROM crm_lead_intake_sessions s
         INNER JOIN crm_service_lifecycle lc ON lc.id = s.lifecycle_id
         WHERE s.status = 'completed' AND s.lifecycle_id IS NOT NULL
           AND ${intakeLcFilter}`,
        lcParams,
      );
      withCompletedIntake = Number(withRow.rows[0]?.n ?? 0);
    }

    const sessionParams: number[] = [];
    let sessionFilter = "status = 'completed' AND lifecycle_id IS NOT NULL";
    if (amId != null && Number.isFinite(amId) && lifecycleExists) {
      sessionFilter += ` AND lifecycle_id IN (
        SELECT id FROM crm_service_lifecycle
        WHERE assigned_am = $${sessionParams.length + 1} AND status IN ('active', 'draft')
      )`;
      sessionParams.push(amId);
    }
    const completedRow = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM crm_lead_intake_sessions WHERE ${sessionFilter}`,
      sessionParams,
    );
    const completedSessions = Number(completedRow.rows[0]?.n ?? 0);

    const avgRow = await this.db.query(
      `SELECT ROUND(AVG(bant_total)::numeric, 1) AS avg_bant
       FROM crm_lead_intake_sessions
       WHERE status = 'completed'`,
    );
    const avgBantTotal = Number(avgRow.rows[0]?.avg_bant ?? 0);

    const coveragePct =
      totalLifecycles > 0 ? Math.round((withCompletedIntake / totalLifecycles) * 1000) / 10 : 0;

    const result: IntakeStatsResult = {
      total_lifecycles: totalLifecycles,
      lifecycles_with_completed_intake: withCompletedIntake,
      completed_intake_sessions: completedSessions,
      intake_coverage_pct: coveragePct,
      avg_bant_total: avgBantTotal,
      lifecycle_table_exists: lifecycleExists,
    };
    if (amId != null && Number.isFinite(amId)) {
      result.am_id = amId;
    }

    if (byAm && lifecycleExists) {
      const rows = await this.db.query(
        `SELECT lc.assigned_am AS staff_id,
                COUNT(DISTINCT lc.id)::int AS lifecycle_count,
                COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN lc.id END)::int AS intake_completed,
                ROUND(AVG(CASE WHEN s.status = 'completed' THEN s.bant_total END)::numeric, 1) AS avg_bant
         FROM crm_service_lifecycle lc
         LEFT JOIN crm_lead_intake_sessions s
           ON s.lifecycle_id = lc.id AND s.status = 'completed'
         WHERE lc.status IN ('active', 'draft')
           AND lc.assigned_am IS NOT NULL
         GROUP BY lc.assigned_am
         ORDER BY intake_completed DESC, lc.assigned_am`,
      );
      result.by_am = await Promise.all(
        rows.rows.map(async (r) => {
          const staffId = Number((r as { staff_id: string | number }).staff_id);
          const name = staffId ? await this.ingestRules.staffName(staffId) : '';
          return {
            staff_id: staffId,
            name,
            lifecycle_count: Number((r as { lifecycle_count: number }).lifecycle_count ?? 0),
            intake_completed: Number((r as { intake_completed: number }).intake_completed ?? 0),
            avg_bant: Number((r as { avg_bant: number | null }).avg_bant ?? 0),
          };
        }),
      );
    }

    return result;
  }

  async resolveIntakeEntry(
    leadId: number,
    modeRaw?: string,
    formRaw?: string,
  ): Promise<IntakeEntryResult> {
    let mode = String(modeRaw ?? 'phone').trim();
    if (!VALID_MODES.has(mode)) mode = 'phone';
    const formKey = String(formRaw ?? '').trim().toLowerCase();
    const forceCommon = ['common', '_common', '1', 'true', 'yes', 'chung'].includes(formKey);

    if (!(await this.hasLifecycleTable()) || forceCommon) {
      return {
        ok: true,
        lead_id: leadId,
        lifecycle_id: null,
        service_slug: COMMON_FORM_SLUG,
        is_common_form: true,
        redirect_url: `/crm/intake?lead_id=${leadId}&mode=${mode}&service_slug=${COMMON_FORM_SLUG}&auto_create=1`,
      };
    }

    const lcResult = await this.db.query(
      `SELECT id, sqlite_lifecycle_id, service_slug
       FROM crm_service_lifecycle
       WHERE lead_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [leadId],
    );
    const lcRow = lcResult.rows[0] as
      | { id: string | number; sqlite_lifecycle_id: string | number | null; service_slug: string }
      | undefined;

    if (!lcRow) {
      return {
        ok: true,
        lead_id: leadId,
        lifecycle_id: null,
        service_slug: COMMON_FORM_SLUG,
        is_common_form: true,
        redirect_url: `/crm/intake?lead_id=${leadId}&mode=${mode}&service_slug=${COMMON_FORM_SLUG}&auto_create=1`,
      };
    }

    const extLifecycleId = Number(lcRow.sqlite_lifecycle_id ?? lcRow.id);
    const slug = String(lcRow.service_slug ?? '').trim();
    const defSlug = resolveDefinitionSlug(slug);
    const isCommon = defSlug === COMMON_FORM_SLUG;
    let params = `lifecycle_id=${extLifecycleId}&mode=${mode}&auto_create=1`;
    if (isCommon) {
      params += `&service_slug=${COMMON_FORM_SLUG}`;
    }
    return {
      ok: true,
      lifecycle_id: extLifecycleId,
      lead_id: leadId,
      service_slug: isCommon ? COMMON_FORM_SLUG : slug,
      is_common_form: isCommon,
      redirect_url: `/crm/intake?${params}`,
    };
  }

  async reopenSession(sessionId: number): Promise<IntakeSessionRow | null> {
    const pgSessionId = await this.resolvePgSessionId(sessionId);
    if (!pgSessionId) return null;

    await this.db.query(
      `UPDATE crm_lead_intake_sessions
       SET status = 'draft', completed_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [pgSessionId],
    );
    return this.getSession(sessionId);
  }

  async deleteSession(sessionId: number): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;
    if (String(session.status) !== 'draft') {
      throw new Error('Chỉ xóa được phiên nháp');
    }
    const pgSessionId = await this.resolvePgSessionId(sessionId);
    if (!pgSessionId) return false;
    await this.db.query('DELETE FROM crm_lead_intake_sessions WHERE id = $1', [pgSessionId]);
    return true;
  }

  async saveAiSummaryStub(sessionId: number): Promise<IntakeSessionRow | null> {
    const pgSessionId = await this.resolvePgSessionId(sessionId);
    if (!pgSessionId) return null;

    const session = await this.getSession(sessionId);
    if (!session) return null;
    const parts = [
      `Intake #${session.id}`,
      session.contact_name ? `Liên hệ: ${session.contact_name}` : '',
      session.company_name ? `Công ty: ${session.company_name}` : '',
      `BANT ${session.bant_total ?? 0}/30`,
      session.decision ? `Quyết định: ${session.decision}` : '',
      session.decision_reason ? `Lý do: ${session.decision_reason.slice(0, 500)}` : '',
    ].filter(Boolean);
    const summary = parts.join(' · ').slice(0, 4000);
    await this.db.query(
      `UPDATE crm_lead_intake_sessions
       SET ai_summary = $2, updated_at = NOW()
       WHERE id = $1`,
      [pgSessionId, summary],
    );
    return this.getSession(sessionId);
  }

  computeBantTotal(bantJson: Record<string, unknown>): number {
    let total = 0;
    for (const key of BANT_KEYS) {
      let score = 0;
      try {
        score = Number(bantJson[key] ?? 0);
      } catch {
        score = 0;
      }
      if (score >= 1 && score <= 5) total += score;
    }
    return total;
  }

  private async resolvePgLifecycleId(lifecycleId: number): Promise<number | null> {
    const result = await this.db.query(
      `SELECT id FROM crm_service_lifecycle
       WHERE sqlite_lifecycle_id = $1 OR id = $1
       LIMIT 1`,
      [lifecycleId],
    );
    const row = result.rows[0] as { id: string | number } | undefined;
    return row ? Number(row.id) : null;
  }

  private async resolveLeadId(
    pgLifecycleId: number | null,
    leadId: number | null,
  ): Promise<number | null> {
    if (leadId) return leadId;
    if (!pgLifecycleId) return null;
    const result = await this.db.query(
      `SELECT lead_id FROM crm_service_lifecycle WHERE id = $1`,
      [pgLifecycleId],
    );
    const row = result.rows[0] as { lead_id: string | number | null } | undefined;
    return row?.lead_id != null ? Number(row.lead_id) : null;
  }

  private defaultStakeholders(): Array<Record<string, string>> {
    return STAKEHOLDER_ROLES.map(([role, label]) => ({
      role,
      role_label: label,
      name: '',
      title: '',
      influence: '',
      notes: '',
    }));
  }

  private defaultCommitments(): Array<Record<string, string>> {
    return [
      { label: 'Cam kết 1 — Thông tin', detail: '', deadline: '' },
      { label: 'Cam kết 2 — Thời gian', detail: '', deadline: '' },
      { label: 'Cam kết 3 — Ngân sách / quyết định', detail: '', deadline: '' },
    ];
  }

  private async prefillSession(
    sessionId: number,
    opts: {
      lifecycleId?: number | null;
      pgLifecycleId?: number | null;
      leadId?: number | null;
      mode: string;
    },
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const payload: PatchIntakeSessionBody = {};
    const lid = await this.resolveLeadId(
      opts.pgLifecycleId ?? null,
      opts.leadId ?? session.lead_id,
    );
    if (lid) {
      Object.assign(payload, await this.fetchLeadPrefill(lid));
    }

    if (opts.mode === 'in_person' && (opts.pgLifecycleId ?? session.lifecycle_id)) {
      const pgLcId =
        opts.pgLifecycleId ??
        (session.lifecycle_id ? await this.resolvePgLifecycleId(session.lifecycle_id) : null);
      if (pgLcId) {
        const phoneSession = await this.getLatestCompletedSession(pgLcId, 'phone');
        if (phoneSession) {
          const recapText = this.buildRecapFromSession(phoneSession);
          const recapMeta = {
            phone_session_id: phoneSession.id,
            phone_completed_at: phoneSession.completed_at || '',
            recap: recapText,
          };
          if (phoneSession.contact_name) payload.contact_name = phoneSession.contact_name;
          if (phoneSession.company_name) payload.company_name = phoneSession.company_name;
          if (phoneSession.bant_json && !session.bant_total) {
            payload.bant_json = phoneSession.bant_json;
          }

          const existingAnswers =
            payload.answers_json && typeof payload.answers_json === 'object'
              ? payload.answers_json
              : session.answers_json || {};
          const mergedMeta = {
            ...((existingAnswers.meta as Record<string, unknown>) || {}),
            ...recapMeta,
          };
          payload.answers_json = {
            ...existingAnswers,
            meta: mergedMeta,
            recap: recapText,
          };
        }
      }
    }

    if (Object.keys(payload).length > 0) {
      await this.updateSession(sessionId, payload);
    }
  }

  private async fetchLeadPrefill(leadId: number): Promise<PatchIntakeSessionBody> {
    const result = await this.db.query(
      `SELECT full_name, need, source, meta_json
       FROM crm_leads
       WHERE sqlite_lead_id = $1`,
      [leadId],
    );
    const row = result.rows[0] as
      | {
          full_name: string;
          need: string;
          source: string;
          meta_json: unknown;
        }
      | undefined;
    if (!row) return {};

    const meta = parseJson<Record<string, unknown>>(row.meta_json, {});
    const aiBrief =
      meta.ai_qualify_brief && typeof meta.ai_qualify_brief === 'object'
        ? (meta.ai_qualify_brief as Record<string, unknown>)
        : {};

    let pain = String(row.need ?? '').trim();
    if (!pain && typeof aiBrief.summary === 'string') {
      pain = aiBrief.summary.trim();
    }

    const metaBlock: Record<string, unknown> = {
      pain_summary: pain.slice(0, 4000),
      ai_brief: String(aiBrief.summary ?? '').slice(0, 4000),
    };
    if (aiBrief.service_slug) {
      metaBlock.qualify_service_slug = String(aiBrief.service_slug).slice(0, 120);
    }

    const crmFields: Record<string, string> = {};
    if (row.need) crmFields.need = String(row.need).slice(0, 4000);

    return {
      contact_name: String(row.full_name ?? '').slice(0, 500),
      source: String(row.source ?? '').slice(0, 200),
      answers_json: {
        meta: metaBlock,
        crm_fields: crmFields,
      },
    };
  }

  private async getLatestCompletedSession(
    pgLifecycleId: number,
    mode: string,
  ): Promise<IntakeSessionRow | null> {
    const result = await this.db.query(
      `${SESSION_SELECT}
       WHERE s.lifecycle_id = $1 AND s.mode = $2 AND s.status = 'completed'
       ORDER BY s.completed_at DESC NULLS LAST, s.id DESC
       LIMIT 1`,
      [pgLifecycleId, mode],
    );
    const row = result.rows[0] as PgIntakeRow | undefined;
    return row ? this.mapSession(row) : null;
  }

  private buildRecapFromSession(phoneSession: IntakeSessionRow): string {
    const parts: string[] = [];
    if (phoneSession.contact_name) parts.push(`Liên hệ: ${phoneSession.contact_name}`);
    parts.push(`BANT ${phoneSession.bant_total ?? 0}/30`);
    if (phoneSession.decision) parts.push(`Quyết định: ${phoneSession.decision}`);

    const answers = phoneSession.answers_json || {};
    const meta =
      answers.meta && typeof answers.meta === 'object'
        ? (answers.meta as Record<string, unknown>)
        : {};
    if (meta.pain_summary) parts.push(`Pain: ${String(meta.pain_summary)}`);

    const snippets = extractDiscoveryResponseSnippets(answers, 4);
    if (snippets.length) parts.push(`Ghi chú gọi: ${snippets.join(' · ')}`);
    return parts.join('\n').slice(0, 4000);
  }

  private async syncCommonIntakeToLead(session: IntakeSessionRow): Promise<void> {
    if (!isCommonSlug(String(session.service_slug ?? ''))) return;
    if (session.lifecycle_id) return;

    const leadId = session.lead_id;
    if (!leadId) return;

    const answers = session.answers_json || {};
    const crm =
      answers.crm_fields && typeof answers.crm_fields === 'object'
        ? (answers.crm_fields as Record<string, unknown>)
        : {};
    const meta =
      answers.meta && typeof answers.meta === 'object'
        ? (answers.meta as Record<string, unknown>)
        : {};
    const need = String(crm.need ?? meta.pain_summary ?? '').trim();
    if (!need) return;

    const rowResult = await this.db.query(
      `SELECT need FROM crm_leads WHERE sqlite_lead_id = $1`,
      [leadId],
    );
    const row = rowResult.rows[0] as { need: string } | undefined;
    if (!row) return;
    const prevNeed = String(row.need ?? '').trim();
    if (prevNeed) return;

    await this.db.query(
      `UPDATE crm_leads SET need = $2, updated_at = NOW() WHERE sqlite_lead_id = $1`,
      [leadId, need.slice(0, 4000)],
    );
  }

  private async logIntakeActivity(
    session: IntakeSessionRow,
    actorId: number | null,
  ): Promise<void> {
    const pgLcId = session.lifecycle_id
      ? await this.resolvePgLifecycleId(session.lifecycle_id)
      : null;
    const leadId = await this.resolveLeadId(pgLcId, session.lead_id);
    if (!leadId) return;

    const mode = session.mode || 'phone';
    const modeVi = mode === 'phone' ? 'gọi điện' : 'gặp trực tiếp';
    const actType = mode === 'phone' ? 'call' : 'meeting';
    let content =
      `Lead Intake #${session.id} (${modeVi})` +
      (isCommonSlug(String(session.service_slug ?? '')) ? ' · Form chung' : '') +
      ` · BANT ${session.bant_total ?? 0}/30 · ${session.decision || '—'}`;
    if (session.decision_reason) {
      content += ` · ${String(session.decision_reason).slice(0, 200)}`;
    }

    let nextAction = '';
    let nextAt: string | null = null;
    if (mode === 'phone' && session.decision === 'go') {
      nextAction = 'Hẹn gặp KH (PHẦN B)';
      const raw = String(session.next_meeting_at ?? '').trim();
      nextAt = raw || null;
    }

    const statusResult = await this.db.query(
      `SELECT status FROM crm_leads WHERE sqlite_lead_id = $1`,
      [leadId],
    );
    const statusSnap = String(statusResult.rows[0]?.status ?? 'new');

    await this.db.query(
      `INSERT INTO crm_lead_activities (
         lead_id, user_id, activity_type, content, result,
         next_action, next_action_at, created_at, created_by, lead_status_at_log
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)`,
      [
        leadId,
        actorId,
        actType,
        content.slice(0, 8000),
        String(session.decision ?? '').slice(0, 500),
        nextAction.slice(0, 500),
        nextAt,
        actorId ? String(actorId).slice(0, 120) : '',
        statusSnap,
      ],
    );

    await this.db.query(
      `UPDATE crm_leads SET updated_at = NOW() WHERE sqlite_lead_id = $1`,
      [leadId],
    );
  }

  private mapSession(row: PgIntakeRow): IntakeSessionRow {
    const rawQ = row.ai_suggested_questions;
    let aiQuestions: string[] = [];
    if (Array.isArray(rawQ)) {
      aiQuestions = rawQ.map(String);
    } else if (typeof rawQ === 'string' && rawQ.trim().startsWith('[')) {
      aiQuestions = parseJson<string[]>(rawQ, []);
    } else if (typeof rawQ === 'string' && rawQ.trim()) {
      aiQuestions = [rawQ];
    }

    const externalId =
      row.sqlite_intake_id != null ? Number(row.sqlite_intake_id) : Number(row.id);

    return {
      id: externalId,
      lead_id: row.lead_id != null ? Number(row.lead_id) : null,
      lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
      service_slug: String(row.service_slug ?? ''),
      mode: String(row.mode ?? 'phone'),
      status: String(row.status ?? 'draft'),
      am_id: row.am_id != null ? Number(row.am_id) : null,
      contact_name: String(row.contact_name ?? ''),
      contact_role: String(row.contact_role ?? ''),
      company_name: String(row.company_name ?? ''),
      source: String(row.source ?? ''),
      bant_json: parseJson<Record<string, unknown>>(row.bant_json, {}),
      bant_total: Number(row.bant_total ?? 0),
      lead_temperature: String(row.lead_temperature ?? ''),
      decision: String(row.decision ?? ''),
      decision_reason: String(row.decision_reason ?? ''),
      answers_json: parseJson<Record<string, unknown>>(row.answers_json, {}),
      stakeholders_json: parseJson<Array<Record<string, string>>>(row.stakeholders_json, []),
      commitments_json: parseJson<Array<Record<string, string>>>(row.commitments_json, []),
      next_meeting_at: String(row.next_meeting_at ?? ''),
      next_meeting_note: String(row.next_meeting_note ?? ''),
      proposal_date: String(row.proposal_date ?? ''),
      ai_summary: String(row.ai_summary ?? ''),
      ai_suggested_questions: aiQuestions,
      started_at: iso(row.started_at),
      completed_at: iso(row.completed_at),
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
    };
  }
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import {
  assertPresalesCareGate,
  CARE_PIPELINE_STAGES,
  CARE_STAGE_KEYS,
  CARE_STAGE_MIN_COMPLETION_NOTE_LEN,
  CONTACT_OK_CARE_STATUS,
  carePipelineState,
  parseLeadMeta,
  presalesCareGateState,
  serializeStagesDone,
} from './care-pipeline.util';
import {
  careStatusLabel,
  normalizeCareContactType,
  normalizeCareReportStatus,
} from './care-status.util';
import { resolveLeadFlowKindFromFunnelRow } from './lead-flow-kind.util';
import {
  CompleteCareStageBody,
  LeadFunnelRow,
  LeadFunnelSnapshot,
  PatchMarketingPlanBody,
  PatchPresalesTaskBody,
  PresalesHandoffView,
  PresalesRow,
  PresalesSnapshot,
  PresalesTaskRow,
  ReleaseReviewQueueBody,
  SolutionQueueRow,
} from './leads-funnel.types';
import {
  buildPresalesL2DocsView,
  mergePresalesL2DocsPatch,
  parsePresalesL2DocsJson,
} from './presales-l2-docs.util';
import {
  buildPresalesConsultProposalSla,
  isConsultToProposalWithin48h,
  type PresalesConsultSlaSummary,
} from './presales-consult-sla.util';
import {
  loadPresalesFunnelMetricsSqlite,
} from './presales-funnel-metrics-load.sqlite.util';
import type { PresalesFunnelMetricsQuery } from './presales-funnel-metrics-load.pg.util';
import {
  defaultStrategyJson,
  planContentFromRow,
  validatePreliminaryPlan,
} from './presales-marketing-plan.util';
import { workflowStepsForService } from './presales-workflow-steps.util';
import {
  buildPresalesWorkflowUpgradePlan,
  mergeLegacyPresalesFormData,
  normalizeUpgradeStages,
} from './presales-workflow-upgrade.util';
import {
  capBatchLeadIds,
  PRESALES_BATCH_UPGRADE_MAX,
  PRESALES_UPGRADE_CONSULT_FIELD_MIN,
  type PresalesWorkflowUpgradeCohortRow,
} from './presales-workflow-batch.util';
import {
  pickLatestCompletedIntake,
  prefillPresalesConsultTaskForm,
} from './presales-consult-prefill.util';
import type { IntakeSessionRow } from '../intake/intake.types';
import {
  DEFAULT_B2_CONTACT_DEADLINE_HOURS,
  isLeadInReviewQueue,
  normalizeB2ContactDeadlineHours,
  REVIEW_QUEUE_REASON,
  reviewQueuePublicState,
} from './review-queue.util';
import { PRESALES_STAGES } from './leads-funnel.types';
import {
  consultAdvanceBlockReason,
  validatePresalesConsultAdvance,
} from './presales-consult-gate.util';
import {
  blocksDirectProposalAdvance,
  normalizeHandoffStatus,
} from './presales-solution-handoff.util';

@Injectable()
export class LeadsFunnelSqliteRepository implements OnModuleDestroy {
  private db: DatabaseSync | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get database(): DatabaseSync {
    if (!this.db) {
      this.db = new DatabaseSync(this.config.sqlitePath);
      this.db.exec('PRAGMA foreign_keys = ON');
      this.ensureSchema();
    }
    return this.db;
  }

  onModuleDestroy(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private ts(): string {
    return catalogTs();
  }

  private parsePresalesRowFromDb(raw: Record<string, unknown>): PresalesRow {
    let l2Raw: unknown = raw.l2_docs_json ?? '{}';
    if (typeof l2Raw === 'string') {
      try {
        l2Raw = JSON.parse(l2Raw || '{}');
      } catch {
        l2Raw = {};
      }
    }
    return {
      id: Number(raw.id),
      lead_id: Number(raw.lead_id),
      service_slug: String(raw.service_slug ?? ''),
      stage: String(raw.stage ?? 'lead') as PresalesRow['stage'],
      status: String(raw.status ?? 'active'),
      assigned_am: raw.assigned_am != null ? Number(raw.assigned_am) : null,
      lifecycle_id: raw.lifecycle_id != null ? Number(raw.lifecycle_id) : null,
      stage_entered_at: String(raw.stage_entered_at ?? ''),
      consult_entered_at: String(raw.consult_entered_at ?? ''),
      proposal_entered_at: String(raw.proposal_entered_at ?? ''),
      notes: String(raw.notes ?? ''),
      draft_marketing_plan_id:
        raw.draft_marketing_plan_id != null ? Number(raw.draft_marketing_plan_id) : null,
      l2_docs_json: parsePresalesL2DocsJson(l2Raw),
      handoff_status: normalizeHandoffStatus(raw.handoff_status),
      handed_off_at: String(raw.handed_off_at ?? ''),
      handed_off_by_staff_id:
        raw.handed_off_by_staff_id != null ? Number(raw.handed_off_by_staff_id) : null,
      solution_owner_staff_id:
        raw.solution_owner_staff_id != null ? Number(raw.solution_owner_staff_id) : null,
      solution_claimed_at: String(raw.solution_claimed_at ?? ''),
      solution_released_at: String(raw.solution_released_at ?? ''),
    };
  }

  private staffNameById(staffId: number | null): string {
    if (staffId == null || staffId <= 0) return '';
    const row = this.database
      .prepare('SELECT name FROM crm_staff WHERE id = ? LIMIT 1')
      .get(staffId) as { name: string } | undefined;
    return String(row?.name ?? '').trim();
  }

  buildHandoffView(ps: PresalesRow): PresalesHandoffView {
    return {
      status: ps.handoff_status,
      handed_off_at: ps.handed_off_at,
      handed_off_by_staff_id: ps.handed_off_by_staff_id,
      solution_owner_staff_id: ps.solution_owner_staff_id,
      solution_owner_name: this.staffNameById(ps.solution_owner_staff_id),
      solution_claimed_at: ps.solution_claimed_at,
      solution_released_at: ps.solution_released_at,
    };
  }

  ensureSchema(): void {
    const cols = this.database.prepare('PRAGMA table_info(crm_leads)').all() as Array<{ name: string }>;
    const colSet = new Set(cols.map((c) => c.name));
    if (!colSet.has('care_stage_current')) {
      this.database.exec(
        "ALTER TABLE crm_leads ADD COLUMN care_stage_current TEXT NOT NULL DEFAULT 'first_contact'",
      );
    }
    if (!colSet.has('care_stages_done_json')) {
      this.database.exec(
        "ALTER TABLE crm_leads ADD COLUMN care_stages_done_json TEXT NOT NULL DEFAULT '{}'",
      );
    }
    const psColSet = new Set(
      (
        this.database.prepare('PRAGMA table_info(crm_lead_presales)').all() as Array<{ name: string }>
      ).map((r) => r.name),
    );
    if (!psColSet.has('l2_docs_json')) {
      this.database.exec(
        "ALTER TABLE crm_lead_presales ADD COLUMN l2_docs_json TEXT NOT NULL DEFAULT '{}'",
      );
    }
    if (!psColSet.has('consult_entered_at')) {
      this.database.exec(
        "ALTER TABLE crm_lead_presales ADD COLUMN consult_entered_at TEXT NOT NULL DEFAULT ''",
      );
    }
    if (!psColSet.has('proposal_entered_at')) {
      this.database.exec(
        "ALTER TABLE crm_lead_presales ADD COLUMN proposal_entered_at TEXT NOT NULL DEFAULT ''",
      );
    }
    if (!psColSet.has('handoff_status')) {
      this.database.exec(
        "ALTER TABLE crm_lead_presales ADD COLUMN handoff_status TEXT NOT NULL DEFAULT ''",
      );
    }
    if (!psColSet.has('handed_off_at')) {
      this.database.exec("ALTER TABLE crm_lead_presales ADD COLUMN handed_off_at TEXT NOT NULL DEFAULT ''");
    }
    if (!psColSet.has('handed_off_by_staff_id')) {
      this.database.exec('ALTER TABLE crm_lead_presales ADD COLUMN handed_off_by_staff_id INTEGER');
    }
    if (!psColSet.has('solution_owner_staff_id')) {
      this.database.exec('ALTER TABLE crm_lead_presales ADD COLUMN solution_owner_staff_id INTEGER');
    }
    if (!psColSet.has('solution_claimed_at')) {
      this.database.exec(
        "ALTER TABLE crm_lead_presales ADD COLUMN solution_claimed_at TEXT NOT NULL DEFAULT ''",
      );
    }
    if (!psColSet.has('solution_released_at')) {
      this.database.exec(
        "ALTER TABLE crm_lead_presales ADD COLUMN solution_released_at TEXT NOT NULL DEFAULT ''",
      );
    }
    this.database.exec(`
      UPDATE crm_lead_presales
      SET handoff_status = 'with_solution',
          handed_off_at = CASE
            WHEN handed_off_at = '' OR handed_off_at IS NULL
            THEN COALESCE(NULLIF(consult_entered_at, ''), NULLIF(stage_entered_at, ''), datetime('now'))
            ELSE handed_off_at
          END
      WHERE stage = 'consult'
        AND status = 'active'
        AND (handoff_status = '' OR handoff_status IS NULL)
    `);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS crm_lead_presales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL UNIQUE REFERENCES crm_leads(id) ON DELETE CASCADE,
        service_slug TEXT NOT NULL DEFAULT '',
        stage TEXT NOT NULL DEFAULT 'lead',
        status TEXT NOT NULL DEFAULT 'active',
        assigned_am INTEGER REFERENCES crm_staff(id) ON DELETE SET NULL,
        lifecycle_id INTEGER,
        stage_entered_at TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT '',
        draft_marketing_plan_id INTEGER,
        l2_docs_json TEXT NOT NULL DEFAULT '{}',
        consult_entered_at TEXT NOT NULL DEFAULT '',
        proposal_entered_at TEXT NOT NULL DEFAULT '',
        handoff_status TEXT NOT NULL DEFAULT '',
        handed_off_at TEXT NOT NULL DEFAULT '',
        handed_off_by_staff_id INTEGER,
        solution_owner_staff_id INTEGER,
        solution_claimed_at TEXT NOT NULL DEFAULT '',
        solution_released_at TEXT NOT NULL DEFAULT ''
      )
    `);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS crm_lead_presales_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        presales_id INTEGER NOT NULL REFERENCES crm_lead_presales(id) ON DELETE CASCADE,
        stage TEXT NOT NULL DEFAULT '',
        step_index INTEGER NOT NULL DEFAULT 0,
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        form_fields TEXT NOT NULL DEFAULT '[]',
        form_data TEXT NOT NULL DEFAULT '{}',
        ai_output TEXT NOT NULL DEFAULT '',
        ai_prompt_key TEXT NOT NULL DEFAULT '',
        is_done INTEGER NOT NULL DEFAULT 0,
        done_at TEXT NOT NULL DEFAULT '',
        done_by INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        is_custom INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT ''
      )
    `);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS crm_lead_settings (
        config_key TEXT PRIMARY KEY,
        config_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT '',
        updated_by TEXT NOT NULL DEFAULT ''
      )
    `);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS crm_marketing_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        plan_kind TEXT NOT NULL DEFAULT 'preliminary',
        lead_id INTEGER,
        presales_id INTEGER,
        north_star TEXT NOT NULL DEFAULT '',
        objectives TEXT NOT NULL DEFAULT '',
        strategy_framework_json TEXT NOT NULL DEFAULT '{}',
        target_market_prof_json TEXT NOT NULL DEFAULT '{}',
        target_market_steps4_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT ''
      )
    `);
  }

  fetchLeadConfig(): { b2_review_queue_enabled: boolean; b2_contact_deadline_hours: number } {
    const row = this.database
      .prepare("SELECT config_json FROM crm_lead_settings WHERE config_key = 'global'")
      .get() as { config_json: string } | undefined;
    let cfg: Record<string, unknown> = {};
    if (row?.config_json) {
      try {
        cfg = JSON.parse(row.config_json) as Record<string, unknown>;
      } catch {
        cfg = {};
      }
    }
    return {
      b2_review_queue_enabled: cfg.b2_review_queue_enabled !== false,
      b2_contact_deadline_hours: normalizeB2ContactDeadlineHours(
        cfg.b2_contact_deadline_hours ?? DEFAULT_B2_CONTACT_DEADLINE_HOURS,
      ),
    };
  }

  fetchLeadRow(leadId: number): LeadFunnelRow | null {
    const row = this.database
      .prepare(
        `SELECT l.id, l.full_name, l.phone, l.email, l.status, l.source, l.owner_id,
                COALESCE(json_extract(l.meta_json, '$.agency_client_id'), '') AS client_id,
                COALESCE(
                  json_extract(l.meta_json, '$.channel'),
                  json_extract(l.meta_json, '$.ingest_channel'),
                  l.source,
                  ''
                ) AS channel,
                l.meta_json, l.care_stage_current, l.care_stages_done_json,
                COALESCE(l.is_duplicate, 0) AS is_duplicate, l.updated_at,
                (
                  SELECT al.created_at FROM crm_lead_assignment_logs al
                  WHERE al.lead_id = l.id AND al.to_user_id IS NOT NULL
                  ORDER BY al.created_at ASC LIMIT 1
                ) AS first_assigned_at
         FROM crm_leads l WHERE l.id = ?`,
      )
      .get(leadId) as unknown as LeadFunnelRow | undefined;
    return row ?? null;
  }

  hasB2ContactOkReport(leadId: number, stageKey = 'first_contact'): boolean {
    const row = this.database
      .prepare(
        `SELECT 1 AS ok FROM crm_lead_activities
         WHERE lead_id = ? AND care_stage_key = ? AND activity_type != 'system'
           AND trim(COALESCE(care_status, '')) = ?
         LIMIT 1`,
      )
      .get(leadId, stageKey, CONTACT_OK_CARE_STATUS) as { ok: number } | undefined;
    return Boolean(row);
  }

  private fetchB2CareAttemptStats(leadId: number): {
    negative_count: number;
    last_status: string | null;
  } {
    const countRow = this.database
      .prepare(
        `SELECT COUNT(*) AS c FROM crm_lead_activities
         WHERE lead_id = ? AND care_stage_key = 'first_contact' AND activity_type != 'system'
           AND trim(COALESCE(care_status, '')) != ''
           AND trim(care_status) != ?`,
      )
      .get(leadId, CONTACT_OK_CARE_STATUS) as { c: number } | undefined;
    const lastRow = this.database
      .prepare(
        `SELECT trim(care_status) AS care_status FROM crm_lead_activities
         WHERE lead_id = ? AND care_stage_key = 'first_contact' AND activity_type != 'system'
           AND trim(COALESCE(care_status, '')) != ''
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(leadId) as { care_status: string } | undefined;
    const lastStatus = String(lastRow?.care_status ?? '').trim() || null;
    return {
      negative_count: Number(countRow?.c ?? 0),
      last_status: lastStatus,
    };
  }

  buildSnapshot(leadId: number, presalesEnabled: boolean): LeadFunnelSnapshot | null {
    const row = this.fetchLeadRow(leadId);
    if (!row) return null;
    const meta = parseLeadMeta(row.meta_json);
    const presales = presalesEnabled ? this.getPresalesSnapshot(leadId) : null;
    const leadFlowKind = resolveLeadFlowKindFromFunnelRow(row, Boolean(presales));
    const care = carePipelineState(row.status, row.care_stage_current, row.care_stages_done_json);
    const contactOkReported = care.all_complete || this.hasB2ContactOkReport(leadId);
    const attemptStats = this.fetchB2CareAttemptStats(leadId);
    return {
      lead_id: leadId,
      lead_flow_kind: leadFlowKind,
      care_pipeline: {
        ...care,
        contact_ok_reported: contactOkReported,
        b2_negative_report_count: attemptStats.negative_count,
        last_b2_care_status: attemptStats.last_status ?? undefined,
        last_b2_care_status_label: attemptStats.last_status
          ? careStatusLabel(attemptStats.last_status)
          : undefined,
      },
      presales_care_gate: presalesCareGateState(row.care_stage_current, row.care_stages_done_json),
      review_queue: reviewQueuePublicState(meta, row.first_assigned_at || row.updated_at || ''),
      presales_on_lead_enabled: presalesEnabled,
      presales,
    };
  }

  isLeadInReviewQueue(leadId: number): boolean {
    const row = this.fetchLeadRow(leadId);
    if (!row) return false;
    return isLeadInReviewQueue(parseLeadMeta(row.meta_json));
  }

  listReviewQueueLeadIds(): number[] {
    const rows = this.database
      .prepare(
        `SELECT l.id FROM crm_leads l
         WHERE COALESCE(json_extract(l.meta_json, '$.review_queue.active'), '') = 'true'
           AND COALESCE(l.is_duplicate, 0) = 0`,
      )
      .all() as Array<{ id: number }>;
    return rows.map((r) => Number(r.id));
  }

  assertNotInReviewQueue(leadId: number): void {
    if (this.isLeadInReviewQueue(leadId)) {
      throw new Error('Lead đang ở danh mục Phải tra soát — chỉ GDKD được xử lý.');
    }
  }

  buildConsultAdvanceGate(leadId: number, presalesId: number) {
    return this.consultAdvanceGate(leadId, presalesId);
  }

  private consultAdvanceGate(leadId: number, presalesId: number) {
    const sessions = this.database
      .prepare(
        `SELECT status, mode, decision, bant_total FROM crm_lead_intake_sessions
         WHERE lead_id = ? ORDER BY updated_at DESC, id DESC LIMIT 20`,
      )
      .all(leadId) as Array<{
      status: string;
      mode: string;
      decision: string;
      bant_total: number;
    }>;
    const leadTasks = this.database
      .prepare(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN is_done = 1 THEN 1 ELSE 0 END) AS done
         FROM crm_lead_presales_tasks WHERE presales_id = ? AND stage = 'lead'`,
      )
      .get(presalesId) as { total: number; done: number };
    const leadTaskDone =
      Number(leadTasks.total) === 0 || Number(leadTasks.done) >= Number(leadTasks.total);
    return validatePresalesConsultAdvance({ leadTaskDone, sessions });
  }

  submitCareReport(
    leadId: number,
    body: CompleteCareStageBody,
    actor: string,
    userId: number | null,
  ): void {
    this.assertNotInReviewQueue(leadId);
    const row = this.fetchLeadRow(leadId);
    if (!row) throw new Error('Không tìm thấy lead.');
    const stageKey = String(body.stage || 'first_contact').trim();
    if (!CARE_STAGE_KEYS.includes(stageKey)) {
      throw new Error('Bước chăm sóc không hợp lệ.');
    }
    const careStatus = normalizeCareReportStatus(body.care_status);
    if (!careStatus) {
      throw new Error('Trạng thái chăm sóc không hợp lệ.');
    }
    const contactType = normalizeCareContactType(body.care_contact_type);
    const ts = this.ts();
    this.database
      .prepare(
        `INSERT INTO crm_lead_activities (
           lead_id, user_id, activity_type, content, result,
           next_action, next_action_at, created_at, created_by,
           lead_status_at_log, care_status, care_stage_key, care_contact_type
         ) VALUES (?, ?, 'call', ?, '', '', '', ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        leadId,
        userId,
        String(body.content || 'Báo cáo chăm sóc B2').slice(0, 8000),
        ts,
        actor.slice(0, 120),
        row.status,
        careStatus,
        stageKey,
        contactType.slice(0, 80),
      );
    this.database
      .prepare('UPDATE crm_leads SET updated_at = ?, updated_by = ? WHERE id = ?')
      .run(ts, actor.slice(0, 120), leadId);
  }

  completeCareStage(leadId: number, body: CompleteCareStageBody, actor: string): LeadFunnelRow {
    this.assertNotInReviewQueue(leadId);
    const row = this.fetchLeadRow(leadId);
    if (!row) throw new Error('Không tìm thấy lead.');
    const key = String(body.stage || 'first_contact').trim();
    if (!CARE_STAGE_KEYS.includes(key)) throw new Error('Bước chăm sóc không hợp lệ.');
    let current = String(row.care_stage_current || '').trim();
    if (!CARE_STAGE_KEYS.includes(current)) current = 'first_contact';
    if (key !== current) throw new Error('Chỉ có thể hoàn thành bước đang thực hiện.');
    const reportCount = this.database
      .prepare(
        `SELECT COUNT(*) AS c FROM crm_lead_activities
         WHERE lead_id = ? AND care_stage_key = ? AND activity_type != 'system'
           AND (trim(COALESCE(care_status, '')) != '' OR trim(COALESCE(care_contact_type, '')) != '')`,
      )
      .get(leadId, key) as { c: number };
    if (Number(reportCount.c) < 1) {
      throw new Error('Phải gửi ít nhất một báo cáo chăm sóc cho bước này trước khi hoàn thành.');
    }
    const okRow = this.database
      .prepare(
        `SELECT 1 FROM crm_lead_activities
         WHERE lead_id = ? AND care_stage_key = ? AND activity_type != 'system'
           AND trim(COALESCE(care_status, '')) = ?
         LIMIT 1`,
      )
      .get(leadId, key, CONTACT_OK_CARE_STATUS);
    if (!okRow) {
      throw new Error(
        'Phải có báo cáo trạng thái 「Liên hệ OK» (da_lien_he_thanh_cong) trước khi hoàn thành B2.',
      );
    }
    const noteClean = String(body.note || '').trim();
    if (noteClean.length < CARE_STAGE_MIN_COMPLETION_NOTE_LEN) {
      throw new Error(
        `Ghi chú hoàn thành bước là bắt buộc (tối thiểu ${CARE_STAGE_MIN_COMPLETION_NOTE_LEN} ký tự).`,
      );
    }
    const ts = this.ts();
    const done = JSON.parse(row.care_stages_done_json || '{}') as Record<string, string>;
    done[key] = ts;
    const stageMeta = CARE_PIPELINE_STAGES.find((s) => s.key === key)!;
    this.database
      .prepare(
        `INSERT INTO crm_lead_activities (lead_id, activity_type, content, created_at, created_by, lead_status_at_log)
         VALUES (?, 'system', ?, ?, ?, ?)`,
      )
      .run(
        leadId,
        `Hoàn thành bước: ${stageMeta.label}. Ghi chú: ${noteClean}`.slice(0, 8000),
        ts,
        actor.slice(0, 120),
        row.status,
      );
    this.database
      .prepare(
        `UPDATE crm_leads SET care_stage_current = ?, care_stages_done_json = ?,
         status = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
      )
      .run(key, serializeStagesDone(done), stageMeta.status_on_complete, ts, actor.slice(0, 120), leadId);
    const updated = this.fetchLeadRow(leadId);
    if (!updated) throw new Error('Không tìm thấy lead.');
    return updated;
  }

  countReviewQueue(): number {
    const row = this.database
      .prepare(
        `SELECT COUNT(*) AS c FROM crm_leads l
         WHERE COALESCE(json_extract(l.meta_json, '$.review_queue.active'), '') = 'true'
           AND COALESCE(l.is_duplicate, 0) = 0`,
      )
      .get() as { c: number };
    return Number(row.c ?? 0);
  }

  listReviewQueue(limit = 50): LeadFunnelRow[] {
    const lim = Math.max(1, Math.min(limit, 200));
    return this.database
      .prepare(
        `SELECT l.id, l.full_name, l.phone, l.email, l.status, l.owner_id,
                l.meta_json, l.care_stage_current, l.care_stages_done_json,
                COALESCE(l.is_duplicate, 0) AS is_duplicate, l.updated_at,
                json_extract(l.meta_json, '$.review_queue.assigned_at') AS first_assigned_at
         FROM crm_leads l
         WHERE COALESCE(json_extract(l.meta_json, '$.review_queue.active'), '') = 'true'
           AND COALESCE(l.is_duplicate, 0) = 0
         ORDER BY json_extract(l.meta_json, '$.review_queue.queued_at') DESC, l.id DESC
         LIMIT ?`,
      )
      .all(lim) as unknown as LeadFunnelRow[];
  }

  syncReviewQueue(actor: string, dryRun = false): Record<string, unknown> {
    const cfg = this.fetchLeadConfig();
    if (!cfg.b2_review_queue_enabled) {
      return { enabled: false, queued: 0, scanned: 0, deadline_hours: cfg.b2_contact_deadline_hours };
    }
    const rows = this.database
      .prepare(
        `SELECT l.*, (
            SELECT al.created_at FROM crm_lead_assignment_logs al
            WHERE al.lead_id = l.id AND al.to_user_id IS NOT NULL
            ORDER BY al.created_at ASC LIMIT 1
          ) AS first_assigned_at
         FROM crm_leads l
         WHERE l.owner_id IS NOT NULL AND COALESCE(l.is_duplicate, 0) = 0
           AND l.status NOT IN ('lost')
           AND COALESCE(json_extract(l.meta_json, '$.review_queue.active'), '') != 'true'
           AND COALESCE(json_extract(l.care_stages_done_json, '$.first_contact'), '') = ''`,
      )
      .all() as unknown as LeadFunnelRow[];
    let queued = 0;
    const leadIds: number[] = [];
    const now = new Date();
    for (const row of rows) {
      const gate = presalesCareGateState(row.care_stage_current, row.care_stages_done_json);
      if (gate.complete) continue;
      const assignedAt = row.first_assigned_at || row.updated_at || '';
      const assignedDt = new Date(String(assignedAt).slice(0, 19).replace(' ', 'T') + 'Z');
      if (Number.isNaN(assignedDt.getTime())) continue;
      const elapsedH = (now.getTime() - assignedDt.getTime()) / 3600000;
      if (elapsedH < cfg.b2_contact_deadline_hours) continue;
      leadIds.push(row.id);
      if (dryRun) {
        queued += 1;
        continue;
      }
      this.queueLeadForReview(row.id, {
        actor,
        previousOwnerId: row.owner_id,
        assignedAt,
        deadlineHours: cfg.b2_contact_deadline_hours,
      });
      queued += 1;
    }
    return {
      enabled: true,
      dry_run: dryRun,
      queued,
      scanned: rows.length,
      deadline_hours: cfg.b2_contact_deadline_hours,
      lead_ids: leadIds,
    };
  }

  private queueLeadForReview(
    leadId: number,
    opts: {
      actor: string;
      previousOwnerId: number | null;
      assignedAt: string;
      deadlineHours: number;
    },
  ): void {
    const row = this.fetchLeadRow(leadId);
    if (!row) return;
    const meta = parseLeadMeta(row.meta_json);
    if (isLeadInReviewQueue(meta)) return;
    const ts = this.ts();
    meta.review_queue = {
      active: true,
      reason: REVIEW_QUEUE_REASON,
      queued_at: ts,
      previous_owner_id: opts.previousOwnerId,
      assigned_at: opts.assignedAt,
      deadline_hours: opts.deadlineHours,
    };
    this.database
      .prepare(
        `UPDATE crm_leads SET owner_id = NULL, meta_json = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
      )
      .run(JSON.stringify(meta), ts, opts.actor.slice(0, 120), leadId);
    if (opts.previousOwnerId) {
      this.database
        .prepare(
          `INSERT INTO crm_lead_assignment_logs
           (lead_id, from_user_id, to_user_id, reason, created_by, created_at)
           VALUES (?, ?, NULL, ?, ?, ?)`,
        )
        .run(
          leadId,
          opts.previousOwnerId,
          'Quá hạn B2 — chuyển Lead Phải tra soát (GDKD)',
          opts.actor.slice(0, 120),
          ts,
        );
    }
  }

  releaseFromReviewQueue(leadId: number, body: ReleaseReviewQueueBody, actor: string): LeadFunnelRow {
    const row = this.fetchLeadRow(leadId);
    if (!row) throw new Error('Không tìm thấy lead.');
    const meta = parseLeadMeta(row.meta_json);
    const rq = meta.review_queue as Record<string, unknown> | undefined;
    if (!rq?.active) throw new Error('Lead không ở danh mục Phải tra soát.');
    const mode = String(body.mode || '').trim().toLowerCase();
    if (mode !== 'auto' && mode !== 'manual') throw new Error('mode phải là auto hoặc manual.');
    let targetOwner: number | null = null;
    if (mode === 'manual') {
      if (!body.owner_id) throw new Error('Chọn AM để gán lại.');
      const staff = this.database
        .prepare('SELECT id FROM crm_staff WHERE id = ? AND COALESCE(active, 1) = 1')
        .get(body.owner_id);
      if (!staff) throw new Error('AM không hợp lệ hoặc đã ngưng.');
      targetOwner = Number(body.owner_id);
    } else {
      const prev = rq.previous_owner_id ? Number(rq.previous_owner_id) : null;
      if (prev) {
        const staff = this.database
          .prepare('SELECT id FROM crm_staff WHERE id = ? AND COALESCE(active, 1) = 1')
          .get(prev);
        if (staff) targetOwner = prev;
      }
      if (!targetOwner) throw new Error('Không tìm được AM để gán lại (auto).');
    }
    const ts = this.ts();
    delete meta.review_queue;
    this.database
      .prepare(
        `UPDATE crm_leads SET owner_id = ?, meta_json = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
      )
      .run(targetOwner, JSON.stringify(meta), ts, actor.slice(0, 120), leadId);
    this.database
      .prepare(
        `INSERT INTO crm_lead_assignment_logs
         (lead_id, from_user_id, to_user_id, reason, created_by, created_at)
         VALUES (?, NULL, ?, ?, ?, ?)`,
      )
      .run(
        leadId,
        targetOwner,
        String(body.note || 'GDKD release từ Phải tra soát').slice(0, 500),
        actor.slice(0, 120),
        ts,
      );
    const updated = this.fetchLeadRow(leadId);
    if (!updated) throw new Error('Không tìm thấy lead.');
    return updated;
  }

  ensurePresales(leadId: number, serviceSlug: string, actor: string): PresalesRow {
    this.assertNotInReviewQueue(leadId);
    const row = this.fetchLeadRow(leadId);
    if (!row) throw new Error('Không tìm thấy lead.');
    assertPresalesCareGate(row.care_stage_current, row.care_stages_done_json);
    const slug = String(serviceSlug || '').trim();
    if (!slug) throw new Error('Cần service_slug để tạo pre-sales');
    const existingRaw = this.database
      .prepare('SELECT * FROM crm_lead_presales WHERE lead_id = ?')
      .get(leadId) as Record<string, unknown> | undefined;
    if (existingRaw) {
      const existing = this.parsePresalesRowFromDb(existingRaw);
      if (existing.status === 'converted') return existing;
      this.seedPresalesTasks(existing.id, slug);
      return existing;
    }
    const ts = this.ts();
    const ownerId = row.owner_id;
    const result = this.database
      .prepare(
        `INSERT INTO crm_lead_presales
         (lead_id, service_slug, stage, status, assigned_am, stage_entered_at, notes, created_at, updated_at)
         VALUES (?, ?, 'lead', 'active', ?, ?, ?, ?, ?)`,
      )
      .run(leadId, slug, ownerId, ts, `Pre-sales tạo bởi ${actor}`.slice(0, 4000), ts, ts);
    const presalesId = Number(result.lastInsertRowid);
    this.seedPresalesTasks(presalesId, slug);
    const psRaw = this.database
      .prepare('SELECT * FROM crm_lead_presales WHERE id = ?')
      .get(presalesId) as Record<string, unknown>;
    return this.parsePresalesRowFromDb(psRaw);
  }

  private seedPresalesTasks(presalesId: number, serviceSlug: string): void {
    const existing = this.database
      .prepare(
        'SELECT COUNT(*) AS c FROM crm_lead_presales_tasks WHERE presales_id = ? AND is_custom = 0',
      )
      .get(presalesId) as { c: number };
    if (Number(existing.c) > 0) return;
    const steps = workflowStepsForService(serviceSlug);
    const ts = this.ts();
    for (const stage of PRESALES_STAGES) {
      const stageSteps = steps[stage] || [];
      stageSteps.forEach((step, idx) => {
        this.database
          .prepare(
            `INSERT INTO crm_lead_presales_tasks
             (presales_id, stage, step_index, title, description, ai_prompt_key, form_fields, form_data, is_done, is_custom, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, '{}', 0, 0, ?, ?)`,
          )
          .run(
            presalesId,
            stage,
            idx,
            step.title,
            step.description,
            step.ai_prompt_key || '',
            JSON.stringify(step.form_fields || []),
            ts,
            ts,
          );
      });
    }
  }

  getPresalesSnapshot(leadId: number): PresalesSnapshot | null {
    const rawPs = this.database
      .prepare('SELECT * FROM crm_lead_presales WHERE lead_id = ?')
      .get(leadId) as Record<string, unknown> | undefined;
    if (!rawPs) return null;
    const ps = this.parsePresalesRowFromDb(rawPs);
    const taskRows = this.database
      .prepare(
        'SELECT * FROM crm_lead_presales_tasks WHERE presales_id = ? ORDER BY stage, step_index, id',
      )
      .all(ps.id) as Array<Record<string, unknown>>;
    const tasks: Record<string, PresalesTaskRow[]> = {};
    for (const raw of taskRows) {
      const stage = String(raw.stage);
      const task: PresalesTaskRow = {
        id: Number(raw.id),
        presales_id: Number(raw.presales_id),
        stage,
        step_index: Number(raw.step_index),
        title: String(raw.title),
        description: String(raw.description),
        form_fields: JSON.parse(String(raw.form_fields || '[]')) as unknown[],
        form_data: JSON.parse(String(raw.form_data || '{}')) as Record<string, unknown>,
        ai_prompt_key: String(raw.ai_prompt_key || ''),
        ai_output: String(raw.ai_output || ''),
        is_done: Boolean(raw.is_done),
        done_at: String(raw.done_at || ''),
        notes: String(raw.notes || ''),
      };
      (tasks[stage] ||= []).push(task);
    }
    const progress: Record<string, { total: number; done: number }> = {};
    for (const stage of PRESALES_STAGES) {
      const list = tasks[stage] || [];
      progress[stage] = {
        total: list.length,
        done: list.filter((t) => t.is_done).length,
      };
    }
    const current = String(ps.stage || 'lead');
    const currentIdx = PRESALES_STAGES.indexOf(current as (typeof PRESALES_STAGES)[number]);
    const nextStage = currentIdx >= 0 && currentIdx < PRESALES_STAGES.length - 1
      ? PRESALES_STAGES[currentIdx + 1]
      : null;
    const curProg = progress[current] || { total: 0, done: 0 };
    const currentComplete = curProg.total === 0 || curProg.done >= curProg.total;
    let blockReason = '';
    let canAdvance = false;
    if (ps.status !== 'active') {
      blockReason = 'Pre-sales đã đóng hoặc đã chuyển lifecycle.';
    } else if (!nextStage) {
      blockReason = 'Đã ở giai đoạn Proposal — chờ ký HĐ để tạo Lifecycle.';
    } else if (!currentComplete) {
      blockReason = 'Hoàn thành tất cả task giai đoạn hiện tại trước khi chuyển bước.';
    } else if (nextStage === 'consult' && current === 'lead') {
      const gate = this.consultAdvanceGate(leadId, ps.id);
      if (!gate.ok || gate.requires_confirm) {
        blockReason = gate.messages[0] || 'Chưa đủ điều kiện chuyển Tư vấn';
      } else {
        canAdvance = true;
      }
    } else if (nextStage === 'proposal' && current === 'consult') {
      if (blocksDirectProposalAdvance(ps.handoff_status)) {
        blockReason =
          'Lead đang Solution/MKT — dùng Trả Sales (release) hoặc chờ Solution hoàn tất Consult + R5.';
      } else {
        const plan = this.getPreliminaryPlan(ps.id);
        const val = validatePreliminaryPlan(plan);
        if (!val.ok) blockReason = val.messages[0] || 'KH MKT sơ bộ chưa đủ';
        else canAdvance = true;
      }
    } else {
      canAdvance = true;
    }
    return {
      presales: ps,
      handoff: this.buildHandoffView(ps),
      l2_docs: buildPresalesL2DocsView(ps.service_slug, ps.l2_docs_json),
      consult_proposal_sla: buildPresalesConsultProposalSla({
        presalesStage: ps.stage,
        consultEnteredAt: ps.consult_entered_at,
        stageEnteredAt: ps.stage_entered_at,
      }),
      tasks,
      progress,
      advance: {
        current_stage: current,
        next_stage: nextStage,
        can_advance_forward: canAdvance,
        block_reason: blockReason,
        current_complete: currentComplete,
        current_done: curProg.done,
        current_total: curProg.total,
        status: ps.status,
      },
    };
  }

  getLeadConvertedCustomerId(leadId: number): number | null {
    const row = this.database
      .prepare('SELECT converted_customer_id FROM crm_leads WHERE id = ? LIMIT 1')
      .get(leadId) as { converted_customer_id: number | null } | undefined;
    const id = Number(row?.converted_customer_id ?? 0);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  getPresalesTaskById(taskId: number): PresalesTaskRow | null {
    const raw = this.database
      .prepare('SELECT * FROM crm_lead_presales_tasks WHERE id = ? LIMIT 1')
      .get(taskId) as Record<string, unknown> | undefined;
    if (!raw) return null;
    return {
      id: Number(raw.id),
      presales_id: Number(raw.presales_id),
      stage: String(raw.stage),
      step_index: Number(raw.step_index),
      title: String(raw.title),
      description: String(raw.description),
      form_fields: JSON.parse(String(raw.form_fields || '[]')) as unknown[],
      form_data: JSON.parse(String(raw.form_data || '{}')) as Record<string, unknown>,
      ai_prompt_key: String(raw.ai_prompt_key || ''),
      ai_output: String(raw.ai_output || ''),
      is_done: Boolean(raw.is_done),
      done_at: String(raw.done_at || ''),
      notes: String(raw.notes || ''),
    };
  }

  updatePresalesTaskAiOutput(taskId: number, aiOutput: string): void {
    const ts = this.ts();
    this.database
      .prepare('UPDATE crm_lead_presales_tasks SET ai_output = ?, updated_at = ? WHERE id = ?')
      .run(aiOutput.slice(0, 16000), ts, taskId);
  }

  runPresalesConsultPrefill(
    leadId: number,
    overwrite = false,
  ): { task_id: number | null; filled: number; fields: string[]; skipped_existing: string[] } {
    const snap = this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    const consultTasks = snap.tasks.consult ?? [];
    const leadTasks = snap.tasks.lead ?? [];
    if (consultTasks.length === 0) throw new Error('Chưa có task Consult');

    let sessions: IntakeSessionRow[] = [];
    try {
      const rows = this.database
        .prepare(
          `SELECT * FROM crm_lead_intake_sessions WHERE lead_id = ? ORDER BY updated_at DESC, id DESC LIMIT 20`,
        )
        .all(leadId) as Array<Record<string, unknown>>;
      sessions = rows.map((row) => ({
        ...row,
        bant_json: JSON.parse(String(row.bant_json ?? '{}')) as Record<string, unknown>,
        answers_json: JSON.parse(String(row.answers_json ?? '{}')) as Record<string, unknown>,
        stakeholders_json: JSON.parse(String(row.stakeholders_json ?? '[]')) as Array<Record<string, string>>,
        commitments_json: JSON.parse(String(row.commitments_json ?? '[]')) as Array<Record<string, string>>,
        ai_suggested_questions: JSON.parse(String(row.ai_suggested_questions ?? '[]')) as string[],
      })) as IntakeSessionRow[];
    } catch {
      sessions = [];
    }

    const latest = pickLatestCompletedIntake(sessions);
    const out = prefillPresalesConsultTaskForm({
      serviceSlug: snap.presales.service_slug,
      consultTask: consultTasks[0]!,
      leadTask: leadTasks[0] ?? null,
      latestIntake: latest,
      overwrite,
    });
    if (out.filled.length > 0 || out.notes !== consultTasks[0]!.notes) {
      this.updatePresalesTask(
        consultTasks[0]!.id,
        { form_data: out.form_data, notes: out.notes },
        null,
      );
    }
    return {
      task_id: consultTasks[0]!.id,
      filled: out.filled.length,
      fields: out.filled,
      skipped_existing: out.skipped_existing,
    };
  }

  listPresalesWorkflowUpgradeCohort(opts?: {
    leadIds?: number[];
    limit?: number;
  }): PresalesWorkflowUpgradeCohortRow[] {
    const rowLimit = opts?.leadIds?.length
      ? capBatchLeadIds(opts.leadIds, opts.limit).length
      : Math.min(PRESALES_BATCH_UPGRADE_MAX, opts?.limit ?? PRESALES_BATCH_UPGRADE_MAX);
    const params: Array<number | string> = [PRESALES_UPGRADE_CONSULT_FIELD_MIN];
    let leadFilter = '';
    if (opts?.leadIds?.length) {
      const ids = capBatchLeadIds(opts.leadIds, opts.limit);
      leadFilter = ` AND ps.lead_id IN (${ids.map(() => '?').join(', ')})`;
      params.push(...ids);
    }
    params.push(rowLimit);

    const rows = this.database
      .prepare(
        `SELECT ps.lead_id, ps.id AS presales_id, ps.service_slug, ps.stage,
                (
                  SELECT t.form_fields FROM crm_lead_presales_tasks t
                  WHERE t.presales_id = ps.id AND t.stage = 'consult' AND t.is_custom = 0
                  ORDER BY t.step_index, t.id LIMIT 1
                ) AS consult_form_fields
         FROM crm_lead_presales ps
         WHERE ps.status = 'active'
           AND ps.stage IN ('lead', 'consult', 'proposal')
           AND EXISTS (
             SELECT 1 FROM crm_lead_presales_tasks t
             WHERE t.presales_id = ps.id
               AND t.stage = 'consult'
               AND t.is_custom = 0
               AND (
                 SELECT COUNT(*) FROM json_each(COALESCE(t.form_fields, '[]'))
               ) < ?
           )
           ${leadFilter}
         ORDER BY ps.updated_at DESC
         LIMIT ?`,
      )
      .all(...params) as Array<Record<string, unknown>>;

    return rows.map((row) => {
      let consultFieldKeys: string[] = [];
      try {
        const parsed = JSON.parse(String(row.consult_form_fields ?? '[]')) as Array<{ key?: string }>;
        consultFieldKeys = parsed.map((f) => String(f.key ?? '')).filter(Boolean).sort();
      } catch {
        consultFieldKeys = [];
      }
      return {
        lead_id: Number(row.lead_id),
        presales_id: Number(row.presales_id),
        service_slug: String(row.service_slug ?? ''),
        stage: String(row.stage ?? ''),
        consult_field_keys: consultFieldKeys,
      };
    });
  }

  upgradePresalesWorkflowTemplate(
    leadId: number,
    opts: { stages?: string[]; dryRun?: boolean; prefillConsult?: boolean },
  ): {
    ok: boolean;
    dry_run: boolean;
    service_slug: string;
    stages: Array<{
      stage: string;
      deleted: number;
      inserted: number;
      preserved_done: boolean;
      mapped_fields: string[];
    }>;
    prefill?: { task_id: number | null; filled: number; fields: string[] };
  } {
    const snap = this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (snap.presales.status !== 'active') throw new Error('Pre-sales không còn active');

    const stages = normalizeUpgradeStages(opts.stages);
    const slug = snap.presales.service_slug;
    const steps = workflowStepsForService(slug);
    const plan = buildPresalesWorkflowUpgradePlan(slug, stages, snap.tasks);
    const stageResults: Array<{
      stage: string;
      deleted: number;
      inserted: number;
      preserved_done: boolean;
      mapped_fields: string[];
    }> = [];
    const ts = this.ts();

    if (!opts.dryRun) {
      for (const stage of stages) {
        const stageSteps = steps[stage] ?? [];
        const oldTasks = snap.tasks[stage] ?? [];
        const newKeys = stageSteps.flatMap((s) => (s.form_fields ?? []).map((f) => f.key));
        const { form_data, is_done } = mergeLegacyPresalesFormData(oldTasks, newKeys);

        const del = this.database
          .prepare(
            `DELETE FROM crm_lead_presales_tasks
             WHERE presales_id = ? AND stage = ? AND is_custom = 0`,
          )
          .run(snap.presales.id, stage);
        let inserted = 0;
        for (let idx = 0; idx < stageSteps.length; idx += 1) {
          const step = stageSteps[idx]!;
          this.database
            .prepare(
              `INSERT INTO crm_lead_presales_tasks
                 (presales_id, stage, step_index, title, description, ai_prompt_key, form_fields, form_data,
                  is_done, is_custom, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            )
            .run(
              snap.presales.id,
              stage,
              idx,
              step.title,
              step.description,
              step.ai_prompt_key || '',
              JSON.stringify(step.form_fields || []),
              JSON.stringify(form_data),
              is_done ? 1 : 0,
              ts,
              ts,
            );
          inserted += 1;
        }
        stageResults.push({
          stage,
          deleted: Number(del.changes ?? oldTasks.length),
          inserted,
          preserved_done: is_done,
          mapped_fields: Object.keys(form_data),
        });
      }
    } else {
      stageResults.push(...plan.stages);
    }

    let prefill: { task_id: number | null; filled: number; fields: string[] } | undefined;
    if (!opts.dryRun && opts.prefillConsult !== false && stages.includes('consult')) {
      const pf = this.runPresalesConsultPrefill(leadId, false);
      prefill = { task_id: pf.task_id, filled: pf.filled, fields: pf.fields };
    }

    return {
      ok: true,
      dry_run: Boolean(opts.dryRun),
      service_slug: slug,
      stages: stageResults,
      prefill,
    };
  }

  getPresalesFunnelMetrics(query: PresalesFunnelMetricsQuery) {
    return loadPresalesFunnelMetricsSqlite(this.database, query);
  }

  getPresalesConsultSlaSummary(amId?: number | null): PresalesConsultSlaSummary {
    const params: number[] = [];
    let amFilter = '';
    if (amId != null && Number.isFinite(amId) && amId > 0) {
      amFilter = ' AND COALESCE(ps.assigned_am, l.owner_id) = ?';
      params.push(amId);
    }
    const activeRows = this.database
      .prepare(
        `SELECT ps.stage, ps.consult_entered_at, ps.stage_entered_at
         FROM crm_lead_presales ps
         INNER JOIN crm_leads l ON l.id = ps.lead_id
         WHERE ps.status = 'active' AND ps.stage = 'consult'${amFilter}`,
      )
      .all(...params) as Array<Record<string, unknown>>;

    let slaOk = 0;
    let slaWarning = 0;
    let slaBreach = 0;
    for (const row of activeRows) {
      const sla = buildPresalesConsultProposalSla({
        presalesStage: 'consult',
        consultEnteredAt: String(row.consult_entered_at ?? ''),
        stageEnteredAt: String(row.stage_entered_at ?? ''),
      });
      if (sla.sla_state === 'breach') slaBreach += 1;
      else if (sla.sla_state === 'warning') slaWarning += 1;
      else if (sla.sla_state === 'ok') slaOk += 1;
    }

    const completedParams = [...params];
    const completedRows = this.database
      .prepare(
        `SELECT ps.consult_entered_at, ps.proposal_entered_at
         FROM crm_lead_presales ps
         INNER JOIN crm_leads l ON l.id = ps.lead_id
         WHERE ps.consult_entered_at != '' AND ps.proposal_entered_at != ''${amFilter}`,
      )
      .all(...completedParams) as Array<Record<string, unknown>>;

    let within48 = 0;
    for (const row of completedRows) {
      if (
        isConsultToProposalWithin48h(
          String(row.consult_entered_at ?? ''),
          String(row.proposal_entered_at ?? ''),
        )
      ) {
        within48 += 1;
      }
    }
    const denom = completedRows.length;
    return {
      active_consult: activeRows.length,
      sla_ok: slaOk,
      sla_warning: slaWarning,
      sla_breach: slaBreach,
      consult_to_proposal_48h_pct: denom > 0 ? Math.round((within48 / denom) * 1000) / 10 : 0,
      consult_to_proposal_48h_num: within48,
      consult_to_proposal_48h_denom: denom,
    };
  }

  updatePresalesL2Docs(leadId: number, patch: Record<string, boolean>): PresalesRow {
    const snap = this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    const merged = mergePresalesL2DocsPatch(
      snap.presales.service_slug,
      snap.presales.l2_docs_json,
      patch,
    );
    const ts = this.ts();
    this.database
      .prepare('UPDATE crm_lead_presales SET l2_docs_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(merged), ts, snap.presales.id);
    const updated = this.database
      .prepare('SELECT * FROM crm_lead_presales WHERE id = ?')
      .get(snap.presales.id) as Record<string, unknown>;
    return this.parsePresalesRowFromDb(updated);
  }

  updatePresalesTask(taskId: number, body: PatchPresalesTaskBody, doneBy: number | null): void {
    const ts = this.ts();
    const sets = ['updated_at = ?'];
    const params: Array<string | number | bigint | Buffer | null> = [ts];
    if (body.is_done !== undefined) {
      sets.push('is_done = ?');
      params.push(body.is_done ? 1 : 0);
      sets.push('done_at = ?');
      params.push(body.is_done ? ts : '');
      if (doneBy != null) {
        sets.push('done_by = ?');
        params.push(doneBy);
      }
    }
    if (body.notes !== undefined) {
      sets.push('notes = ?');
      params.push(String(body.notes).slice(0, 4000));
    }
    if (body.form_data !== undefined) {
      sets.push('form_data = ?');
      params.push(JSON.stringify(body.form_data));
    }
    params.push(taskId);
    this.database
      .prepare(`UPDATE crm_lead_presales_tasks SET ${sets.join(', ')} WHERE id = ?`)
      .run(...params);
  }

  private applyPresalesConsultPrefill(leadId: number, _snap: PresalesSnapshot): void {
    this.runPresalesConsultPrefill(leadId, false);
  }

  advancePresales(
    leadId: number,
    opts: { confirm?: boolean; overrideReason?: string; allowOverride?: boolean } = {},
  ): PresalesRow {
    this.assertNotInReviewQueue(leadId);
    const snap = this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (!snap.advance.next_stage) {
      throw new Error(snap.advance.block_reason || 'Không thể chuyển giai đoạn');
    }
    if (snap.advance.next_stage === 'consult' && snap.advance.current_stage === 'lead') {
      const gate = this.consultAdvanceGate(leadId, snap.presales.id);
      const block = consultAdvanceBlockReason(gate, Boolean(opts.confirm));
      if (block) throw new Error(block);
      if (opts.overrideReason?.trim()) {
        const note = `Director override: ${opts.overrideReason.trim().slice(0, 500)}`;
        this.database
          .prepare('UPDATE crm_lead_presales SET notes = TRIM(notes || char(10) || ?) WHERE id = ?')
          .run(note, snap.presales.id);
      }
    } else if (!snap.advance.can_advance_forward) {
      throw new Error(snap.advance.block_reason || 'Không thể chuyển giai đoạn');
    } else if (
      snap.advance.next_stage === 'proposal' &&
      snap.advance.current_stage === 'consult' &&
      blocksDirectProposalAdvance(snap.presales.handoff_status)
    ) {
      throw new Error(
        'Lead đang Solution/MKT — Solution dùng Trả Sales sau khi hoàn tất Consult + R5.',
      );
    }
    const ts = this.ts();
    const nextStage = snap.advance.next_stage!;
    const extraSets: string[] = [];
    const extraParams: Array<string | number> = [];
    if (nextStage === 'consult') {
      extraSets.push('consult_entered_at = CASE WHEN consult_entered_at = \'\' OR consult_entered_at IS NULL THEN ? ELSE consult_entered_at END');
      extraParams.push(ts);
    }
    if (nextStage === 'proposal') {
      extraSets.push('proposal_entered_at = ?');
      extraParams.push(ts);
      if (!snap.presales.consult_entered_at) {
        extraSets.push('consult_entered_at = ?');
        extraParams.push(snap.presales.stage_entered_at || ts);
      }
    }
    const setSql = extraSets.length
      ? `, ${extraSets.join(', ')}`
      : '';
    this.database
      .prepare(
        `UPDATE crm_lead_presales SET stage = ?, stage_entered_at = ?, updated_at = ?${setSql} WHERE id = ?`,
      )
      .run(
        nextStage,
        ts,
        ts,
        ...extraParams,
        snap.presales.id,
      );
    if (snap.advance.next_stage === 'consult' && snap.advance.current_stage === 'lead') {
      this.applyPresalesConsultPrefill(leadId, snap);
    }
    const updatedRaw = this.database
      .prepare('SELECT * FROM crm_lead_presales WHERE id = ?')
      .get(snap.presales.id) as Record<string, unknown>;
    return this.parsePresalesRowFromDb(updatedRaw);
  }

  getPreliminaryPlan(presalesId: number): Record<string, unknown> | null {
    const ps = this.database
      .prepare('SELECT draft_marketing_plan_id FROM crm_lead_presales WHERE id = ?')
      .get(presalesId) as { draft_marketing_plan_id: number | null } | undefined;
    if (!ps?.draft_marketing_plan_id) return null;
    return this.database
      .prepare('SELECT * FROM crm_marketing_plans WHERE id = ?')
      .get(ps.draft_marketing_plan_id) as Record<string, unknown> | null;
  }

  getOrCreatePreliminaryPlan(leadId: number, presalesId: number, serviceSlug: string): Record<string, unknown> {
    const existing = this.getPreliminaryPlan(presalesId);
    if (existing) return existing;
    const ts = this.ts();
    const name = `KH MKT sơ bộ — Lead #${leadId}${serviceSlug ? ` (${serviceSlug})` : ''}`;
    const result = this.database
      .prepare(
        `INSERT INTO crm_marketing_plans (
           code, name, status, plan_kind, lead_id, presales_id,
           north_star, objectives, strategy_framework_json, target_market_prof_json,
           target_market_steps4_json, created_at, updated_at
         ) VALUES (?, ?, 'draft', 'preliminary', ?, ?, '', '', ?, '{}', '{}', ?, ?)`,
      )
      .run(
        `PS-${presalesId}-DRAFT`,
        name.slice(0, 200),
        leadId,
        presalesId,
        JSON.stringify(defaultStrategyJson()),
        ts,
        ts,
      );
    const planId = Number(result.lastInsertRowid);
    this.database
      .prepare('UPDATE crm_lead_presales SET draft_marketing_plan_id = ?, updated_at = ? WHERE id = ?')
      .run(planId, ts, presalesId);
    return this.database.prepare('SELECT * FROM crm_marketing_plans WHERE id = ?').get(planId) as Record<
      string,
      unknown
    >;
  }

  patchMarketingPlan(leadId: number, body: PatchMarketingPlanBody): Record<string, unknown> {
    const snap = this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    const plan = this.getOrCreatePreliminaryPlan(leadId, snap.presales.id, snap.presales.service_slug);
    const planId = Number(plan.id);
    const ts = this.ts();
    const content = planContentFromRow(plan);
    const northStar = body.north_star !== undefined ? String(body.north_star) : String(plan.north_star || '');
    const objectives =
      body.objectives !== undefined ? String(body.objectives) : String(plan.objectives || '');
    if (body.name !== undefined) content.name = String(body.name);
    if (body.strategy_framework) {
      content.strategy_framework = { ...content.strategy_framework, ...body.strategy_framework };
    }
    let targetMarketProf: Record<string, string> = {};
    try {
      targetMarketProf = JSON.parse(String(plan.target_market_prof_json || '{}')) as Record<string, string>;
    } catch {
      targetMarketProf = {};
    }
    if (body.target_market_prof) {
      targetMarketProf = { ...targetMarketProf, ...body.target_market_prof };
    }
    this.database
      .prepare(
        `UPDATE crm_marketing_plans SET name = ?, north_star = ?, objectives = ?,
         strategy_framework_json = ?, target_market_prof_json = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        content.name.slice(0, 200),
        northStar,
        objectives,
        JSON.stringify(content.strategy_framework),
        JSON.stringify(targetMarketProf),
        ts,
        planId,
      );
    return this.database.prepare('SELECT * FROM crm_marketing_plans WHERE id = ?').get(planId) as Record<
      string,
      unknown
    >;
  }

  handoffToSolution(
    leadId: number,
    staffId: number,
    opts: { confirm?: boolean; overrideReason?: string } = {},
  ): PresalesRow {
    this.assertNotInReviewQueue(leadId);
    const snap = this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (snap.presales.stage !== 'lead') {
      throw new Error('Chỉ giao Solution khi đang ở giai đoạn Lead.');
    }
    if (snap.presales.handoff_status === 'pending' || snap.presales.handoff_status === 'with_solution') {
      throw new Error('Lead đã được giao Solution.');
    }
    const gate = this.consultAdvanceGate(leadId, snap.presales.id);
    const block = consultAdvanceBlockReason(gate, Boolean(opts.confirm));
    if (block) throw new Error(block);
    if (opts.overrideReason?.trim()) {
      const note = `Director override handoff: ${opts.overrideReason.trim().slice(0, 500)}`;
      this.database
        .prepare('UPDATE crm_lead_presales SET notes = TRIM(notes || char(10) || ?) WHERE id = ?')
        .run(note, snap.presales.id);
    }

    const ts = this.ts();
    this.database
      .prepare(
        `UPDATE crm_lead_presales
         SET stage = 'consult',
             stage_entered_at = ?,
             updated_at = ?,
             consult_entered_at = CASE
               WHEN consult_entered_at = '' OR consult_entered_at IS NULL THEN ?
               ELSE consult_entered_at
             END,
             handoff_status = 'pending',
             handed_off_at = ?,
             handed_off_by_staff_id = ?
         WHERE id = ?`,
      )
      .run(ts, ts, ts, ts, staffId, snap.presales.id);
    this.applyPresalesConsultPrefill(leadId, snap);
    const updatedRaw = this.database
      .prepare('SELECT * FROM crm_lead_presales WHERE id = ?')
      .get(snap.presales.id) as Record<string, unknown>;
    return this.parsePresalesRowFromDb(updatedRaw);
  }

  claimSolution(leadId: number, staffId: number): PresalesRow {
    const snap = this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (snap.presales.handoff_status !== 'pending') {
      throw new Error('Lead không ở trạng thái chờ Solution nhận case.');
    }
    const ts = this.ts();
    this.database
      .prepare(
        `UPDATE crm_lead_presales
         SET handoff_status = 'with_solution',
             solution_owner_staff_id = ?,
             solution_claimed_at = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(staffId, ts, ts, snap.presales.id);
    const updatedRaw = this.database
      .prepare('SELECT * FROM crm_lead_presales WHERE id = ?')
      .get(snap.presales.id) as Record<string, unknown>;
    return this.parsePresalesRowFromDb(updatedRaw);
  }

  releaseToSales(leadId: number, staffId: number): PresalesRow {
    const snap = this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (snap.presales.stage !== 'consult') {
      throw new Error('Chỉ release khi đang ở giai đoạn Tư vấn.');
    }
    if (snap.presales.handoff_status !== 'with_solution') {
      throw new Error('Solution cần nhận case trước khi trả Sales.');
    }
    if (
      snap.presales.solution_owner_staff_id &&
      snap.presales.solution_owner_staff_id !== staffId
    ) {
      throw new Error('Chỉ Solution owner được trả Sales.');
    }
    const curProg = snap.progress.consult || { total: 0, done: 0 };
    const consultComplete = curProg.total === 0 || curProg.done >= curProg.total;
    if (!consultComplete) {
      throw new Error('Hoàn thành task Consult trước khi trả Sales.');
    }
    const plan = this.getPreliminaryPlan(snap.presales.id);
    const val = validatePreliminaryPlan(plan);
    if (!val.ok) {
      throw new Error(val.messages[0] || 'KH MKT sơ bộ chưa đủ');
    }

    const ts = this.ts();
    this.database
      .prepare(
        `UPDATE crm_lead_presales
         SET stage = 'proposal',
             stage_entered_at = ?,
             updated_at = ?,
             proposal_entered_at = ?,
             handoff_status = 'released',
             solution_released_at = ?,
             consult_entered_at = CASE
               WHEN consult_entered_at = '' OR consult_entered_at IS NULL THEN ?
               ELSE consult_entered_at
             END
         WHERE id = ?`,
      )
      .run(ts, ts, ts, ts, snap.presales.consult_entered_at || snap.presales.stage_entered_at || ts, snap.presales.id);
    const updatedRaw = this.database
      .prepare('SELECT * FROM crm_lead_presales WHERE id = ?')
      .get(snap.presales.id) as Record<string, unknown>;
    return this.parsePresalesRowFromDb(updatedRaw);
  }

  listSolutionQueue(
    statuses: Array<'pending' | 'with_solution'> = ['pending', 'with_solution'],
    limit = 50,
  ): SolutionQueueRow[] {
    const lim = Math.max(1, Math.min(limit, 200));
    const allowed = statuses.filter((s) => s === 'pending' || s === 'with_solution');
    const filterStatuses = allowed.length ? allowed : ['pending', 'with_solution'];
    const placeholders = filterStatuses.map(() => '?').join(', ');
    const rows = this.database
      .prepare(
        `SELECT l.id AS lead_id, l.full_name, l.phone, l.owner_id,
                ps.service_slug, ps.stage AS presales_stage, ps.handoff_status,
                ps.handed_off_at, ps.solution_owner_staff_id,
                am.name AS owner_name,
                sol.name AS solution_owner_name
         FROM crm_lead_presales ps
         INNER JOIN crm_leads l ON l.id = ps.lead_id
         LEFT JOIN crm_staff am ON am.id = l.owner_id
         LEFT JOIN crm_staff sol ON sol.id = ps.solution_owner_staff_id
         WHERE ps.status = 'active'
           AND ps.handoff_status IN (${placeholders})
         ORDER BY ps.handed_off_at DESC, ps.id DESC
         LIMIT ?`,
      )
      .all(...filterStatuses, lim) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      lead_id: Number(row.lead_id),
      full_name: String(row.full_name ?? ''),
      phone: String(row.phone ?? ''),
      service_slug: String(row.service_slug ?? ''),
      presales_stage: String(row.presales_stage ?? 'consult') as PresalesRow['stage'],
      handoff_status: normalizeHandoffStatus(row.handoff_status) as 'pending' | 'with_solution',
      handed_off_at: String(row.handed_off_at ?? ''),
      solution_owner_staff_id:
        row.solution_owner_staff_id != null ? Number(row.solution_owner_staff_id) : null,
      solution_owner_name: String(row.solution_owner_name ?? ''),
      owner_id: row.owner_id != null ? Number(row.owner_id) : null,
      owner_name: String(row.owner_name ?? ''),
    }));
  }
}

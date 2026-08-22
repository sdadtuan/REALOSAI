import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import { sanitizePgBigintUserId } from '../staff-auth/staff-user-id.util';
import {
  careStatusLabel,
  normalizeCareContactType,
  normalizeCareReportStatus,
} from './care-status.util';
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
import { resolveLeadFlowKindFromFunnelRow } from './lead-flow-kind.util';
import { buildB2bListScopeClause } from './lead-flow-list-filter.util';
import type { B2bListScope } from '../b2b-projects/b2b-lead-scope.service';
import {
  CompleteCareStageBody,
  LeadFunnelRow,
  LeadFunnelSnapshot,
  PatchMarketingPlanBody,
  PatchPresalesTaskBody,
  PRESALES_STAGES,
  PresalesHandoffView,
  PresalesRow,
  PresalesSnapshot,
  PresalesTaskRow,
  ReleaseReviewQueueBody,
  SolutionQueueRow,
} from './leads-funnel.types';
import {
  consultAdvanceBlockReason,
  validatePresalesConsultAdvance,
} from './presales-consult-gate.util';
import {
  blocksDirectProposalAdvance,
  normalizeHandoffStatus,
} from './presales-solution-handoff.util';
import {
  defaultStrategyJson,
  planContentFromRow,
  validatePreliminaryPlan,
} from './presales-marketing-plan.util';
import { SOLUTION_HANDOFF_ACTIVITY_TYPES } from './presales-solution-handoff-activity.util';
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
import { repairPresalesLeadTasksFromLatestGoIntake } from '../intake/intake-presales-sync.util';
import type { IntakeSessionRow } from '../intake/intake.types';
import {
  pickLatestCompletedIntake,
  prefillPresalesConsultTaskForm,
} from './presales-consult-prefill.util';
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
  loadPresalesFunnelMetricsPg,
  type PresalesFunnelMetricsPayload,
  type PresalesFunnelMetricsQuery,
} from './presales-funnel-metrics-load.pg.util';
import {
  DEFAULT_B2_CONTACT_DEADLINE_HOURS,
  isLeadInReviewQueue,
  normalizeB2ContactDeadlineHours,
  REVIEW_QUEUE_REASON,
  reviewQueuePublicState,
} from './review-queue.util';

type PgPresalesRow = {
  id: string;
  lead_id: string;
  service_slug: string;
  stage: string;
  status: string;
  assigned_am: string | null;
  lifecycle_id: string | null;
  stage_entered_at: Date | string | null;
  notes: string;
  draft_marketing_plan_id: string | null;
  l2_docs_json?: unknown;
  consult_entered_at?: Date | string | null;
  proposal_entered_at?: Date | string | null;
  handoff_status?: string | null;
  handed_off_at?: Date | string | null;
  handed_off_by_staff_id?: string | null;
  solution_owner_staff_id?: string | null;
  solution_claimed_at?: Date | string | null;
  solution_released_at?: Date | string | null;
};

@Injectable()
export class LeadsFunnelPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  private ts(): string {
    return catalogTs();
  }

  private async assertActiveStaffOwner(ownerId: number): Promise<void> {
    if (!Number.isFinite(ownerId) || ownerId <= 0) {
      throw new Error('AM không hợp lệ hoặc đã ngưng.');
    }
    const result = await this.db.query(
      `SELECT 1 AS ok FROM crm_lead_assignment_log WHERE to_owner_id = $1
       UNION ALL
       SELECT 1 FROM crm_leads WHERE owner_id = $1
       LIMIT 1`,
      [ownerId],
    );
    if (!result.rows.length) {
      throw new Error('AM không hợp lệ hoặc đã ngưng.');
    }
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  private mapPresalesRow(row: PgPresalesRow): PresalesRow {
    return {
      id: Number(row.id),
      lead_id: Number(row.lead_id),
      service_slug: String(row.service_slug ?? ''),
      stage: String(row.stage ?? 'lead') as PresalesRow['stage'],
      status: String(row.status ?? 'active'),
      assigned_am: row.assigned_am != null ? Number(row.assigned_am) : null,
      lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
      stage_entered_at: row.stage_entered_at ? String(row.stage_entered_at) : '',
      consult_entered_at: row.consult_entered_at ? String(row.consult_entered_at) : '',
      proposal_entered_at: row.proposal_entered_at ? String(row.proposal_entered_at) : '',
      notes: String(row.notes ?? ''),
      draft_marketing_plan_id:
        row.draft_marketing_plan_id != null ? Number(row.draft_marketing_plan_id) : null,
      l2_docs_json: parsePresalesL2DocsJson(row.l2_docs_json ?? {}),
      handoff_status: normalizeHandoffStatus(row.handoff_status),
      handed_off_at: row.handed_off_at ? String(row.handed_off_at) : '',
      handed_off_by_staff_id:
        row.handed_off_by_staff_id != null ? Number(row.handed_off_by_staff_id) : null,
      solution_owner_staff_id:
        row.solution_owner_staff_id != null ? Number(row.solution_owner_staff_id) : null,
      solution_claimed_at: row.solution_claimed_at ? String(row.solution_claimed_at) : '',
      solution_released_at: row.solution_released_at ? String(row.solution_released_at) : '',
    };
  }

  private async staffNameById(staffId: number | null): Promise<string> {
    if (staffId == null || staffId <= 0) return '';
    const result = await this.db.query(`SELECT name FROM crm_staff WHERE id = $1 LIMIT 1`, [staffId]);
    return String(result.rows[0]?.name ?? '').trim();
  }

  async buildHandoffView(ps: PresalesRow): Promise<PresalesHandoffView> {
    return {
      status: ps.handoff_status,
      handed_off_at: ps.handed_off_at,
      handed_off_by_staff_id: ps.handed_off_by_staff_id,
      solution_owner_staff_id: ps.solution_owner_staff_id,
      solution_owner_name: await this.staffNameById(ps.solution_owner_staff_id),
      solution_claimed_at: ps.solution_claimed_at,
      solution_released_at: ps.solution_released_at,
    };
  }

  async fetchLeadRow(leadId: number): Promise<LeadFunnelRow | null> {
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS id, l.full_name, l.phone, l.email, l.status, l.source, l.owner_id,
              COALESCE(l.agency_client_id::text, '') AS client_id,
              COALESCE(l.channel, '') AS channel,
              l.meta_json::text AS meta_json,
              COALESCE(l.care_stage_current, 'first_contact') AS care_stage_current,
              COALESCE(l.care_stages_done_json, '{}'::jsonb)::text AS care_stages_done_json,
              CASE WHEN l.is_duplicate THEN 1 ELSE 0 END AS is_duplicate,
              COALESCE(l.updated_at::text, '') AS updated_at,
              COALESCE(l.first_assigned_at::text, (
                SELECT al.created_at::text FROM crm_lead_assignment_log al
                WHERE al.sqlite_lead_id = l.sqlite_lead_id AND al.to_owner_id IS NOT NULL
                ORDER BY al.created_at ASC LIMIT 1
              ), '') AS first_assigned_at
       FROM crm_leads l
       WHERE l.sqlite_lead_id = $1`,
      [leadId],
    );
    const row = result.rows[0] as LeadFunnelRow | undefined;
    return row ?? null;
  }

  async hasB2ContactOkReport(leadId: number, stageKey = 'first_contact'): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM crm_lead_activities
       WHERE lead_id = $1 AND care_stage_key = $2 AND activity_type != 'system'
         AND trim(COALESCE(care_status, '')) = $3
       LIMIT 1`,
      [leadId, stageKey, CONTACT_OK_CARE_STATUS],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async fetchB2CareAttemptStats(leadId: number): Promise<{
    negative_count: number;
    last_status: string | null;
  }> {
    const countResult = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM crm_lead_activities
       WHERE lead_id = $1 AND care_stage_key = 'first_contact' AND activity_type != 'system'
         AND trim(COALESCE(care_status, '')) != ''
         AND trim(care_status) != $2`,
      [leadId, CONTACT_OK_CARE_STATUS],
    );
    const lastResult = await this.db.query(
      `SELECT trim(care_status) AS care_status FROM crm_lead_activities
       WHERE lead_id = $1 AND care_stage_key = 'first_contact' AND activity_type != 'system'
         AND trim(COALESCE(care_status, '')) != ''
       ORDER BY created_at DESC
       LIMIT 1`,
      [leadId],
    );
    const lastStatus = String(lastResult.rows[0]?.care_status ?? '').trim() || null;
    return {
      negative_count: Number(countResult.rows[0]?.c ?? 0),
      last_status: lastStatus,
    };
  }

  async buildSnapshot(leadId: number, presalesEnabled: boolean): Promise<LeadFunnelSnapshot | null> {
    const row = await this.fetchLeadRow(leadId);
    if (!row) return null;
    const meta = parseLeadMeta(row.meta_json);
    const presales = presalesEnabled ? await this.getPresalesSnapshot(leadId) : null;
    const leadFlowKind = resolveLeadFlowKindFromFunnelRow(row, Boolean(presales));
    const care = carePipelineState(row.status, row.care_stage_current, row.care_stages_done_json);
    const contactOkReported = care.all_complete || (await this.hasB2ContactOkReport(leadId));
    const attemptStats = await this.fetchB2CareAttemptStats(leadId);
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

  async isLeadInReviewQueue(leadId: number): Promise<boolean> {
    const row = await this.fetchLeadRow(leadId);
    if (!row) return false;
    return isLeadInReviewQueue(parseLeadMeta(row.meta_json));
  }

  async listReviewQueueLeadIds(): Promise<number[]> {
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS id FROM crm_leads l
       WHERE COALESCE(l.meta_json->'review_queue'->>'active', '') = 'true'
         AND l.is_duplicate IS NOT TRUE`,
    );
    return result.rows.map((r) => Number((r as { id: string | number }).id));
  }

  async assertNotInReviewQueue(leadId: number): Promise<void> {
    if (await this.isLeadInReviewQueue(leadId)) {
      throw new Error('Lead đang ở danh mục Phải tra soát — chỉ GDKD được xử lý.');
    }
  }

  async fetchLeadConfig(): Promise<{ b2_review_queue_enabled: boolean; b2_contact_deadline_hours: number }> {
    const result = await this.db.query(
      `SELECT config_json FROM crm_lead_settings WHERE config_key = 'global' LIMIT 1`,
    );
    const row = result.rows[0] as { config_json: Record<string, unknown> } | undefined;
    const cfg = row?.config_json ?? {};
    return {
      b2_review_queue_enabled: cfg.b2_review_queue_enabled !== false,
      b2_contact_deadline_hours: normalizeB2ContactDeadlineHours(
        cfg.b2_contact_deadline_hours ?? DEFAULT_B2_CONTACT_DEADLINE_HOURS,
      ),
    };
  }

  async submitCareReport(
    leadId: number,
    body: CompleteCareStageBody,
    actor: string,
    userId: number | null,
  ): Promise<void> {
    await this.assertNotInReviewQueue(leadId);
    const row = await this.fetchLeadRow(leadId);
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
    const safeUserId = sanitizePgBigintUserId(userId);
    await this.db.query(
      `INSERT INTO crm_lead_activities (
         lead_id, user_id, activity_type, content, result,
         next_action, next_action_at, created_at, created_by,
         lead_status_at_log, care_status, care_stage_key, care_contact_type
       ) VALUES ($1, $2, 'call', $3, '', '', NULL, NOW(), $4, $5, $6, $7, $8)`,
      [
        leadId,
        safeUserId,
        String(body.content || 'Báo cáo chăm sóc B2').slice(0, 8000),
        actor.slice(0, 120),
        row.status,
        careStatus,
        stageKey,
        contactType.slice(0, 80),
      ],
    );
    await this.db.query(
      `UPDATE crm_leads SET updated_at = NOW(), updated_by = $2 WHERE sqlite_lead_id = $1`,
      [leadId, actor.slice(0, 120)],
    );
  }

  async completeCareStage(
    leadId: number,
    body: CompleteCareStageBody,
    actor: string,
  ): Promise<LeadFunnelRow> {
    await this.assertNotInReviewQueue(leadId);
    const row = await this.fetchLeadRow(leadId);
    if (!row) throw new Error('Không tìm thấy lead.');
    const key = String(body.stage || 'first_contact').trim();
    if (!CARE_STAGE_KEYS.includes(key)) throw new Error('Bước chăm sóc không hợp lệ.');
    let current = String(row.care_stage_current || '').trim();
    if (!CARE_STAGE_KEYS.includes(current)) current = 'first_contact';
    if (key !== current) throw new Error('Chỉ có thể hoàn thành bước đang thực hiện.');

    const reportCount = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM crm_lead_activities
       WHERE lead_id = $1 AND care_stage_key = $2 AND activity_type != 'system'
         AND (trim(COALESCE(care_status, '')) != '' OR trim(COALESCE(care_contact_type, '')) != '')`,
      [leadId, key],
    );
    if (Number(reportCount.rows[0]?.c ?? 0) < 1) {
      throw new Error('Phải gửi ít nhất một báo cáo chăm sóc cho bước này trước khi hoàn thành.');
    }

    const okRow = await this.db.query(
      `SELECT 1 FROM crm_lead_activities
       WHERE lead_id = $1 AND care_stage_key = $2 AND activity_type != 'system'
         AND trim(COALESCE(care_status, '')) = $3
       LIMIT 1`,
      [leadId, key, CONTACT_OK_CARE_STATUS],
    );
    if (!okRow.rows[0]) {
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

    const done = JSON.parse(row.care_stages_done_json || '{}') as Record<string, string>;
    done[key] = this.ts();
    const stageMeta = CARE_PIPELINE_STAGES.find((s) => s.key === key)!;

    await this.db.query(
      `INSERT INTO crm_lead_activities (lead_id, activity_type, content, created_at, created_by, lead_status_at_log)
       VALUES ($1, 'system', $2, NOW(), $3, $4)`,
      [
        leadId,
        `Hoàn thành bước: ${stageMeta.label}. Ghi chú: ${noteClean}`.slice(0, 8000),
        actor.slice(0, 120),
        row.status,
      ],
    );
    await this.db.query(
      `UPDATE crm_leads
       SET care_stage_current = $2,
           care_stages_done_json = $3::jsonb,
           status = $4,
           updated_at = NOW(),
           updated_by = $5
       WHERE sqlite_lead_id = $1`,
      [leadId, key, serializeStagesDone(done), stageMeta.status_on_complete, actor.slice(0, 120)],
    );

    const updated = await this.fetchLeadRow(leadId);
    if (!updated) throw new Error('Không tìm thấy lead.');
    return updated;
  }

  async countReviewQueue(b2bListScope?: B2bListScope): Promise<number> {
    const scopeParts = this.reviewQueueB2bScopeSql(b2bListScope, 1);
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM crm_leads l
       WHERE COALESCE(l.meta_json->'review_queue'->>'active', '') = 'true'
         AND l.is_duplicate IS NOT TRUE${scopeParts.sql}`,
      scopeParts.params,
    );
    return Number(result.rows[0]?.c ?? 0);
  }

  private reviewQueueB2bScopeSql(
    b2bListScope: B2bListScope | undefined,
    paramStart: number,
  ): { sql: string; params: unknown[] } {
    if (!b2bListScope) return { sql: '', params: [] };
    const staffParam = `$${paramStart}`;
    const clause = buildB2bListScopeClause('postgres', 'l', b2bListScope, staffParam);
    if (!clause) return { sql: '', params: [] };
    return { sql: ` AND ${clause}`, params: [b2bListScope.staffId] };
  }

  async listReviewQueue(limit = 50, b2bListScope?: B2bListScope): Promise<LeadFunnelRow[]> {
    const lim = Math.max(1, Math.min(limit, 200));
    const scopeParts = this.reviewQueueB2bScopeSql(b2bListScope, 2);
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS id, l.full_name, l.phone, l.email, l.status, l.owner_id,
              l.meta_json::text AS meta_json,
              COALESCE(l.care_stage_current, 'first_contact') AS care_stage_current,
              COALESCE(l.care_stages_done_json, '{}'::jsonb)::text AS care_stages_done_json,
              CASE WHEN l.is_duplicate THEN 1 ELSE 0 END AS is_duplicate,
              COALESCE(l.updated_at::text, '') AS updated_at,
              COALESCE(l.meta_json->'review_queue'->>'assigned_at', '') AS first_assigned_at
       FROM crm_leads l
       WHERE COALESCE(l.meta_json->'review_queue'->>'active', '') = 'true'
         AND l.is_duplicate IS NOT TRUE${scopeParts.sql}
       ORDER BY l.meta_json->'review_queue'->>'queued_at' DESC NULLS LAST, l.sqlite_lead_id DESC
       LIMIT $1`,
      [lim, ...scopeParts.params],
    );
    return result.rows as LeadFunnelRow[];
  }

  async syncReviewQueue(actor: string, dryRun = false): Promise<Record<string, unknown>> {
    const cfg = await this.fetchLeadConfig();
    if (!cfg.b2_review_queue_enabled) {
      return { enabled: false, queued: 0, scanned: 0, deadline_hours: cfg.b2_contact_deadline_hours };
    }

    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS id, l.full_name, l.phone, l.email, l.status, l.owner_id,
              l.meta_json::text AS meta_json,
              COALESCE(l.care_stage_current, 'first_contact') AS care_stage_current,
              COALESCE(l.care_stages_done_json, '{}'::jsonb)::text AS care_stages_done_json,
              CASE WHEN l.is_duplicate THEN 1 ELSE 0 END AS is_duplicate,
              COALESCE(l.updated_at::text, '') AS updated_at,
              COALESCE(l.first_assigned_at::text, (
                SELECT al.created_at::text FROM crm_lead_assignment_log al
                WHERE al.sqlite_lead_id = l.sqlite_lead_id AND al.to_owner_id IS NOT NULL
                ORDER BY al.created_at ASC LIMIT 1
              ), '') AS first_assigned_at
       FROM crm_leads l
       WHERE l.owner_id IS NOT NULL
         AND l.is_duplicate IS NOT TRUE
         AND l.status NOT IN ('lost')
         AND COALESCE(l.meta_json->'review_queue'->>'active', '') != 'true'
         AND COALESCE(l.care_stages_done_json->>'first_contact', '') = ''`,
    );
    const rows = result.rows as LeadFunnelRow[];

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
      await this.queueLeadForReview(row.id, {
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

  private async queueLeadForReview(
    leadId: number,
    opts: {
      actor: string;
      previousOwnerId: number | null;
      assignedAt: string;
      deadlineHours: number;
    },
  ): Promise<void> {
    const row = await this.fetchLeadRow(leadId);
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
    await this.db.query(
      `UPDATE crm_leads
       SET owner_id = NULL, meta_json = $2::jsonb, updated_at = NOW(), updated_by = $3
       WHERE sqlite_lead_id = $1`,
      [leadId, JSON.stringify(meta), opts.actor.slice(0, 120)],
    );
    if (opts.previousOwnerId) {
      await this.db.query(
        `INSERT INTO crm_lead_assignment_log
           (sqlite_lead_id, from_owner_id, to_owner_id, reason, assigned_by, created_at)
         VALUES ($1, $2, NULL, $3, $4, NOW())`,
        [
          leadId,
          opts.previousOwnerId,
          'Quá hạn B2 — chuyển Lead Phải tra soát (GDKD)',
          opts.actor.slice(0, 120),
        ],
      );
    }
  }

  async releaseFromReviewQueue(
    leadId: number,
    body: ReleaseReviewQueueBody,
    actor: string,
  ): Promise<{ row: LeadFunnelRow; targetOwner: number; fromOwnerId: number | null }> {
    const row = await this.fetchLeadRow(leadId);
    if (!row) throw new Error('Không tìm thấy lead.');
    const fromOwnerId = row.owner_id != null ? Number(row.owner_id) : null;
    const meta = parseLeadMeta(row.meta_json);
    const rq = meta.review_queue as Record<string, unknown> | undefined;
    if (!rq?.active) throw new Error('Lead không ở danh mục Phải tra soát.');
    const mode = String(body.mode || '').trim().toLowerCase();
    if (mode !== 'auto' && mode !== 'manual') throw new Error('mode phải là auto hoặc manual.');

    let targetOwner: number | null = null;
    if (mode === 'manual') {
      if (!body.owner_id) throw new Error('Chọn AM để gán lại.');
      await this.assertActiveStaffOwner(Number(body.owner_id));
      targetOwner = Number(body.owner_id);
    } else {
      const prev = rq.previous_owner_id ? Number(rq.previous_owner_id) : null;
      if (prev) {
        try {
          await this.assertActiveStaffOwner(prev);
          targetOwner = prev;
        } catch {
          targetOwner = null;
        }
      }
      if (!targetOwner) throw new Error('Không tìm được AM để gán lại (auto).');
    }

    delete meta.review_queue;
    await this.db.query(
      `UPDATE crm_leads
       SET owner_id = $2, meta_json = $3::jsonb, updated_at = NOW(), updated_by = $4
       WHERE sqlite_lead_id = $1`,
      [leadId, targetOwner, JSON.stringify(meta), actor.slice(0, 120)],
    );
    await this.db.query(
      `INSERT INTO crm_lead_assignment_log
         (sqlite_lead_id, from_owner_id, to_owner_id, reason, assigned_by, created_at)
       VALUES ($1, NULL, $2, $3, $4, NOW())`,
      [
        leadId,
        targetOwner,
        String(body.note || 'GDKD release từ Phải tra soát').slice(0, 500),
        actor.slice(0, 120),
      ],
    );

    const updated = await this.fetchLeadRow(leadId);
    if (!updated) throw new Error('Không tìm thấy lead.');
    return { row: updated, targetOwner, fromOwnerId };
  }

  async getPresalesRowByLeadId(leadId: number): Promise<PresalesRow | null> {
    const result = await this.db.query(`SELECT * FROM crm_lead_presales WHERE lead_id = $1`, [leadId]);
    const row = result.rows[0] as PgPresalesRow | undefined;
    return row ? this.mapPresalesRow(row) : null;
  }

  async getPresalesSnapshot(leadId: number): Promise<PresalesSnapshot | null> {
    const psResult = await this.db.query(`SELECT * FROM crm_lead_presales WHERE lead_id = $1`, [leadId]);
    const psRow = psResult.rows[0] as PgPresalesRow | undefined;
    if (!psRow) return null;
    const ps = this.mapPresalesRow(psRow);

    const taskResult = await this.db.query(
      `SELECT * FROM crm_lead_presales_tasks
       WHERE presales_id = $1
       ORDER BY stage, step_index, id`,
      [ps.id],
    );
    const tasks: Record<string, PresalesTaskRow[]> = {};
    for (const raw of taskResult.rows as Array<Record<string, unknown>>) {
      const stage = String(raw.stage);
      const task: PresalesTaskRow = {
        id: Number(raw.id),
        presales_id: Number(raw.presales_id),
        stage,
        step_index: Number(raw.step_index),
        title: String(raw.title),
        description: String(raw.description),
        form_fields: Array.isArray(raw.form_fields)
          ? (raw.form_fields as unknown[])
          : (JSON.parse(String(raw.form_fields ?? '[]')) as unknown[]),
        form_data:
          typeof raw.form_data === 'object' && raw.form_data !== null
            ? (raw.form_data as Record<string, unknown>)
            : (JSON.parse(String(raw.form_data ?? '{}')) as Record<string, unknown>),
        ai_prompt_key: String(raw.ai_prompt_key ?? ''),
        ai_output: String(raw.ai_output ?? ''),
        is_done: Boolean(raw.is_done),
        done_at: raw.done_at ? String(raw.done_at) : '',
        notes: String(raw.notes ?? ''),
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
    const nextStage =
      currentIdx >= 0 && currentIdx < PRESALES_STAGES.length - 1
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
      const gate = await this.buildConsultAdvanceGate(leadId, ps.id);
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
        const plan = await this.getPreliminaryPlan(ps.id);
        const val = validatePreliminaryPlan(plan);
        if (!val.ok) blockReason = val.messages[0] || 'KH MKT sơ bộ chưa đủ';
        else canAdvance = true;
      }
    } else {
      canAdvance = true;
    }

    return {
      presales: ps,
      handoff: await this.buildHandoffView(ps),
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

  async buildConsultAdvanceGate(leadId: number, presalesId: number) {
    const sessionResult = await this.db.query(
      `SELECT status, mode, decision, bant_total FROM crm_lead_intake_sessions
       WHERE lead_id = $1
       ORDER BY updated_at DESC, id DESC
       LIMIT 20`,
      [leadId],
    );
    const sessions = sessionResult.rows as Array<{
      status: string;
      mode: string;
      decision: string;
      bant_total: number;
    }>;
    const taskResult = await this.db.query(
      `SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN is_done THEN 1 ELSE 0 END)::int AS done
       FROM crm_lead_presales_tasks
       WHERE presales_id = $1 AND stage = 'lead'`,
      [presalesId],
    );
    let leadTasks = taskResult.rows[0] as { total: number; done: number | null };
    let leadTaskDone =
      Number(leadTasks.total) === 0 || Number(leadTasks.done ?? 0) >= Number(leadTasks.total);

    if (!leadTaskDone) {
      await repairPresalesLeadTasksFromLatestGoIntake(this.db, leadId);
      const retry = await this.db.query(
        `SELECT COUNT(*)::int AS total,
                SUM(CASE WHEN is_done THEN 1 ELSE 0 END)::int AS done
         FROM crm_lead_presales_tasks
         WHERE presales_id = $1 AND stage = 'lead'`,
        [presalesId],
      );
      leadTasks = retry.rows[0] as { total: number; done: number | null };
      leadTaskDone =
        Number(leadTasks.total) === 0 || Number(leadTasks.done ?? 0) >= Number(leadTasks.total);
    }

    return validatePresalesConsultAdvance({ leadTaskDone, sessions });
  }

  async ensurePresales(leadId: number, serviceSlug: string, actor: string): Promise<PresalesRow> {
    const row = (await this.fetchLeadRow(leadId)) ?? null;
    if (!row) throw new Error('Không tìm thấy lead.');
    assertPresalesCareGate(row.care_stage_current, row.care_stages_done_json);
    const slug = String(serviceSlug || '').trim();
    if (!slug) throw new Error('Cần service_slug để tạo pre-sales');

    const existing = await this.getPresalesRowByLeadId(leadId);
    if (existing) {
      if (existing.status === 'converted') return existing;
      await this.seedPresalesTasks(existing.id, slug);
      return existing;
    }

    const ownerId = row.owner_id;
    const insert = await this.db.query(
      `INSERT INTO crm_lead_presales
         (lead_id, service_slug, stage, status, assigned_am, stage_entered_at, notes, created_at, updated_at)
       VALUES ($1, $2, 'lead', 'active', $3, NOW(), $4, NOW(), NOW())
       RETURNING *`,
      [leadId, slug, ownerId, `Pre-sales tạo bởi ${actor}`.slice(0, 4000)],
    );
    const ps = this.mapPresalesRow(insert.rows[0] as PgPresalesRow);
    await this.seedPresalesTasks(ps.id, slug);
    return ps;
  }

  private async seedPresalesTasks(presalesId: number, serviceSlug: string): Promise<void> {
    const countResult = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM crm_lead_presales_tasks WHERE presales_id = $1 AND is_custom = FALSE`,
      [presalesId],
    );
    if (Number(countResult.rows[0]?.c ?? 0) > 0) return;

    const steps = workflowStepsForService(serviceSlug);
    for (const stage of PRESALES_STAGES) {
      const stageSteps = steps[stage] || [];
      for (let idx = 0; idx < stageSteps.length; idx += 1) {
        const step = stageSteps[idx];
        await this.db.query(
          `INSERT INTO crm_lead_presales_tasks
             (presales_id, stage, step_index, title, description, ai_prompt_key, form_fields, form_data,
              is_done, is_custom, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, '{}'::jsonb, FALSE, FALSE, NOW(), NOW())`,
          [
            presalesId,
            stage,
            idx,
            step.title,
            step.description,
            step.ai_prompt_key || '',
            JSON.stringify(step.form_fields || []),
          ],
        );
      }
    }
  }

  async getLeadConvertedCustomerId(leadId: number): Promise<number | null> {
    const result = await this.db.query(
      `SELECT converted_customer_id FROM crm_leads WHERE sqlite_lead_id = $1 LIMIT 1`,
      [leadId],
    );
    const raw = result.rows[0] as { converted_customer_id: number | null } | undefined;
    const id = Number(raw?.converted_customer_id ?? 0);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  async getPresalesTaskById(taskId: number): Promise<PresalesTaskRow | null> {
    const result = await this.db.query(`SELECT * FROM crm_lead_presales_tasks WHERE id = $1 LIMIT 1`, [
      taskId,
    ]);
    const raw = result.rows[0] as Record<string, unknown> | undefined;
    if (!raw) return null;
    return {
      id: Number(raw.id),
      presales_id: Number(raw.presales_id),
      stage: String(raw.stage),
      step_index: Number(raw.step_index),
      title: String(raw.title),
      description: String(raw.description),
      form_fields: Array.isArray(raw.form_fields)
        ? (raw.form_fields as unknown[])
        : (JSON.parse(String(raw.form_fields ?? '[]')) as unknown[]),
      form_data:
        typeof raw.form_data === 'object' && raw.form_data !== null
          ? (raw.form_data as Record<string, unknown>)
          : (JSON.parse(String(raw.form_data ?? '{}')) as Record<string, unknown>),
      ai_prompt_key: String(raw.ai_prompt_key ?? ''),
      ai_output: String(raw.ai_output ?? ''),
      is_done: Boolean(raw.is_done),
      done_at: raw.done_at ? String(raw.done_at) : '',
      notes: String(raw.notes ?? ''),
    };
  }

  async updatePresalesTaskAiOutput(taskId: number, aiOutput: string): Promise<void> {
    await this.db.query(
      `UPDATE crm_lead_presales_tasks SET ai_output = $2, updated_at = NOW() WHERE id = $1`,
      [taskId, aiOutput.slice(0, 16000)],
    );
  }

  async runPresalesConsultPrefill(
    leadId: number,
    overwrite = false,
  ): Promise<{ task_id: number | null; filled: number; fields: string[]; skipped_existing: string[] }> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    const consultTasks = snap.tasks.consult ?? [];
    const leadTasks = snap.tasks.lead ?? [];
    if (consultTasks.length === 0) throw new Error('Chưa có task Consult');

    const intakeResult = await this.db.query(
      `SELECT * FROM crm_lead_intake_sessions WHERE lead_id = $1 ORDER BY updated_at DESC, id DESC LIMIT 20`,
      [leadId],
    );
    const sessions = intakeResult.rows as IntakeSessionRow[];
    const latest = pickLatestCompletedIntake(sessions);
    const out = prefillPresalesConsultTaskForm({
      serviceSlug: snap.presales.service_slug,
      consultTask: consultTasks[0]!,
      leadTask: leadTasks[0] ?? null,
      latestIntake: latest,
      overwrite,
    });
    if (out.filled.length > 0 || out.notes !== consultTasks[0]!.notes) {
      await this.updatePresalesTask(
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

  async listPresalesWorkflowUpgradeCohort(opts?: {
    leadIds?: number[];
    limit?: number;
  }): Promise<PresalesWorkflowUpgradeCohortRow[]> {
    const params: unknown[] = [PRESALES_UPGRADE_CONSULT_FIELD_MIN];
    let leadFilter = '';
    if (opts?.leadIds?.length) {
      const ids = capBatchLeadIds(opts.leadIds, opts.limit);
      params.push(ids);
      leadFilter = ` AND ps.lead_id = ANY($${params.length}::bigint[])`;
    }
    const rowLimit = opts?.leadIds?.length
      ? capBatchLeadIds(opts.leadIds, opts.limit).length
      : Math.min(PRESALES_BATCH_UPGRADE_MAX, opts?.limit ?? PRESALES_BATCH_UPGRADE_MAX);
    params.push(rowLimit);

    const result = await this.db.query(
      `SELECT ps.lead_id, ps.id AS presales_id, ps.service_slug, ps.stage,
              COALESCE(
                (
                  SELECT jsonb_agg(f->>'key' ORDER BY f->>'key')
                  FROM crm_lead_presales_tasks t,
                       jsonb_array_elements(COALESCE(t.form_fields, '[]'::jsonb)) f
                  WHERE t.presales_id = ps.id AND t.stage = 'consult' AND t.is_custom = FALSE
                ),
                '[]'::jsonb
              ) AS consult_field_keys
       FROM crm_lead_presales ps
       WHERE ps.status = 'active'
         AND ps.stage IN ('lead', 'consult', 'proposal')
         AND EXISTS (
           SELECT 1 FROM crm_lead_presales_tasks t
           WHERE t.presales_id = ps.id
             AND t.stage = 'consult'
             AND t.is_custom = FALSE
             AND jsonb_array_length(COALESCE(t.form_fields, '[]'::jsonb)) < $1
         )
         ${leadFilter}
       ORDER BY ps.updated_at DESC
       LIMIT $${params.length}`,
      params,
    );

    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
      lead_id: Number(row.lead_id),
      presales_id: Number(row.presales_id),
      service_slug: String(row.service_slug ?? ''),
      stage: String(row.stage ?? ''),
      consult_field_keys: Array.isArray(row.consult_field_keys)
        ? (row.consult_field_keys as string[])
        : [],
    }));
  }

  async upgradePresalesWorkflowTemplate(
    leadId: number,
    opts: { stages?: string[]; dryRun?: boolean; prefillConsult?: boolean },
  ): Promise<{
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
  }> {
    const snap = await this.getPresalesSnapshot(leadId);
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

    if (!opts.dryRun) {
      for (const stage of stages) {
        const stageSteps = steps[stage] ?? [];
        const oldTasks = snap.tasks[stage] ?? [];
        const newKeys = stageSteps.flatMap((s) => (s.form_fields ?? []).map((f) => f.key));
        const { form_data, is_done } = mergeLegacyPresalesFormData(oldTasks, newKeys);

        const del = await this.db.query(
          `DELETE FROM crm_lead_presales_tasks
           WHERE presales_id = $1 AND stage = $2 AND is_custom = FALSE
           RETURNING id`,
          [snap.presales.id, stage],
        );
        let inserted = 0;
        for (let idx = 0; idx < stageSteps.length; idx += 1) {
          const step = stageSteps[idx]!;
          await this.db.query(
            `INSERT INTO crm_lead_presales_tasks
               (presales_id, stage, step_index, title, description, ai_prompt_key, form_fields, form_data,
                is_done, is_custom, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, FALSE, NOW(), NOW())`,
            [
              snap.presales.id,
              stage,
              idx,
              step.title,
              step.description,
              step.ai_prompt_key || '',
              JSON.stringify(step.form_fields || []),
              JSON.stringify(form_data),
              is_done,
            ],
          );
          inserted += 1;
        }
        stageResults.push({
          stage,
          deleted: del.rowCount ?? oldTasks.length,
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
      const pf = await this.runPresalesConsultPrefill(leadId, false);
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

  async getPresalesFunnelMetrics(
    query: PresalesFunnelMetricsQuery,
  ): Promise<PresalesFunnelMetricsPayload> {
    return loadPresalesFunnelMetricsPg(this.db, query);
  }

  async getPresalesConsultSlaSummary(amId?: number | null): Promise<PresalesConsultSlaSummary> {
    const params: unknown[] = [];
    let amFilter = '';
    if (amId != null && Number.isFinite(amId) && amId > 0) {
      amFilter = ' AND COALESCE(ps.assigned_am, l.owner_id) = $1';
      params.push(amId);
    }

    const activeResult = await this.db.query(
      `SELECT ps.stage, ps.consult_entered_at, ps.stage_entered_at
       FROM crm_lead_presales ps
       INNER JOIN crm_leads l ON l.id = ps.lead_id
       WHERE ps.status = 'active' AND ps.stage = 'consult'${amFilter}`,
      params,
    );

    let slaOk = 0;
    let slaWarning = 0;
    let slaBreach = 0;
    for (const row of activeResult.rows as Array<Record<string, unknown>>) {
      const sla = buildPresalesConsultProposalSla({
        presalesStage: 'consult',
        consultEnteredAt: row.consult_entered_at ? String(row.consult_entered_at) : '',
        stageEnteredAt: row.stage_entered_at ? String(row.stage_entered_at) : '',
      });
      if (sla.sla_state === 'breach') slaBreach += 1;
      else if (sla.sla_state === 'warning') slaWarning += 1;
      else if (sla.sla_state === 'ok') slaOk += 1;
    }

    const completedResult = await this.db.query(
      `SELECT ps.consult_entered_at, ps.proposal_entered_at
       FROM crm_lead_presales ps
       INNER JOIN crm_leads l ON l.id = ps.lead_id
       WHERE ps.consult_entered_at IS NOT NULL
         AND ps.proposal_entered_at IS NOT NULL
         AND ps.consult_entered_at::text != ''
         AND ps.proposal_entered_at::text != ''${amFilter}`,
      params,
    );

    let within48 = 0;
    for (const row of completedResult.rows as Array<Record<string, unknown>>) {
      if (
        isConsultToProposalWithin48h(
          row.consult_entered_at ? String(row.consult_entered_at) : '',
          row.proposal_entered_at ? String(row.proposal_entered_at) : '',
        )
      ) {
        within48 += 1;
      }
    }
    const denom = completedResult.rows.length;
    return {
      active_consult: activeResult.rows.length,
      sla_ok: slaOk,
      sla_warning: slaWarning,
      sla_breach: slaBreach,
      consult_to_proposal_48h_pct: denom > 0 ? Math.round((within48 / denom) * 1000) / 10 : 0,
      consult_to_proposal_48h_num: within48,
      consult_to_proposal_48h_denom: denom,
    };
  }

  async updatePresalesL2Docs(leadId: number, patch: Record<string, boolean>): Promise<PresalesRow> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    const merged = mergePresalesL2DocsPatch(
      snap.presales.service_slug,
      snap.presales.l2_docs_json,
      patch,
    );
    await this.db.query(
      `UPDATE crm_lead_presales SET l2_docs_json = $2::jsonb, updated_at = NOW() WHERE id = $1`,
      [snap.presales.id, JSON.stringify(merged)],
    );
    const updated = await this.getPresalesRowByLeadId(leadId);
    if (!updated) throw new Error('Không tìm thấy pre-sales');
    return updated;
  }

  async updatePresalesTask(taskId: number, body: PatchPresalesTaskBody, doneBy: number | null): Promise<void> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (body.is_done !== undefined) {
      sets.push(`is_done = $${idx++}`);
      params.push(Boolean(body.is_done));
      sets.push(`done_at = $${idx++}`);
      params.push(body.is_done ? new Date().toISOString() : null);
      if (doneBy != null) {
        sets.push(`done_by = $${idx++}`);
        params.push(doneBy);
      }
    }
    if (body.notes !== undefined) {
      sets.push(`notes = $${idx++}`);
      params.push(String(body.notes).slice(0, 4000));
    }
    if (body.form_data !== undefined) {
      sets.push(`form_data = $${idx++}::jsonb`);
      params.push(JSON.stringify(body.form_data));
    }
    params.push(taskId);
    await this.db.query(
      `UPDATE crm_lead_presales_tasks SET ${sets.join(', ')} WHERE id = $${idx}`,
      params,
    );
  }

  async advancePresales(
    leadId: number,
    opts: { confirm?: boolean; overrideReason?: string; allowOverride?: boolean } = {},
  ): Promise<PresalesRow> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (!snap.advance.next_stage) {
      throw new Error(snap.advance.block_reason || 'Không thể chuyển giai đoạn');
    }
    if (snap.advance.next_stage === 'consult' && snap.advance.current_stage === 'lead') {
      const gate = await this.buildConsultAdvanceGate(leadId, snap.presales.id);
      const block = consultAdvanceBlockReason(gate, Boolean(opts.confirm));
      if (block) throw new Error(block);
      if (opts.overrideReason?.trim()) {
        const note = `Director override: ${opts.overrideReason.trim().slice(0, 500)}`;
        await this.db.query(
          `UPDATE crm_lead_presales SET notes = TRIM(BOTH FROM notes || E'\\n' || $2), updated_at = NOW() WHERE id = $1`,
          [snap.presales.id, note],
        );
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

    const nextStage = snap.advance.next_stage;
    const updated = await this.db.query(
      `UPDATE crm_lead_presales
       SET stage = $2,
           stage_entered_at = NOW(),
           updated_at = NOW(),
           consult_entered_at = CASE
             WHEN $2 = 'consult' AND (consult_entered_at IS NULL OR consult_entered_at = '')
             THEN NOW()
             ELSE consult_entered_at
           END,
           proposal_entered_at = CASE
             WHEN $2 = 'proposal' THEN NOW()
             ELSE proposal_entered_at
           END
       WHERE id = $1
       RETURNING *`,
      [snap.presales.id, nextStage],
    );
    let row = this.mapPresalesRow(updated.rows[0] as PgPresalesRow);
    if (nextStage === 'proposal' && !row.consult_entered_at && snap.presales.stage_entered_at) {
      await this.db.query(
        `UPDATE crm_lead_presales SET consult_entered_at = $2::timestamptz WHERE id = $1`,
        [snap.presales.id, snap.presales.stage_entered_at],
      );
      const fixed = await this.getPresalesRowByLeadId(leadId);
      if (fixed) row = fixed;
    }
    if (nextStage === 'consult' && snap.advance.current_stage === 'lead') {
      await this.applyPresalesConsultPrefill(leadId, snap.presales.id, snap.presales.service_slug);
    }
    return row;
  }

  private async applyPresalesConsultPrefill(
    leadId: number,
    _presalesId: number,
    _serviceSlug: string,
  ): Promise<void> {
    await this.runPresalesConsultPrefill(leadId, false);
  }

  async getPreliminaryPlan(presalesId: number): Promise<Record<string, unknown> | null> {
    const psResult = await this.db.query(
      `SELECT draft_marketing_plan_id FROM crm_lead_presales WHERE id = $1`,
      [presalesId],
    );
    const draftId = psResult.rows[0]?.draft_marketing_plan_id;
    if (draftId != null) {
      const planResult = await this.db.query(`SELECT * FROM crm_marketing_plans WHERE id = $1`, [draftId]);
      return (planResult.rows[0] as Record<string, unknown> | undefined) ?? null;
    }
    const planResult = await this.db.query(
      `SELECT * FROM crm_marketing_plans
       WHERE presales_id = $1 AND plan_kind = 'preliminary'
       ORDER BY id DESC LIMIT 1`,
      [presalesId],
    );
    return (planResult.rows[0] as Record<string, unknown> | undefined) ?? null;
  }

  async getOrCreatePreliminaryPlan(
    leadId: number,
    presalesId: number,
    serviceSlug: string,
  ): Promise<Record<string, unknown>> {
    const existing = await this.getPreliminaryPlan(presalesId);
    if (existing) return existing;
    const name = `KH MKT sơ bộ — Lead #${leadId}${serviceSlug ? ` (${serviceSlug})` : ''}`;
    const insert = await this.db.query(
      `INSERT INTO crm_marketing_plans (
         code, name, status, plan_kind, lead_id, presales_id,
         north_star, objectives, strategy_framework_json, target_market_prof_json,
         target_market_steps4_json, created_at, updated_at
       ) VALUES ($1, $2, 'draft', 'preliminary', $3, $4, '', '', $5::jsonb, '{}'::jsonb, '{}'::jsonb, NOW(), NOW())
       RETURNING *`,
      [`PS-${presalesId}-DRAFT`, name.slice(0, 200), leadId, presalesId, JSON.stringify(defaultStrategyJson())],
    );
    const plan = insert.rows[0] as Record<string, unknown>;
    await this.db.query(
      `UPDATE crm_lead_presales SET draft_marketing_plan_id = $2, updated_at = NOW() WHERE id = $1`,
      [presalesId, plan.id],
    );
    return plan;
  }

  async patchMarketingPlan(leadId: number, body: PatchMarketingPlanBody): Promise<Record<string, unknown>> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    const plan = await this.getOrCreatePreliminaryPlan(leadId, snap.presales.id, snap.presales.service_slug);
    const planId = Number(plan.id);
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
    const updated = await this.db.query(
      `UPDATE crm_marketing_plans
       SET name = $2, north_star = $3, objectives = $4,
           strategy_framework_json = $5::jsonb, target_market_prof_json = $6::jsonb, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        planId,
        content.name.slice(0, 200),
        northStar,
        objectives,
        JSON.stringify(content.strategy_framework),
        JSON.stringify(targetMarketProf),
      ],
    );
    return updated.rows[0] as Record<string, unknown>;
  }

  async markPresalesConverted(presalesId: number, lifecycleId: number, client?: PoolClient): Promise<void> {
    const q = client ?? this.db;
    await q.query(
      `UPDATE crm_lead_presales
       SET status = 'converted', lifecycle_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [presalesId, lifecycleId],
    );
  }

  async getPresalesProgress(presalesId: number): Promise<Record<string, { total: number; done: number }>> {
    const result = await this.db.query(
      `SELECT stage, is_done FROM crm_lead_presales_tasks WHERE presales_id = $1`,
      [presalesId],
    );
    const progress: Record<string, { total: number; done: number }> = {};
    for (const stage of PRESALES_STAGES) progress[stage] = { total: 0, done: 0 };
    for (const row of result.rows as Array<{ stage: string; is_done: boolean }>) {
      const stage = String(row.stage);
      if (!progress[stage]) progress[stage] = { total: 0, done: 0 };
      progress[stage].total += 1;
      if (row.is_done) progress[stage].done += 1;
    }
    return progress;
  }

  async getPresalesTasksForPromote(presalesId: number): Promise<Array<Record<string, unknown>>> {
    const result = await this.db.query(
      `SELECT * FROM crm_lead_presales_tasks WHERE presales_id = $1 ORDER BY stage, step_index, id`,
      [presalesId],
    );
    return result.rows as Array<Record<string, unknown>>;
  }

  async assertPendingTasksComplete(presalesId: number): Promise<void> {
    for (const stage of PRESALES_STAGES) {
      const result = await this.db.query(
        `SELECT COUNT(*)::int AS c FROM crm_lead_presales_tasks
         WHERE presales_id = $1 AND stage = $2 AND is_custom = FALSE AND is_done = FALSE`,
        [presalesId, stage],
      );
      if (Number(result.rows[0]?.c ?? 0) > 0) {
        throw new Error(`Chưa hoàn thành task giai đoạn ${stage}`);
      }
    }
  }

  async handoffToSolution(
    leadId: number,
    staffId: number,
    opts: { confirm?: boolean; overrideReason?: string } = {},
  ): Promise<PresalesRow> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (snap.presales.stage !== 'lead') {
      throw new Error('Chỉ giao Solution khi đang ở giai đoạn Lead.');
    }
    if (snap.presales.handoff_status === 'pending' || snap.presales.handoff_status === 'with_solution') {
      throw new Error('Lead đã được giao Solution.');
    }
    const gate = await this.buildConsultAdvanceGate(leadId, snap.presales.id);
    const block = consultAdvanceBlockReason(gate, Boolean(opts.confirm));
    if (block) throw new Error(block);
    if (opts.overrideReason?.trim()) {
      const note = `Director override handoff: ${opts.overrideReason.trim().slice(0, 500)}`;
      await this.db.query(
        `UPDATE crm_lead_presales SET notes = TRIM(BOTH FROM notes || E'\\n' || $2), updated_at = NOW() WHERE id = $1`,
        [snap.presales.id, note],
      );
    }

    const updated = await this.db.query(
      `UPDATE crm_lead_presales
       SET stage = 'consult',
           stage_entered_at = NOW(),
           updated_at = NOW(),
           consult_entered_at = CASE
             WHEN consult_entered_at IS NULL OR consult_entered_at = '' THEN NOW()
             ELSE consult_entered_at
           END,
           handoff_status = 'pending',
           handed_off_at = NOW(),
           handed_off_by_staff_id = $2
       WHERE id = $1
       RETURNING *`,
      [snap.presales.id, staffId],
    );
    await this.applyPresalesConsultPrefill(leadId, snap.presales.id, snap.presales.service_slug);
    return this.mapPresalesRow(updated.rows[0] as PgPresalesRow);
  }

  async claimSolution(leadId: number, staffId: number): Promise<PresalesRow> {
    const snap = await this.getPresalesSnapshot(leadId);
    if (!snap) throw new Error('Không tìm thấy pre-sales');
    if (snap.presales.handoff_status !== 'pending') {
      throw new Error('Lead không ở trạng thái chờ Solution nhận case.');
    }
    const updated = await this.db.query(
      `UPDATE crm_lead_presales
       SET handoff_status = 'with_solution',
           solution_owner_staff_id = $2,
           solution_claimed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [snap.presales.id, staffId],
    );
    return this.mapPresalesRow(updated.rows[0] as PgPresalesRow);
  }

  async releaseToSales(leadId: number, staffId: number): Promise<PresalesRow> {
    const snap = await this.getPresalesSnapshot(leadId);
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
    const plan = await this.getPreliminaryPlan(snap.presales.id);
    const val = validatePreliminaryPlan(plan);
    if (!val.ok) {
      throw new Error(val.messages[0] || 'KH MKT sơ bộ chưa đủ');
    }

    const updated = await this.db.query(
      `UPDATE crm_lead_presales
       SET stage = 'proposal',
           stage_entered_at = NOW(),
           updated_at = NOW(),
           proposal_entered_at = NOW(),
           handoff_status = 'released',
           solution_released_at = NOW(),
           consult_entered_at = CASE
             WHEN consult_entered_at IS NULL OR consult_entered_at = ''
             THEN COALESCE(stage_entered_at, NOW())
             ELSE consult_entered_at
           END
       WHERE id = $1
       RETURNING *`,
      [snap.presales.id],
    );
    return this.mapPresalesRow(updated.rows[0] as PgPresalesRow);
  }

  async hasSolutionHandoffActivity(leadId: number, handedOffAt?: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM crm_lead_activities
       WHERE lead_id = $1 AND activity_type = $2
       LIMIT 1`,
      [leadId, SOLUTION_HANDOFF_ACTIVITY_TYPES.handoff],
    );
    if (result.rows.length) return true;
    return Boolean(String(handedOffAt ?? '').trim());
  }

  async listSolutionQueue(
    statuses: Array<'pending' | 'with_solution'> = ['pending', 'with_solution'],
    limit = 50,
  ): Promise<SolutionQueueRow[]> {
    const lim = Math.max(1, Math.min(limit, 200));
    const allowed = statuses.filter((s) => s === 'pending' || s === 'with_solution');
    const filterStatuses = allowed.length ? allowed : ['pending', 'with_solution'];
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS lead_id, l.full_name, l.phone, l.owner_id,
              ps.service_slug, ps.stage AS presales_stage, ps.handoff_status,
              COALESCE(ps.handed_off_at::text, '') AS handed_off_at,
              ps.solution_owner_staff_id,
              COALESCE(am.name, '') AS owner_name,
              COALESCE(sol.name, '') AS solution_owner_name
       FROM crm_lead_presales ps
       INNER JOIN crm_leads l ON l.sqlite_lead_id = ps.lead_id
       LEFT JOIN crm_staff am ON am.id = l.owner_id
       LEFT JOIN crm_staff sol ON sol.id = ps.solution_owner_staff_id
       WHERE ps.status = 'active'
         AND ps.handoff_status = ANY($1::text[])
       ORDER BY ps.handed_off_at DESC NULLS LAST, ps.id DESC
       LIMIT $2`,
      [filterStatuses, lim],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
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

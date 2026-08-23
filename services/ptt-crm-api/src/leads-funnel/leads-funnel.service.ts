import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CrmLeadsLegacyService } from '../crm-leads-legacy/crm-leads-legacy.service';
import { AppConfigService } from '../config/app-config.service';
import { CrmLeadsPgRepository } from '../crm-leads-legacy/crm-leads-pg.repository';
import { CskhBoardService } from '../cskh-board/cskh-board.service';
import { parseB2CompletedAt } from '../cskh-board/cskh-board-sla.util';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { hasGdkdAssign } from '../staff-permissions/staff-gdkd.util';
import { parseLeadMeta } from './care-pipeline.util';
import {
  AdvancePresalesBody,
  CompleteCareStageBody,
  ConsultPrefillBody,
  EnsurePresalesBody,
  HandoffSolutionBody,
  LeadFunnelSnapshot,
  PatchMarketingPlanBody,
  PatchPresalesL2DocsBody,
  PatchPresalesTaskBody,
  PresalesAiAssistBody,
  PresalesConsultSlaReminderBody,
  ReleaseReviewQueueBody,
  UpgradePresalesWorkflowBody,
  BatchUpgradePresalesWorkflowBody,
} from './leads-funnel.types';
import { LeadsFunnelPgRepository } from './leads-funnel-pg.repository';
import { LeadsFunnelSqliteRepository } from './leads-funnel-sqlite.repository';
import { validatePreliminaryPlan } from './presales-marketing-plan.util';
import { buildPresalesConsultBrief } from './presales-consult-brief.util';
import {
  buildPresalesAiPromptContext,
  formatPresalesAiPrompt,
} from './presales-ai-prompt.util';
import { buildProposalAdvanceGate } from './presales-proposal-gate.util';
import { buildPresalesProposalHandoff } from './presales-proposal-handoff.util';
import { buildL1GateChecklist } from './presales-l1-gate-checklist.util';
import { planContentFromRow } from './presales-marketing-plan.util';
import { SERVICE_LABELS } from '../leads-contract/lifecycle-workflow-steps.util';
import { IntakeService } from '../intake/intake.service';
import { AiLlmClient } from '../ai-intelligence/ai-llm.client';
import {
  assertPresalesConsultTaskDone,
  validatePresalesConsultTaskDone,
} from './presales-consult-task-gate.util';
import { mergePresalesFormData } from './presales-task-form.util';
import { assertPresalesL2DocsComplete } from './presales-l2-docs.util';
import { reviewQueuePublicState } from './review-queue.util';
import {
  assertCanAdvanceConsultToProposal,
  assertCanMutatePresalesConsult,
} from './presales-solution-rbac.util';
import {
  buildSolutionHandoffActivity,
  SOLUTION_HANDOFF_ACTIVITY_TYPES,
  type SolutionHandoffActivityType,
} from './presales-solution-handoff-activity.util';
import { buildReviewQueueMetrics } from './review-queue-metrics.util';
import { buildReviewQueueAiSummary, computeReviewQueuePriority } from './review-queue-intelligence.util';
import {
  buildBatchUpgradeCsvHeader,
  cohortCsvRow,
  resolveBatchUpgradeStages,
  type BatchUpgradePresalesWorkflowResult,
} from './presales-workflow-batch.util';
import { ReviewQueueLlmService } from './review-queue-llm.service';
import { PolicyService } from '../policy/policy.service';
import { MarketingAiOrchestratorService } from '../marketing-ai-planner/marketing-ai-orchestrator.service';
import { buildPresalesMktAiBrief, mapStrategyToPreliminaryPlan } from './presales-ai-draft.util';
import {
  clearPresalesAiDraftMeta,
  parsePresalesAiDraftMeta,
  parseTargetMarketProfJson,
  PRESALES_AI_DRAFT_BADGE_VI,
  stampPresalesAiDraftMeta,
} from './presales-ai-draft-meta.util';
import { rejectMktAiAutoCustomerEmail } from '../marketing-ai-planner/mkt-ai-governance.util';
import { LeadMeetingPrepEnqueueService } from '../lead-meeting-prep/lead-meeting-prep-enqueue.service';
import { LeadMeetingPrepRepository } from '../lead-meeting-prep/lead-meeting-prep.repository';
import {
  applyLmpDvCodesToConsultPrefill,
  extractLmpConsultMergeFields,
  mergeLmpIntoConsultBrief,
} from '../lead-meeting-prep/lmp-consult-merge.util';
import { B2bLeadScopeService, type B2bListScope } from '../b2b-projects/b2b-lead-scope.service';
import { B2bManualReassignService } from '../b2b-projects/b2b-manual-reassign.service';
import { LeadsRepository } from '../leads/leads.repository';

@Injectable()
export class LeadsFunnelService {
  constructor(
    private readonly sqliteRepo: LeadsFunnelSqliteRepository,
    private readonly pgRepo: LeadsFunnelPgRepository,
    private readonly config: AppConfigService,
    private readonly staffAuth: StaffAuthService,
    private readonly leadPg: CrmLeadsPgRepository,
    private readonly cskhBoard: CskhBoardService,
    private readonly reviewQueueLlm: ReviewQueueLlmService,
    private readonly intake: IntakeService,
    private readonly llm: AiLlmClient,
    private readonly legacyLeads: CrmLeadsLegacyService,
    private readonly policy: PolicyService,
    private readonly mktAiOrchestrator: MarketingAiOrchestratorService,
    private readonly lmpEnqueue: LeadMeetingPrepEnqueueService,
    private readonly lmpRepo: LeadMeetingPrepRepository,
    private readonly b2bLeadScope: B2bLeadScopeService,
    private readonly b2bManualReassign: B2bManualReassignService,
    private readonly leadsRepo: LeadsRepository,
  ) {}

  private get usePgFunnel(): boolean {
    return this.config.crmLeadsFunnelPg;
  }

  async getFunnel(leadId: number): Promise<LeadFunnelSnapshot> {
    const snap = this.usePgFunnel
      ? await this.pgRepo.buildSnapshot(leadId, this.config.presalesOnLead)
      : this.sqliteRepo.buildSnapshot(leadId, this.config.presalesOnLead);
    if (!snap) throw new NotFoundException({ error: 'Lead not found' });
    return snap;
  }

  async getCarePipeline(leadId: number) {
    const snap = await this.getFunnel(leadId);
    return { ok: true, ...snap.care_pipeline, presales_care_gate: snap.presales_care_gate };
  }

  private funnelError(err: unknown): never {
    if (
      err instanceof NotFoundException ||
      err instanceof ForbiddenException ||
      err instanceof BadRequestException
    ) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new BadRequestException({ error: msg, message: msg });
  }

  private async staffCapContext(staffUser?: StaffJwtPayload) {
    if (!staffUser) return { caps: [], gdkdAssign: false, job_functions: [] as string[], permission_sets: [] as string[] };
    const me = await this.staffAuth.me(staffUser);
    return {
      caps: me.caps,
      gdkdAssign: hasGdkdAssign(me.caps),
      job_functions: me.job_functions ?? [],
      permission_sets: me.permission_sets ?? [],
    };
  }

  private async buildPresalesPolicyContext(
    leadId: number,
    action: 'release' | 'claim',
    staffUser?: StaffJwtPayload,
  ) {
    const staffCtx = await this.staffCapContext(staffUser);
    if (!this.usePgFunnel) {
      return {
        action,
        gdkd_assign: staffCtx.gdkdAssign,
        job_functions: staffCtx.job_functions,
        permission_sets: staffCtx.permission_sets,
        handoff_status: null,
        has_handoff_activity: false,
        consult_complete: false,
        preliminary_plan_ok: false,
      };
    }
    const snap = await this.pgRepo.getPresalesSnapshot(leadId);
    if (!snap) throw new NotFoundException({ error: 'Lead not found' });
    const curProg = snap.progress.consult || { total: 0, done: 0 };
    const consultComplete = curProg.total === 0 || curProg.done >= curProg.total;
    const plan = await this.pgRepo.getPreliminaryPlan(snap.presales.id);
    const planVal = validatePreliminaryPlan(plan);
    const hasHandoff = await this.pgRepo.hasSolutionHandoffActivity(leadId, snap.presales.handed_off_at);
    return {
      action,
      gdkd_assign: staffCtx.gdkdAssign,
      job_functions: staffCtx.job_functions,
      permission_sets: staffCtx.permission_sets,
      handoff_status: snap.presales.handoff_status,
      has_handoff_activity: hasHandoff,
      consult_complete: consultComplete,
      preliminary_plan_ok: planVal.ok,
    };
  }

  async previewPresalesPolicy(
    leadId: number,
    action: 'release' | 'claim',
    staffUser?: StaffJwtPayload,
  ) {
    await this.getFunnel(leadId);
    const ctx = await this.buildPresalesPolicyContext(leadId, action, staffUser);
    const { action: _ignored, ...rest } = ctx;
    return this.policy.preview(action, rest);
  }

  private async assertPresalesPolicy(
    leadId: number,
    action: 'release' | 'claim',
    staffUser?: StaffJwtPayload,
  ): Promise<void> {
    const ctx = await this.buildPresalesPolicyContext(leadId, action, staffUser);
    this.policy.assertAllow(ctx);
  }

  private async assertConsultMutationAllowed(
    leadId: number,
    staffUser: StaffJwtPayload | undefined,
    taskStage?: string,
  ): Promise<void> {
    if (taskStage && taskStage !== 'consult') return;
    const snap = this.usePgFunnel
      ? await this.pgRepo.getPresalesSnapshot(leadId)
      : this.sqliteRepo.getPresalesSnapshot(leadId);
    if (!snap) return;
    const { caps, gdkdAssign } = await this.staffCapContext(staffUser);
    assertCanMutatePresalesConsult(
      caps,
      snap.presales.handoff_status,
      snap.presales.stage,
      { gdkdAssign },
    );
  }

  async submitCareReport(
    leadId: number,
    body: CompleteCareStageBody,
    actor: string,
    userId: number | null,
  ) {
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.submitCareReport(leadId, body, actor, userId);
      } else {
        this.sqliteRepo.submitCareReport(leadId, body, actor, userId);
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async completeCareStage(leadId: number, body: CompleteCareStageBody, actor: string) {
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.completeCareStage(leadId, body, actor);
      } else {
        this.sqliteRepo.completeCareStage(leadId, body, actor);
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async reviewQueueCount(b2bListScope?: B2bListScope): Promise<{ count: number }> {
    const count = this.usePgFunnel
      ? await this.pgRepo.countReviewQueue(b2bListScope)
      : this.sqliteRepo.countReviewQueue();
    return { count };
  }

  async reviewQueueMetrics(limit = 500, b2bListScope?: B2bListScope) {
    const listed = await this.listReviewQueue(limit, b2bListScope);
    return buildReviewQueueMetrics(
      listed.leads.map((row) => ({ hours_waiting: row.review_queue.hours_waiting })),
    );
  }

  async listReviewQueue(limit?: number, b2bListScope?: B2bListScope) {
    let rows = this.usePgFunnel
      ? await this.pgRepo.listReviewQueue(limit, b2bListScope)
      : this.sqliteRepo.listReviewQueue(limit);
    if (
      !this.usePgFunnel &&
      b2bListScope &&
      this.config.b2bProjectOs &&
      !b2bListScope.viewAll &&
      !b2bListScope.isDirector
    ) {
      rows = await this.b2bLeadScope.filterFunnelRows(rows, {
        staffId: b2bListScope.staffId,
        caps: [],
      });
    }
    return {
      leads: rows.map((row) => ({
        id: row.id,
        full_name: row.full_name,
        phone: row.phone,
        status: row.status,
        review_queue: reviewQueuePublicState(parseLeadMeta(row.meta_json), row.first_assigned_at || ''),
      })),
      total: rows.length,
    };
  }

  /** Phase 2 — AI summary line + suggested owner per review-queue lead. */
  async listReviewQueueAiSummaries(
    limit?: number,
    mode?: 'rules' | 'llm',
    b2bListScope?: B2bListScope,
  ) {
    let rows = this.usePgFunnel
      ? await this.pgRepo.listReviewQueue(limit, b2bListScope)
      : this.sqliteRepo.listReviewQueue(limit);
    if (
      !this.usePgFunnel &&
      b2bListScope &&
      this.config.b2bProjectOs &&
      !b2bListScope.viewAll &&
      !b2bListScope.isDirector
    ) {
      rows = await this.b2bLeadScope.filterFunnelRows(rows, {
        staffId: b2bListScope.staffId,
        caps: [],
      });
    }
    const ids = rows.map((r) => Number(r.id));
    const firstCalls = await this.leadPg.firstCallAtByLeadIds(ids);
    const ownerIds = rows.map((r) => Number(r.owner_id ?? 0)).filter((id) => id > 0);
    const ownerNames = await this.leadPg.staffNamesByIds(ownerIds);

    let bestOwner: { id: number; name: string } | null = null;
    try {
      const intel = await this.cskhBoard.getManagerIntelligence();
      const top = intel.rep_performance[0];
      if (top) bestOwner = { id: top.owner_id, name: top.owner_name };
    } catch {
      bestOwner = null;
    }

    const contextRows = rows.map((row) => {
      const meta = parseLeadMeta(row.meta_json);
      const rq = reviewQueuePublicState(meta, row.first_assigned_at || '');
      const ownerId = row.owner_id ?? null;
      return {
        lead_id: row.id,
        full_name: row.full_name ?? '',
        status: String(row.status ?? ''),
        hours_waiting: rq.hours_waiting ?? null,
        owner_name: ownerId ? ownerNames.get(ownerId) ?? null : null,
        best_owner_name: bestOwner?.name ?? null,
      };
    });

    const summaries = rows.map((row) => {
      const meta = parseLeadMeta(row.meta_json);
      const b2At = parseB2CompletedAt(row.care_stages_done_json);
      const rq = reviewQueuePublicState(meta, row.first_assigned_at || '');
      const ownerId = row.owner_id ?? null;
      return buildReviewQueueAiSummary({
        leadId: row.id,
        fullName: row.full_name ?? '',
        status: String(row.status ?? ''),
        hoursWaiting: rq.hours_waiting ?? null,
        firstCallAt: firstCalls.get(row.id) ?? null,
        b2CompletedAt: b2At,
        ownerId,
        ownerName: ownerId ? ownerNames.get(ownerId) ?? null : null,
        bestOwnerId: bestOwner?.id ?? null,
        bestOwnerName: bestOwner?.name ?? null,
      });
    });

    if (mode === 'llm') {
      return this.reviewQueueLlm.enrichSummaries(summaries, contextRows);
    }

    const withPriority = summaries.map((summary) => {
      const ctx = contextRows.find((row) => row.lead_id === summary.lead_id);
      return {
        ...summary,
        priority_score: computeReviewQueuePriority(ctx?.hours_waiting),
        triage_source: 'rules' as const,
      };
    });

    return { ok: true, summaries: withPriority, total: withPriority.length, mode: 'rules' as const };
  }

  async syncReviewQueue(actor: string, dryRun = false) {
    return this.usePgFunnel
      ? this.pgRepo.syncReviewQueue(actor, dryRun)
      : this.sqliteRepo.syncReviewQueue(actor, dryRun);
  }

  async releaseReviewQueue(leadId: number, body: ReleaseReviewQueueBody, actor: string) {
    try {
      const existing = await this.leadsRepo.getLeadById(leadId);
      const b2bManual = existing && this.b2bManualReassign.requiresSplitChoice(existing);
      if (b2bManual && !body.split) {
        throw new BadRequestException({ error: 'split_required' });
      }

      let releaseMeta: { targetOwner: number; fromOwnerId: number | null } | null = null;
      if (this.usePgFunnel) {
        releaseMeta = await this.pgRepo.releaseFromReviewQueue(leadId, body, actor);
      } else {
        this.sqliteRepo.releaseFromReviewQueue(leadId, body, actor);
      }

      if (b2bManual && existing?.b2b_project_id) {
        const toOwnerId =
          releaseMeta?.targetOwner ??
          (body.mode === 'manual' && body.owner_id ? Number(body.owner_id) : Number(existing.owner_id));
        if (toOwnerId) {
          await this.b2bManualReassign.applyManualOwnerChange({
            leadId,
            projectId: String(existing.b2b_project_id),
            fromOwnerId:
              releaseMeta?.fromOwnerId ??
              (existing.owner_id != null ? Number(existing.owner_id) : null),
            toOwnerId,
            split: body.split!,
            reason: body.note?.trim() || 'gdkd_release',
            skipOwnerUpdate: true,
          });
        }
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async getPresales(leadId: number) {
    const snap = await this.getFunnel(leadId);
    return { ok: true, presales: snap.presales };
  }

  async ensurePresales(leadId: number, body: EnsurePresalesBody, actor: string) {
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.ensurePresales(leadId, body.service_slug, actor);
      } else {
        this.sqliteRepo.ensurePresales(leadId, body.service_slug, actor);
      }
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async getConsultAdvanceGate(leadId: number) {
    if (this.usePgFunnel) {
      const ps = await this.pgRepo.getPresalesRowByLeadId(leadId);
      if (!ps) throw new NotFoundException({ error: 'No presales for lead' });
      const gate = await this.pgRepo.buildConsultAdvanceGate(leadId, ps.id);
      return { ok: true, gate, presales_stage: ps.stage };
    }
    const snap = this.sqliteRepo.getPresalesSnapshot(leadId);
    if (!snap) throw new NotFoundException({ error: 'No presales for lead' });
    const gate = this.sqliteRepo.buildConsultAdvanceGate(leadId, snap.presales.id);
    return { ok: true, gate, presales_stage: snap.presales.stage };
  }

  async advancePresales(
    leadId: number,
    body: AdvancePresalesBody,
    allowOverride = false,
    staffUser?: StaffJwtPayload,
  ) {
    try {
      const snap = this.usePgFunnel
        ? await this.pgRepo.getPresalesSnapshot(leadId)
        : this.sqliteRepo.getPresalesSnapshot(leadId);
      if (
        snap?.advance.next_stage === 'proposal' &&
        snap.advance.current_stage === 'consult'
      ) {
        const { caps, gdkdAssign } = await this.staffCapContext(staffUser);
        assertCanAdvanceConsultToProposal(caps, snap.presales.handoff_status, { gdkdAssign });
      }
      if (this.usePgFunnel) {
        await this.pgRepo.advancePresales(leadId, {
          confirm: Boolean(body.confirm),
          overrideReason: body.override_reason,
          allowOverride,
        });
      } else {
        this.sqliteRepo.advancePresales(leadId, {
          confirm: Boolean(body.confirm),
          overrideReason: body.override_reason,
          allowOverride,
        });
      }
    } catch (err) {
      this.funnelError(err);
    }
    await this.maybeEnqueueM3Prep(leadId);
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  private async maybeEnqueueM3Prep(leadId: number): Promise<void> {
    if (!this.lmpEnqueue.isEnabled()) return;
    try {
      const gateResp = await this.getPresalesProposalGate(leadId);
      if (!gateResp.gate.ok) return;
      await this.lmpEnqueue.enqueueAfterProposalGatePass(leadId);
    } catch {
      /* optional hook */
    }
  }

  async listSolutionQueue(status?: string, limit?: number) {
    const statuses: Array<'pending' | 'with_solution'> =
      status === 'pending' || status === 'with_solution'
        ? [status]
        : ['pending', 'with_solution'];
    const rows = this.usePgFunnel
      ? await this.pgRepo.listSolutionQueue(statuses, limit)
      : this.sqliteRepo.listSolutionQueue(statuses, limit);
    return { ok: true, rows, count: rows.length };
  }

  private async resolveStaffDisplayName(
    staffUser: StaffJwtPayload | undefined,
    actor: string,
    staffId: number | null,
  ): Promise<string> {
    const fromJwt = String(staffUser?.display_name ?? '').trim();
    if (fromJwt) return fromJwt;
    if (staffId) {
      const name = (await this.leadPg.staffNamesByIds([staffId])).get(staffId);
      if (name) return name;
    }
    return actor;
  }

  private async logSolutionHandoffActivity(
    leadId: number,
    kind: SolutionHandoffActivityType,
    actor: string,
    staffId: number | null,
    staffUser?: StaffJwtPayload,
  ): Promise<void> {
    const snap = this.usePgFunnel
      ? await this.pgRepo.getPresalesSnapshot(leadId)
      : this.sqliteRepo.getPresalesSnapshot(leadId);
    if (!snap) return;

    let amOwnerName: string | undefined;
    if (kind === SOLUTION_HANDOFF_ACTIVITY_TYPES.released && snap.presales.assigned_am) {
      amOwnerName = (await this.leadPg.staffNamesByIds([snap.presales.assigned_am])).get(
        snap.presales.assigned_am,
      );
    }

    const payload = buildSolutionHandoffActivity(kind, {
      leadId,
      serviceSlug: snap.presales.service_slug,
      actorName: await this.resolveStaffDisplayName(staffUser, actor, staffId),
      amOwnerName,
    });
    await this.legacyLeads.createActivity(leadId, payload, actor, staffId);
  }

  async handoffToSolution(
    leadId: number,
    body: HandoffSolutionBody,
    staffId: number | null,
    actor: string,
    staffUser?: StaffJwtPayload,
  ) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.handoffToSolution(leadId, staffId, {
          confirm: Boolean(body.confirm),
          overrideReason: body.override_reason,
        });
      } else {
        this.sqliteRepo.handoffToSolution(leadId, staffId, {
          confirm: Boolean(body.confirm),
          overrideReason: body.override_reason,
        });
      }
      await this.logSolutionHandoffActivity(
        leadId,
        SOLUTION_HANDOFF_ACTIVITY_TYPES.handoff,
        actor,
        staffId,
        staffUser,
      );
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async claimSolution(
    leadId: number,
    staffId: number | null,
    actor: string,
    staffUser?: StaffJwtPayload,
  ) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    await this.assertPresalesPolicy(leadId, 'claim', staffUser);
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.claimSolution(leadId, staffId);
      } else {
        this.sqliteRepo.claimSolution(leadId, staffId);
      }
      await this.logSolutionHandoffActivity(
        leadId,
        SOLUTION_HANDOFF_ACTIVITY_TYPES.claimed,
        actor,
        staffId,
        staffUser,
      );
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async releaseToSales(
    leadId: number,
    staffId: number | null,
    actor: string,
    staffUser?: StaffJwtPayload,
  ) {
    if (!staffId) throw new BadRequestException({ error: 'Thiếu staff id' });
    await this.assertPresalesPolicy(leadId, 'release', staffUser);
    try {
      if (this.usePgFunnel) {
        await this.pgRepo.releaseToSales(leadId, staffId);
      } else {
        this.sqliteRepo.releaseToSales(leadId, staffId);
      }
      await this.logSolutionHandoffActivity(
        leadId,
        SOLUTION_HANDOFF_ACTIVITY_TYPES.released,
        actor,
        staffId,
        staffUser,
      );
    } catch (err) {
      this.funnelError(err);
    }
    return { ok: true, funnel: await this.getFunnel(leadId) };
  }

  async staffHasAssignCap(staffUser: StaffJwtPayload): Promise<boolean> {
    const me = await this.staffAuth.me(staffUser);
    return this.staffAuth.hasCap(me.caps, 'crm_leads', 'assign');
  }

  async patchPresalesTask(
    leadId: number,
    taskId: number,
    body: PatchPresalesTaskBody,
    doneBy: number | null,
    staffUser?: StaffJwtPayload,
  ) {
    try {
      const task = this.usePgFunnel
        ? await this.pgRepo.getPresalesTaskById(taskId)
        : this.sqliteRepo.getPresalesTaskById(taskId);
      if (!task) {
        throw new NotFoundException({ error: 'Không tìm thấy task pre-sales' });
      }
      await this.assertConsultMutationAllowed(leadId, staffUser, task.stage);

      const mergedFormData = mergePresalesFormData(task.form_data, body.form_data);
      if (body.is_done === true) {
        assertPresalesConsultTaskDone({
          stage: task.stage,
          aiPromptKey: task.ai_prompt_key,
          aiOutput: task.ai_output,
          formFields: task.form_fields,
          formData: mergedFormData,
        });
        if (task.stage === 'consult') {
          const snap = this.usePgFunnel
            ? await this.pgRepo.getPresalesSnapshot(leadId)
            : this.sqliteRepo.getPresalesSnapshot(leadId);
          if (snap) {
            assertPresalesL2DocsComplete(snap.presales.service_slug, snap.presales.l2_docs_json);
          }
        }
      }

      const patchBody: PatchPresalesTaskBody = { ...body };
      if (body.form_data !== undefined || body.is_done === true) {
        patchBody.form_data = mergedFormData;
      }

      if (this.usePgFunnel) {
        await this.pgRepo.updatePresalesTask(taskId, patchBody, doneBy);
      } else {
        this.sqliteRepo.updatePresalesTask(taskId, patchBody, doneBy);
      }
      if (body.is_done === true) {
        await this.maybeEnqueueM3Prep(leadId);
      }
      return { ok: true, funnel: await this.getFunnel(leadId) };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async patchPresalesL2Docs(leadId: number, body: PatchPresalesL2DocsBody, staffUser?: StaffJwtPayload) {
    try {
      await this.assertConsultMutationAllowed(leadId, staffUser, 'consult');
      if (this.usePgFunnel) {
        await this.pgRepo.updatePresalesL2Docs(leadId, body.docs ?? {});
      } else {
        this.sqliteRepo.updatePresalesL2Docs(leadId, body.docs ?? {});
      }
      return { ok: true, funnel: await this.getFunnel(leadId) };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async getPresalesConsultSlaSummary(amId?: number | null) {
    const summary = this.usePgFunnel
      ? await this.pgRepo.getPresalesConsultSlaSummary(amId)
      : this.sqliteRepo.getPresalesConsultSlaSummary(amId);
    return { ok: true, summary };
  }

  async getPresalesFunnelMetrics(query: {
    periodStart?: string | null;
    periodEnd?: string | null;
    amId?: number | null;
  }) {
    const payload = this.usePgFunnel
      ? await this.pgRepo.getPresalesFunnelMetrics(query)
      : this.sqliteRepo.getPresalesFunnelMetrics(query);
    return { ok: true as const, ...payload };
  }

  async createPresalesConsultSlaReminder(
    leadId: number,
    body: PresalesConsultSlaReminderBody,
    actor: string,
    userId: number | null,
  ) {
    try {
      const snap = this.usePgFunnel
        ? await this.pgRepo.getPresalesSnapshot(leadId)
        : this.sqliteRepo.getPresalesSnapshot(leadId);
      if (!snap) throw new NotFoundException({ error: 'No presales for lead' });
      if (snap.presales.stage !== 'consult') {
        throw new BadRequestException({ error: 'SLA Consult→Báo giá chỉ áp dụng khi stage = consult' });
      }
      const sla = snap.consult_proposal_sla;
      const note =
        String(body.message ?? '').trim() ||
        `Nhắc chuyển → Báo giá trong SLA 48h — ${sla.message}`;
      const { activity } = await this.legacyLeads.createActivity(
        leadId,
        {
          activity_type: 'note',
          content: `SLA pre-sales: ${note}`,
          result: 'Reminder nội bộ — không auto-send khách (BR-AI-01).',
          next_action: 'Chuyển → Báo giá trên funnel stepper',
        },
        actor,
        userId,
      );
      return {
        ok: true,
        lead_id: leadId,
        activity_id: activity.id,
        sla,
        funnel: await this.getFunnel(leadId),
      };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async getMarketingPlan(leadId: number) {
    if (this.usePgFunnel) {
      const ps = await this.pgRepo.getPresalesRowByLeadId(leadId);
      if (!ps) throw new NotFoundException({ error: 'No presales for lead' });
      const plan = await this.pgRepo.getOrCreatePreliminaryPlan(leadId, ps.id, ps.service_slug);
      const validation = validatePreliminaryPlan(plan);
      const ai_draft = parsePresalesAiDraftMeta(parseTargetMarketProfJson(plan.target_market_prof_json));
      return { ok: true, plan, validation, ai_draft };
    }
    const snap = this.sqliteRepo.getPresalesSnapshot(leadId);
    if (!snap) throw new NotFoundException({ error: 'No presales for lead' });
    const plan = this.sqliteRepo.getOrCreatePreliminaryPlan(
      leadId,
      snap.presales.id,
      snap.presales.service_slug,
    );
    const validation = validatePreliminaryPlan(plan);
    const ai_draft = parsePresalesAiDraftMeta(parseTargetMarketProfJson(plan.target_market_prof_json));
    return { ok: true, plan, validation, ai_draft };
  }

  private mergeManualMarketingPlanPatch(
    plan: Record<string, unknown>,
    body: PatchMarketingPlanBody,
  ): PatchMarketingPlanBody {
    const prof = parseTargetMarketProfJson(plan.target_market_prof_json);
    return {
      ...body,
      target_market_prof: clearPresalesAiDraftMeta({ ...prof, ...(body.target_market_prof ?? {}) }),
    };
  }

  async patchMarketingPlan(leadId: number, body: PatchMarketingPlanBody, staffUser?: StaffJwtPayload) {
    await this.assertConsultMutationAllowed(leadId, staffUser, 'consult');
    if (this.usePgFunnel) {
      const ps = await this.pgRepo.getPresalesRowByLeadId(leadId);
      if (!ps) throw new NotFoundException({ error: 'No presales for lead' });
      const existing = await this.pgRepo.getOrCreatePreliminaryPlan(leadId, ps.id, ps.service_slug);
      const patchBody = this.mergeManualMarketingPlanPatch(existing, body);
      const plan = await this.pgRepo.patchMarketingPlan(leadId, patchBody);
      const validation = validatePreliminaryPlan(plan);
      const ai_draft = parsePresalesAiDraftMeta(parseTargetMarketProfJson(plan.target_market_prof_json));
      return { ok: true, plan, validation, ai_draft, funnel: await this.getFunnel(leadId) };
    }
    const snap = this.sqliteRepo.getPresalesSnapshot(leadId);
    if (!snap) throw new NotFoundException({ error: 'No presales for lead' });
    const existing = this.sqliteRepo.getOrCreatePreliminaryPlan(
      leadId,
      snap.presales.id,
      snap.presales.service_slug,
    );
    const patchBody = this.mergeManualMarketingPlanPatch(existing, body);
    const plan = this.sqliteRepo.patchMarketingPlan(leadId, patchBody);
    const validation = validatePreliminaryPlan(plan);
    const ai_draft = parsePresalesAiDraftMeta(parseTargetMarketProfJson(plan.target_market_prof_json));
    return { ok: true, plan, validation, ai_draft, funnel: await this.getFunnel(leadId) };
  }

  private async assertPresalesMktAiGenerateCap(staffUser?: StaffJwtPayload): Promise<void> {
    if (!staffUser) return;
    const me = await this.staffAuth.me(staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_board', 'edit')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_board', action: 'edit' });
    }
    if (!this.staffAuth.hasCap(me.caps, 'crm_mkt_ai', 'generate')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_mkt_ai', action: 'generate' });
    }
  }

  private assertPresalesMktAiEnabled(serviceSlug: string): void {
    if (!this.config.mktAiPlannerEnabled) {
      throw new ServiceUnavailableException({ error: 'mkt_ai_planner_disabled' });
    }
    if (
      this.config.mktAiPilotOnlyEnabled &&
      serviceSlug &&
      !this.config.mktAiPilotServiceSlugs.includes(serviceSlug)
    ) {
      throw new ForbiddenException({
        error: 'mkt_ai_pilot_slug_required',
        message: 'Presales AI draft chỉ pilot DV02/DV04/DV05/DV20 (P2-13).',
        pilot_dv: ['DV02', 'DV04', 'DV05', 'DV20'],
        service_slug: serviceSlug,
      });
    }
    const slugs = this.config.mktAiPlannerSlugs;
    if (slugs.length && serviceSlug && !slugs.includes(serviceSlug)) {
      throw new ForbiddenException({ error: 'mkt_ai_planner_slug_not_pilot', service_slug: serviceSlug });
    }
  }

  async generatePresalesMarketingPlanAiDraft(leadId: number, staffUser?: StaffJwtPayload) {
    try {
      rejectMktAiAutoCustomerEmail(this.config.mktAiAutoCustomerEmailEnabled, {});
      await this.assertPresalesMktAiGenerateCap(staffUser);
      await this.assertConsultMutationAllowed(leadId, staffUser, 'consult');
      const { snap, intakeSessions, leadName } = await this.loadPresalesContext(leadId);
      const serviceSlug = snap.presales.service_slug;
      this.assertPresalesMktAiEnabled(serviceSlug);

      const leadTasks = snap.tasks.lead ?? [];
      const leadTaskDone =
        (snap.progress.lead?.total ?? 0) === 0 ||
        (snap.progress.lead?.done ?? 0) >= (snap.progress.lead?.total ?? 0);
      const consultBrief = buildPresalesConsultBrief({
        presalesId: snap.presales.id,
        leadId,
        serviceSlug,
        presalesStage: snap.presales.stage,
        leadTaskDone,
        leadTask: leadTasks[0] ?? null,
        intakeSessions,
      });

      const existingPlan = this.usePgFunnel
        ? await this.pgRepo.getOrCreatePreliminaryPlan(leadId, snap.presales.id, serviceSlug)
        : this.sqliteRepo.getOrCreatePreliminaryPlan(leadId, snap.presales.id, serviceSlug);

      const brief = buildPresalesMktAiBrief({
        consultBrief,
        serviceSlug,
        leadName: leadName || `Lead #${leadId}`,
      });
      const strategy = await this.mktAiOrchestrator.generateStrategy(brief);
      const patchBody = mapStrategyToPreliminaryPlan(strategy, {
        leadId,
        serviceSlug,
        brief,
        existingName: String(existingPlan.name ?? ''),
      });
      patchBody.target_market_prof = stampPresalesAiDraftMeta(
        patchBody.target_market_prof ?? {},
        staffUser?.email ?? 'unknown',
      );

      if (this.usePgFunnel) {
        const plan = await this.pgRepo.patchMarketingPlan(leadId, patchBody);
        const validation = validatePreliminaryPlan(plan);
        const ai_draft = parsePresalesAiDraftMeta(parseTargetMarketProfJson(plan.target_market_prof_json));
        return {
          ok: true,
          plan,
          validation,
          funnel: await this.getFunnel(leadId),
          ai_draft,
          requires_sp_review: true,
          badge_vi: PRESALES_AI_DRAFT_BADGE_VI,
          ai: { stub_mode: this.mktAiOrchestrator.stubMode, model: this.mktAiOrchestrator.modelName },
        };
      }
      const plan = this.sqliteRepo.patchMarketingPlan(leadId, patchBody);
      const validation = validatePreliminaryPlan(plan);
      const ai_draft = parsePresalesAiDraftMeta(parseTargetMarketProfJson(plan.target_market_prof_json));
      return {
        ok: true,
        plan,
        validation,
        funnel: await this.getFunnel(leadId),
        ai_draft,
        requires_sp_review: true,
        badge_vi: PRESALES_AI_DRAFT_BADGE_VI,
        ai: { stub_mode: this.mktAiOrchestrator.stubMode, model: this.mktAiOrchestrator.modelName },
      };
    } catch (err) {
      this.funnelError(err);
    }
  }

  private async loadPresalesContext(leadId: number) {
    const snap = this.usePgFunnel
      ? await this.pgRepo.getPresalesSnapshot(leadId)
      : this.sqliteRepo.getPresalesSnapshot(leadId);
    if (!snap) throw new NotFoundException({ error: 'No presales for lead' });
    const intakeBundle = await this.intake.listSessions(leadId);
    const leadRow = this.usePgFunnel
      ? await this.pgRepo.fetchLeadRow(leadId)
      : this.sqliteRepo.fetchLeadRow(leadId);
    return { snap, intakeSessions: intakeBundle.sessions, leadName: leadRow?.full_name ?? '' };
  }

  async getPresalesConsultBrief(leadId: number) {
    const { snap, intakeSessions } = await this.loadPresalesContext(leadId);
    const leadTasks = snap.tasks.lead ?? [];
    const leadTaskDone =
      (snap.progress.lead?.total ?? 0) === 0 ||
      (snap.progress.lead?.done ?? 0) >= (snap.progress.lead?.total ?? 0);
    const brief = buildPresalesConsultBrief({
      presalesId: snap.presales.id,
      leadId,
      serviceSlug: snap.presales.service_slug,
      presalesStage: snap.presales.stage,
      leadTaskDone,
      leadTask: leadTasks[0] ?? null,
      intakeSessions,
    });
    let merged = brief;
    if (this.config.leadMeetingPrepEnabled && (await this.lmpRepo.tableReady())) {
      const prepRow = await this.lmpRepo.getByLeadId(leadId);
      merged = mergeLmpIntoConsultBrief(brief, extractLmpConsultMergeFields(prepRow));
    }
    return { ok: true, brief: merged };
  }

  async prefillPresalesConsult(leadId: number, body: ConsultPrefillBody, staffUser?: StaffJwtPayload) {
    try {
      await this.assertConsultMutationAllowed(leadId, staffUser, 'consult');
      const overwrite = Boolean(body.overwrite);
      const out = this.usePgFunnel
        ? await this.pgRepo.runPresalesConsultPrefill(leadId, overwrite)
        : await this.sqliteRepo.runPresalesConsultPrefill(leadId, overwrite);

      if (
        this.config.leadMeetingPrepEnabled &&
        (await this.lmpRepo.tableReady()) &&
        out.task_id
      ) {
        const prepRow = await this.lmpRepo.getByLeadId(leadId);
        const lmp = extractLmpConsultMergeFields(prepRow);
        if (lmp.recommended_dv_codes.length) {
          const task = this.usePgFunnel
            ? await this.pgRepo.getPresalesTaskById(out.task_id)
            : this.sqliteRepo.getPresalesTaskById(out.task_id);
          if (task) {
            const applied = applyLmpDvCodesToConsultPrefill(
              task.form_data ?? {},
              lmp.recommended_dv_codes,
              task.form_fields ?? [],
              overwrite,
            );
            if (applied.filled.length) {
              const patch = { form_data: applied.form_data };
              if (this.usePgFunnel) {
                await this.pgRepo.updatePresalesTask(out.task_id, patch, null);
              } else {
                this.sqliteRepo.updatePresalesTask(out.task_id, patch, null);
              }
              out.fields = [...new Set([...(out.fields ?? []), ...applied.filled])];
              out.filled = (out.filled ?? 0) + applied.filled.length;
            }
          }
        }
      }

      return { ok: true, ...out, funnel: await this.getFunnel(leadId) };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async getPresalesProposalGate(leadId: number) {
    const { snap } = await this.loadPresalesContext(leadId);
    const plan = this.usePgFunnel
      ? await this.pgRepo.getOrCreatePreliminaryPlan(leadId, snap.presales.id, snap.presales.service_slug)
      : this.sqliteRepo.getOrCreatePreliminaryPlan(leadId, snap.presales.id, snap.presales.service_slug);
    const gate = buildProposalAdvanceGate({
      consultProgress: snap.progress.consult ?? { total: 0, done: 0 },
      plan: plan as {
        name?: string | null;
        north_star?: string | null;
        objectives?: string | null;
        strategy_framework_json?: string | null;
      },
    });
    return { ok: true, gate, presales_stage: snap.presales.stage };
  }

  async getPresalesProposalHandoff(leadId: number) {
    try {
      const snap = this.usePgFunnel
        ? await this.pgRepo.getPresalesSnapshot(leadId)
        : this.sqliteRepo.getPresalesSnapshot(leadId);
      if (!snap) throw new NotFoundException({ error: 'No presales for lead' });
      const customerId = this.usePgFunnel
        ? await this.pgRepo.getLeadConvertedCustomerId(leadId)
        : this.sqliteRepo.getLeadConvertedCustomerId(leadId);
      const consultTasks = snap.tasks.consult ?? [];
      const plan = this.usePgFunnel
        ? await this.pgRepo.getOrCreatePreliminaryPlan(
            leadId,
            snap.presales.id,
            snap.presales.service_slug,
          )
        : this.sqliteRepo.getOrCreatePreliminaryPlan(
            leadId,
            snap.presales.id,
            snap.presales.service_slug,
          );
      const planContent = planContentFromRow(plan as Record<string, unknown>);
      const gate = buildProposalAdvanceGate({
        consultProgress: snap.progress.consult ?? { total: 0, done: 0 },
        plan: plan as {
          name?: string | null;
          north_star?: string | null;
          objectives?: string | null;
          strategy_framework_json?: string | null;
        },
      });
      const l1Checklist = buildL1GateChecklist({
        gate,
        plan: {
          name: planContent.name,
          north_star: planContent.north_star,
          objectives: planContent.objectives,
          strategy_framework: planContent.strategy_framework,
        },
      });
      const handoff = buildPresalesProposalHandoff({
        leadId,
        serviceSlug: snap.presales.service_slug,
        customerId,
        consultTask: consultTasks[0] ?? null,
        proposalGate: gate,
        l1Checklist,
      });
      return { ok: true, handoff };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async runPresalesTaskAiAssist(
    leadId: number,
    taskId: number,
    body: PresalesAiAssistBody,
    staffUser?: StaffJwtPayload,
  ) {
    try {
      const task = this.usePgFunnel
        ? await this.pgRepo.getPresalesTaskById(taskId)
        : this.sqliteRepo.getPresalesTaskById(taskId);
      if (!task) throw new NotFoundException({ error: 'Không tìm thấy task pre-sales' });
      await this.assertConsultMutationAllowed(leadId, staffUser, task.stage);

      const snap = this.usePgFunnel
        ? await this.pgRepo.getPresalesSnapshot(leadId)
        : this.sqliteRepo.getPresalesSnapshot(leadId);
      if (!snap || task.presales_id !== snap.presales.id) {
        throw new BadRequestException({ error: 'Task không thuộc pre-sales của lead' });
      }
      if (task.stage !== 'consult') {
        throw new BadRequestException({ error: 'AI assist chỉ hỗ trợ task Consult' });
      }
      const promptKey = String(task.ai_prompt_key || '').trim();
      if (!promptKey) {
        throw new BadRequestException({ error: 'Task không có AI prompt' });
      }

      const { intakeSessions, leadName } = await this.loadPresalesContext(leadId);
      const leadTasks = snap.tasks.lead ?? [];
      const leadTaskDone =
        (snap.progress.lead?.total ?? 0) === 0 ||
        (snap.progress.lead?.done ?? 0) >= (snap.progress.lead?.total ?? 0);
      const brief = buildPresalesConsultBrief({
        presalesId: snap.presales.id,
        leadId,
        serviceSlug: snap.presales.service_slug,
        presalesStage: snap.presales.stage,
        leadTaskDone,
        leadTask: leadTasks[0] ?? null,
        intakeSessions,
      });
      const serviceLabel = SERVICE_LABELS[snap.presales.service_slug] ?? snap.presales.service_slug;
      const ctx = buildPresalesAiPromptContext({
        brief,
        customerName: leadName || `Lead #${leadId}`,
        serviceLabel,
        formContext: body.form_context,
      });
      const prompt = formatPresalesAiPrompt(promptKey, ctx);
      if (!prompt) throw new BadRequestException({ error: 'Không tìm thấy AI template' });

      const llmOut = await this.llm.completeText({
        userContent: prompt,
        systemPrompt: 'Bạn là chuyên gia marketing agency PTT. Trả lời bằng tiếng Việt, súc tích, có cấu trúc.',
      });
      if (this.usePgFunnel) {
        await this.pgRepo.updatePresalesTaskAiOutput(taskId, llmOut.text);
      } else {
        this.sqliteRepo.updatePresalesTaskAiOutput(taskId, llmOut.text);
      }
      return {
        ok: true,
        task_id: taskId,
        ai_output: llmOut.text,
        stub_mode: llmOut.stubMode,
        funnel: await this.getFunnel(leadId),
      };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async upgradePresalesWorkflowTemplate(leadId: number, body: UpgradePresalesWorkflowBody) {
    try {
      const opts = {
        stages: body.stages,
        dryRun: Boolean(body.dry_run),
        prefillConsult: body.prefill_consult !== false,
      };
      const out = this.usePgFunnel
        ? await this.pgRepo.upgradePresalesWorkflowTemplate(leadId, opts)
        : this.sqliteRepo.upgradePresalesWorkflowTemplate(leadId, opts);
      return { ...out, funnel: opts.dryRun ? undefined : await this.getFunnel(leadId) };
    } catch (err) {
      this.funnelError(err);
    }
  }

  async batchUpgradePresalesWorkflow(body: BatchUpgradePresalesWorkflowBody) {
    try {
      const dryRun = Boolean(body.dry_run);
      if (!dryRun && !this.config.presalesBatchUpgradeEnabled) {
        throw new ServiceUnavailableException({
          error: 'PTT_PRESALES_BATCH_UPGRADE disabled — dry-run only until gate pass',
        });
      }
      const stages = resolveBatchUpgradeStages(body.stages);
      const upgradeOpts = {
        stages,
        dryRun: false,
        prefillConsult: body.prefill_consult !== false,
      };
      const cohort = this.usePgFunnel
        ? await this.pgRepo.listPresalesWorkflowUpgradeCohort({
            leadIds: body.lead_ids,
            limit: body.limit,
          })
        : this.sqliteRepo.listPresalesWorkflowUpgradeCohort({
            leadIds: body.lead_ids,
            limit: body.limit,
          });

      const csvRows = [buildBatchUpgradeCsvHeader(), ...cohort.map(cohortCsvRow)];

      if (dryRun) {
        return {
          ok: true,
          dry_run: true,
          cohort_size: cohort.length,
          processed: cohort.length,
          upgraded: 0,
          skipped: 0,
          results: cohort.map((row) => ({
            lead_id: row.lead_id,
            ok: true,
            service_slug: row.service_slug,
          })),
          csv_rows: csvRows,
        };
      }

      const results: BatchUpgradePresalesWorkflowResult['results'] = [];
      let upgraded = 0;
      let skipped = 0;
      for (const row of cohort) {
        try {
          const out = this.usePgFunnel
            ? await this.pgRepo.upgradePresalesWorkflowTemplate(row.lead_id, upgradeOpts)
            : this.sqliteRepo.upgradePresalesWorkflowTemplate(row.lead_id, upgradeOpts);
          upgraded += 1;
          results.push({
            lead_id: row.lead_id,
            ok: true,
            service_slug: out.service_slug,
            stages: out.stages,
          });
        } catch (err) {
          skipped += 1;
          const msg = err instanceof Error ? err.message : String(err);
          results.push({ lead_id: row.lead_id, ok: false, error: msg });
        }
      }

      return {
        ok: skipped === 0,
        dry_run: false,
        cohort_size: cohort.length,
        processed: cohort.length,
        upgraded,
        skipped,
        results,
        csv_rows: csvRows,
      };
    } catch (err) {
      this.funnelError(err);
    }
  }
}

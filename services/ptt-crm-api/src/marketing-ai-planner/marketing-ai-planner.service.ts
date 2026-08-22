import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  forwardRef,
} from '@nestjs/common';
import { AiAgentRunsRepository } from '../ai-intelligence/ai-agent-runs.repository';
import { AppConfigService } from '../config/app-config.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { validateMktAiBrief, mergeBrief, emptyDraft } from './marketing-ai-brief.util';
import { computeBriefReadiness } from './marketing-ai-brief-readiness.util';
import {
  assessTmmtPrefillReadiness,
  buildTmmtPrefillFromL1AndConsult,
  mergeTmmtPrefillBrief,
  TMMT_PREFILL_SOURCE,
} from './marketing-ai-tmmt-prefill.util';
import { MarketingAiBriefUploadService } from './marketing-ai-brief-upload.service';
import { normalizeKpiTree, suggestKpiTreeFromContext } from './marketing-ai-kpi-tree.util';
import { computeQualityScore } from './marketing-ai-quality.util';
import { MarketingAiVersionService } from './marketing-ai-version.service';
import { MarketingAiApprovalService } from './marketing-ai-approval.service';
import { MarketingAiBudgetService } from './marketing-ai-budget.service';
import { MarketingAiExportService } from './marketing-ai-export.service';
import { MarketingAiDashboardService } from './marketing-ai-dashboard.service';
import { MarketingAiKpiAlertService } from './marketing-ai-kpi-alert.service';
import { MarketingAiKpiClosedLoopService } from './marketing-ai-kpi-closed-loop.service';
import { MarketingAiWeeklyMemoService } from './marketing-ai-weekly-memo.service';
import { buildCompetitorSnapshotFromBrief } from './marketing-ai-competitor-snapshot.util';
import { MarketingAiMultiAgentService } from './marketing-ai-multi-agent.service';
import { MarketingAiOptimizeService } from './marketing-ai-optimize.service';
import { MarketingAiPlaybookService } from './marketing-ai-playbook.service';
import { buildGovernanceContext } from './marketing-ai-playbook.util';
import { buildMktAiPilotContext } from './mkt-ai-pilot.util';
import {
  MKT_AI_CUSTOMER_EMAIL_POLICY_VI,
  rejectMktAiAutoCustomerEmail,
} from './mkt-ai-governance.util';
import { MarketingAiOrchestratorService } from './marketing-ai-orchestrator.service';
import { MarketingAiSectionCommentService } from './marketing-ai-section-comment.service';
import { MarketingAiStrategyScenarioService } from './marketing-ai-strategy-scenario.service';
import { buildMarketingPlanPptx, pickPptxSections } from './marketing-ai-pptx.util';
import { MarketingAiRagService } from './marketing-ai-rag.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import {
  buildExportDocument,
  buildExportFilename,
  buildExportSections,
} from './marketing-ai-export.util';
import type { MktAiExportFileResult } from './marketing-ai-export.types';
import type {
  MktAiBrief,
  MktAiCampaignDraft,
  MktAiDraft,
  MktAiJobType,
  MktAiOptimizeBody,
  MktAiOptimizeResult,
  MktAiMultiAgentAsyncResult,
  MktAiMultiAgentBody,
  MktAiMultiAgentResult,
  MktAiMultiAgentStatusPayload,
  MktAiPlaybookApplyBody,
  MktAiPlaybookApplyResult,
  MktAiPlaybookListResult,
  MktAiPptxExportBody,
  MktAiPlannerContext,
  MktAiSectionCommentRow,
  MktAiStrategyScenarioComparePayload,
  MktAiStrategyScenarioRow,
  MktAiDashboardPayload,
  MktAiKpiClosedLoopPayload,
  MktAiWeeklyMemoResult,
} from './marketing-ai-planner.types';

const RETRY_JOB_TYPES: MktAiJobType[] = [
  'strategy_generate',
  'campaign_generate',
  'content_generate',
  'quality_score',
];

@Injectable()
export class MarketingAiPlannerService {
  constructor(
    private readonly config: AppConfigService,
    private readonly lifecycle: ServiceLifecycleService,
    private readonly repo: MarketingAiPlannerRepository,
    private readonly orchestrator: MarketingAiOrchestratorService,
    private readonly rag: MarketingAiRagService,
    private readonly budget: MarketingAiBudgetService,
    private readonly approval: MarketingAiApprovalService,
    private readonly versions: MarketingAiVersionService,
    private readonly agentRuns: AiAgentRunsRepository,
    private readonly exportService: MarketingAiExportService,
    private readonly dashboard: MarketingAiDashboardService,
    private readonly optimize: MarketingAiOptimizeService,
    private readonly kpiAlerts: MarketingAiKpiAlertService,
    private readonly kpiClosedLoop: MarketingAiKpiClosedLoopService,
    private readonly weeklyMemo: MarketingAiWeeklyMemoService,
    private readonly playbooks: MarketingAiPlaybookService,
    @Inject(forwardRef(() => MarketingAiMultiAgentService))
    private readonly multiAgent: MarketingAiMultiAgentService,
    private readonly briefUpload: MarketingAiBriefUploadService,
    private readonly strategyScenarios: MarketingAiStrategyScenarioService,
    private readonly sectionComments: MarketingAiSectionCommentService,
  ) {}

  private assertEnabled(serviceSlug?: string): void {
    if (!this.config.mktAiPlannerEnabled) {
      throw new NotFoundException({ error: 'mkt_ai_planner_disabled' });
    }
    if (
      this.config.mktAiPilotOnlyEnabled &&
      serviceSlug &&
      !this.config.mktAiPilotServiceSlugs.includes(serviceSlug)
    ) {
      throw new ForbiddenException({
        error: 'mkt_ai_pilot_slug_required',
        message: 'AI Marketing chỉ pilot DV02/DV04/DV05/DV20 — tắt PTT_MKT_AI_PILOT_ONLY để GA toàn hệ.',
        pilot_dv: ['DV02', 'DV04', 'DV05', 'DV20'],
        service_slug: serviceSlug,
      });
    }
    const slugs = this.config.mktAiPlannerSlugs;
    if (slugs.length && serviceSlug && !slugs.includes(serviceSlug)) {
      throw new ForbiddenException({ error: 'mkt_ai_planner_slug_not_pilot', service_slug: serviceSlug });
    }
  }

  private async loadLifecycleRow(id: number): Promise<Record<string, unknown>> {
    const detail = await this.lifecycle.detail(id);
    return detail as Record<string, unknown>;
  }

  private async buildPrefillBrief(lifecycleId: number, serviceSlug: string): Promise<{
    brief: MktAiBrief;
    sources: string[];
  }> {
    let consultBrief: Record<string, unknown> | null = null;
    let leadName = '';
    try {
      consultBrief = (await this.lifecycle.consultBrief(lifecycleId)) as Record<string, unknown>;
    } catch {
      consultBrief = null;
    }

    try {
      const lc = await this.loadLifecycleRow(lifecycleId);
      leadName = String(lc.client_name ?? lc.customer_name ?? '').trim();
    } catch {
      leadName = '';
    }

    let l1PlanRow: Record<string, unknown> | null = null;
    try {
      const mp = await this.lifecycle.marketingPlan(lifecycleId);
      l1PlanRow = (mp?.plan as Record<string, unknown> | null) ?? null;
      if (l1PlanRow) {
        l1PlanRow = {
          ...l1PlanRow,
          strategy_framework_json: JSON.stringify(
            (l1PlanRow.strategy_framework as Record<string, string> | undefined) ?? {},
          ),
        };
      }
    } catch {
      l1PlanRow = null;
    }

    const prefill = buildTmmtPrefillFromL1AndConsult({
      serviceSlug,
      leadName,
      consultBrief,
      l1PlanRow,
    });

    try {
      const onboard = (await this.lifecycle.onboardingBrief(lifecycleId)) as Record<string, unknown>;
      if (onboard.client_name && !prefill.brief.brand_name) {
        prefill.brief.brand_name = String(onboard.client_name);
      }
      if (!prefill.sources.includes('onboarding-brief')) {
        prefill.sources.push('onboarding-brief');
      }
    } catch {
      /* optional */
    }

    if (l1PlanRow && !prefill.sources.includes('presales-official-plan')) {
      prefill.sources.push('presales-official-plan');
    }

    return prefill;
  }

  async prefillBriefFromL1Consult(
    lifecycleId: number,
    actorEmail: string,
    opts: { overwrite?: boolean } = {},
  ): Promise<{
    brief: MktAiBrief;
    brief_validation: ReturnType<typeof validateMktAiBrief>;
    brief_readiness: ReturnType<typeof computeBriefReadiness>;
    prefill_sources: string[];
    prefill_target_score: number;
    prefill_meets_target: boolean;
  }> {
    const lc = await this.loadLifecycleRow(lifecycleId);
    const serviceSlug = String(lc.service_slug ?? '');
    this.assertEnabled(serviceSlug);

    const built = await this.buildPrefillBrief(lifecycleId, serviceSlug);
    const existing = await this.repo.getBrief(lifecycleId);
    const merged = opts.overwrite
      ? built.brief
      : mergeTmmtPrefillBrief(existing?.brief_json ?? null, built.brief);
    const sources = [...new Set([...(existing?.prefill_sources_json ?? []), ...built.sources])];
    if (!sources.includes(TMMT_PREFILL_SOURCE) && built.sources.includes(TMMT_PREFILL_SOURCE)) {
      sources.push(TMMT_PREFILL_SOURCE);
    }

    await this.repo.upsertBrief(lifecycleId, merged, sources, actorEmail);
    const readiness = assessTmmtPrefillReadiness(merged);
    return {
      brief: merged,
      brief_validation: validateMktAiBrief(merged),
      brief_readiness: computeBriefReadiness(merged),
      prefill_sources: sources,
      prefill_target_score: readiness.target,
      prefill_meets_target: readiness.meets_target,
    };
  }

  async getContext(lifecycleId: number): Promise<MktAiPlannerContext> {
    const lc = await this.loadLifecycleRow(lifecycleId);
    const serviceSlug = String(lc.service_slug ?? '');
    this.assertEnabled(serviceSlug);

    let briefRow = await this.repo.getBrief(lifecycleId);
    if (!briefRow) {
      const prefill = await this.buildPrefillBrief(lifecycleId, serviceSlug);
      const readiness = assessTmmtPrefillReadiness(prefill.brief);
      if (readiness.meets_target && prefill.sources.includes(TMMT_PREFILL_SOURCE)) {
        await this.repo.upsertBrief(lifecycleId, prefill.brief, prefill.sources, 'system-prefill');
        briefRow = await this.repo.getBrief(lifecycleId);
      }
      if (!briefRow) {
        briefRow = {
          brief_json: prefill.brief,
          prefill_sources_json: prefill.sources,
          updated_by: '',
        };
      }
    }

    const draft =
      (await this.repo.getDraft(lifecycleId)) ?? (emptyDraft() as MktAiDraft);
    const briefValidation = validateMktAiBrief(briefRow.brief_json);
    const briefReadiness = computeBriefReadiness(briefRow.brief_json);
    const tmmtPayload = await this.lifecycle.marketingPlan(lifecycleId);
    const quality = computeQualityScore(briefRow.brief_json, draft, {
      planDepthEnabled: this.config.mktAiPlanDepthEnabled,
    });
    const jobs = await this.repo.listJobs(lifecycleId);
    const documents = this.rag.isFeatureEnabled()
      ? await this.rag.listDocuments(lifecycleId)
      : [];
    const indexedCount = documents.filter((d) => d.status === 'indexed' && d.chunk_count > 0).length;
    const useRag = this.rag.shouldUseRag(briefRow.brief_json, indexedCount);
    const ragCitations = draft.quality_score_json?.rag_citations;
    const budgetScenarios = await this.repo.listBudgetScenarios(lifecycleId);
    const approvalCtx = await this.approval.buildContext(
      lifecycleId,
      briefRow.brief_json,
      draft,
      quality.can_export,
    );
    const planVersions = this.versions.summarizeVersions(
      await this.versions.listVersions(lifecycleId, 20),
    );
    const playbookCtx = this.playbooks.isEnabled()
      ? this.playbooks.buildContextFromDraft({
          brief: briefRow.brief_json,
          draft,
          serviceSlug,
          qualityScore: quality.score,
        })
      : null;

    const governanceBlock =
      playbookCtx && this.playbooks.isGovernanceBannerEnabled()
        ? buildGovernanceContext({
            enabled: true,
            playbookLabel: playbookCtx.playbook.label_vi,
            governanceNotes: playbookCtx.playbook.governance_notes,
            launchQaGate: playbookCtx.launch_qa_quality_gate,
          })
        : undefined;

    return {
      lifecycle_id: lifecycleId,
      stage: String(lc.stage ?? ''),
      service_slug: serviceSlug,
      enabled: true,
      brief: briefRow.brief_json,
      brief_validation: briefValidation,
      brief_readiness: briefReadiness,
      prefill_sources: briefRow.prefill_sources_json ?? [],
      jobs,
      draft: {
        ...draft,
        quality_score_json: {
          ...draft.quality_score_json,
          ...(ragCitations ? { rag_citations: ragCitations } : {}),
        },
      },
      documents,
      rag: {
        use_rag: useRag,
        indexed_count: indexedCount,
      },
      budget_scenarios: budgetScenarios,
      approval: approvalCtx.approval,
      comments: approvalCtx.comments,
      plan_versions: planVersions,
      tmmt_validation: {
        ok: Boolean(tmmtPayload.validation?.ok),
        messages: tmmtPayload.validation?.messages ?? [],
        filled_count: tmmtPayload.filled_count,
      },
      quality_score: {
        score: quality.score,
        criteria: quality.criteria,
        can_apply: quality.can_apply,
        can_export: quality.can_export,
        can_export_docx_only: quality.can_export_docx_only,
      },
      ...(playbookCtx
        ? {
            playbook: playbookCtx.playbook,
            launch_qa_quality_gate: playbookCtx.launch_qa_quality_gate,
            ...(governanceBlock ? { governance: governanceBlock } : {}),
          }
        : {}),
      ...(this.multiAgent.isEnabled()
        ? { multi_agent: await this.multiAgent.getStatus(lifecycleId) }
        : {}),
      flags: {
        rag_enabled: this.rag.isFeatureEnabled(),
        approval_required: this.approval.isFeatureEnabled(),
        stub_mode: this.orchestrator.stubMode,
        playbooks_enabled: this.playbooks.isEnabled(),
        playbook_governance_enabled: this.playbooks.isGovernanceBannerEnabled(),
        launch_qa_quality_gate_enabled: this.playbooks.isLaunchQaQualityGateEnabled(),
        multi_agent_enabled: this.multiAgent.isEnabled(),
        plan_depth_enabled: this.config.mktAiPlanDepthEnabled,
        brief_upload_enabled: this.briefUpload.isFeatureEnabled(),
        scenario_compare_enabled: this.strategyScenarios.isEnabled(),
        section_comments_enabled: this.sectionComments.isEnabled(),
        export_pptx_enabled: this.config.mktAiExportPptx,
        kpi_closed_loop_enabled: this.kpiClosedLoop.isEnabled(),
        pilot_only: this.config.mktAiPilotOnlyEnabled,
        auto_customer_email_enabled: this.config.mktAiAutoCustomerEmailEnabled,
      },
      pilot: buildMktAiPilotContext(
        serviceSlug,
        this.config.mktAiPilotOnlyEnabled,
        this.config.mktAiPilotServiceSlugs,
      ),
      customer_email_policy_vi: MKT_AI_CUSTOMER_EMAIL_POLICY_VI,
      ...(this.strategyScenarios.isEnabled()
        ? { strategy_scenarios: await this.strategyScenarios.list(lifecycleId) }
        : {}),
      ...(this.sectionComments.isEnabled()
        ? { section_comments: await this.sectionComments.list(lifecycleId) }
        : {}),
    };
  }

  async listPlaybooks(lifecycleId: number): Promise<MktAiPlaybookListResult> {
    const lc = await this.loadLifecycleRow(lifecycleId);
    const serviceSlug = String(lc.service_slug ?? '');
    this.assertEnabled(serviceSlug);
    if (!this.playbooks.isEnabled()) {
      return {
        ok: true,
        service_slug: serviceSlug,
        active_slug: null,
        playbooks: [],
      };
    }
    const briefRow = await this.repo.getBrief(lifecycleId);
    return this.playbooks.listForLifecycle(serviceSlug, briefRow?.brief_json ?? null);
  }

  async applyPlaybook(
    lifecycleId: number,
    slug: string,
    body: MktAiPlaybookApplyBody,
    actorEmail: string,
  ): Promise<MktAiPlaybookApplyResult> {
    const lc = await this.loadLifecycleRow(lifecycleId);
    const serviceSlug = String(lc.service_slug ?? '');
    this.assertEnabled(serviceSlug);
    if (!this.playbooks.isEnabled()) {
      throw new NotFoundException({ error: 'mkt_ai_playbooks_disabled' });
    }

    const existing = await this.repo.getBrief(lifecycleId);
    return this.playbooks.mergeAndPersistPlaybook({
      lifecycleId,
      slug,
      serviceSlug,
      existingBrief: existing?.brief_json ?? null,
      confirmOverwrite: Boolean(body.confirm_overwrite),
      actorEmail,
      prefillSources: existing?.prefill_sources_json ?? [],
    });
  }

  private loadPlaybookPromptHints(brief: MktAiBrief, serviceSlug: string) {
    if (!this.playbooks.isEnabled()) return {};
    const playbook = this.playbooks.resolvePlaybook(brief._playbook_slug, serviceSlug);
    return this.playbooks.buildPromptHints(playbook);
  }

  async listDocuments(lifecycleId: number) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    if (!this.rag.isFeatureEnabled()) {
      return { documents: [] as const, rag_enabled: false };
    }
    const documents = await this.rag.listDocuments(lifecycleId);
    return { documents, rag_enabled: true };
  }

  async uploadDocument(
    lifecycleId: number,
    file: Express.Multer.File,
    actorEmail: string,
    tag?: string,
  ) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const document = await this.rag.uploadDocument(lifecycleId, file, actorEmail, tag);
    return { document };
  }

  async patchBrief(
    lifecycleId: number,
    patch: Record<string, unknown>,
    actorEmail: string,
  ): Promise<{
    brief: MktAiBrief;
    brief_validation: ReturnType<typeof validateMktAiBrief>;
    brief_readiness: ReturnType<typeof computeBriefReadiness>;
  }> {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));

    const existing = await this.repo.getBrief(lifecycleId);
    const merged = mergeBrief(existing?.brief_json ?? null, patch);
    if (!merged.service_slug) merged.service_slug = String(lc.service_slug ?? '');

    const validation = validateMktAiBrief(merged);
    await this.repo.upsertBrief(
      lifecycleId,
      merged,
      existing?.prefill_sources_json ?? [],
      actorEmail,
    );
    return {
      brief: merged,
      brief_validation: validation,
      brief_readiness: computeBriefReadiness(merged),
    };
  }

  async uploadBrief(
    lifecycleId: number,
    file: Express.Multer.File,
    actorEmail: string,
  ) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    const serviceSlug = String(lc.service_slug ?? '');
    this.assertEnabled(serviceSlug);

    const existing = await this.repo.getBrief(lifecycleId);
    const result = this.briefUpload.uploadBriefFile(
      file,
      existing?.brief_json ?? null,
      serviceSlug,
    );

    const prefill = existing?.prefill_sources_json ?? [];
    const sources = prefill.includes('brief-upload')
      ? prefill
      : [...prefill, 'brief-upload'];

    await this.repo.upsertBrief(lifecycleId, result.brief, sources, actorEmail);

    await this.runJob(lifecycleId, 'brief_summarize', actorEmail, async () => ({
      extracted_fields: result.extracted_fields,
      readiness_score: result.brief_readiness.score,
      filename: result.filename,
    }));

    return result;
  }

  async patchDraft(
    lifecycleId: number,
    patch: Partial<MktAiDraft>,
    actorEmail: string,
  ): Promise<MktAiDraft> {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));

    const current = await this.repo.ensureDraft(lifecycleId, actorEmail);
    const merged: MktAiDraft = {
      ...current,
      ...patch,
      strategy_framework: { ...current.strategy_framework, ...(patch.strategy_framework ?? {}) },
      target_market_prof: { ...current.target_market_prof, ...(patch.target_market_prof ?? {}) },
    };
    if (patch.kpi_tree_json !== undefined) {
      merged.kpi_tree_json = normalizeKpiTree(patch.kpi_tree_json);
    } else if (!merged.kpi_tree_json?.length) {
      merged.kpi_tree_json = [];
    }
    if (patch.kpi_tree_applied_json !== undefined) {
      merged.kpi_tree_applied_json = normalizeKpiTree(patch.kpi_tree_applied_json);
    }
    if (patch.competitor_snapshot_json !== undefined) {
      merged.competitor_snapshot_json = patch.competitor_snapshot_json;
    }
    await this.repo.upsertDraft(lifecycleId, merged, actorEmail);
    return merged;
  }

  private async requireBrief(lifecycleId: number): Promise<MktAiBrief> {
    const row = await this.repo.getBrief(lifecycleId);
    const brief = row?.brief_json ?? null;
    const validation = validateMktAiBrief(brief);
    if (!validation.ok) {
      throw new BadRequestException({
        error: 'brief_incomplete',
        missing: validation.missing,
        messages: validation.messages,
      });
    }
    return brief!;
  }

  private async runJob(
    lifecycleId: number,
    jobType: MktAiJobType,
    actorEmail: string,
    runner: (jobId: number) => Promise<Record<string, unknown>>,
  ): Promise<{ job_id: number; status: string; output?: Record<string, unknown> }> {
    // P0: jobs run synchronously in-request; poll via GET /context (async worker deferred).
    const started = Date.now();
    const modelName = this.orchestrator.modelName + (this.orchestrator.stubMode ? '-stub' : '');
    const job = await this.repo.createJob({
      lifecycle_id: lifecycleId,
      job_type: jobType,
      model_name: modelName,
      prompt_version: this.orchestrator.promptVersion,
      input_json: { lifecycle_id: lifecycleId },
      actor_email: actorEmail,
    });

    try {
      const output = await runner(job.id);
      const latency = Date.now() - started;
      await this.repo.finishJob(job.id, {
        status: 'succeeded',
        output_json: output,
        latency_ms: latency,
      });
      await this.auditAgentRun({
        lifecycleId,
        jobType,
        modelName,
        actorEmail,
        status: 'succeeded',
        latencyMs: latency,
        input: { lifecycle_id: lifecycleId, job_id: job.id },
        output,
      });
      return { job_id: job.id, status: 'succeeded', output };
    } catch (err) {
      const latency = Date.now() - started;
      const message = err instanceof Error ? err.message : String(err);
      await this.repo.finishJob(job.id, {
        status: 'failed',
        error_message: message,
        latency_ms: latency,
      });
      await this.auditAgentRun({
        lifecycleId,
        jobType,
        modelName,
        actorEmail,
        status: 'failed',
        latencyMs: latency,
        input: { lifecycle_id: lifecycleId, job_id: job.id },
        output: {},
        errorMessage: message,
      });
      throw new ServiceUnavailableException({
        error: 'mkt_ai_job_failed',
        job_id: job.id,
        job_type: jobType,
        message,
      });
    }
  }

  private async auditAgentRun(args: {
    lifecycleId: number;
    jobType: MktAiJobType;
    modelName: string;
    actorEmail: string;
    status: 'succeeded' | 'failed';
    latencyMs: number;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    errorMessage?: string;
  }): Promise<void> {
    try {
      if (!(await this.agentRuns.tableReady())) return;
      await this.agentRuns.insertRun({
        agentName: 'mkt_ai_planner',
        useCase: args.jobType,
        modelName: args.modelName,
        inputJson: args.input,
        outputJson: { ...args.output, lifecycle_id: args.lifecycleId },
        status: args.status,
        latencyMs: args.latencyMs,
        actorId: args.actorEmail,
        errorMessage: args.errorMessage ?? null,
      });
    } catch {
      /* audit optional when PG unavailable */
    }
  }

  async runStrategyJob(lifecycleId: number, actorEmail: string) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const brief = await this.requireBrief(lifecycleId);

    return this.runJob(lifecycleId, 'strategy_generate', actorEmail, async () => {
      const ragCtx = await this.rag.buildForStrategy(lifecycleId, brief);
      const ragCitations = ragCtx.enabled
        ? this.rag.attachCitations(ragCtx.chunks)
        : undefined;
      const playbookHints = this.loadPlaybookPromptHints(brief, String(lc.service_slug ?? ''));
      const out = await this.orchestrator.generateStrategy(brief, {
        ragPromptBlock: ragCtx.promptBlock,
        ragCitations,
        playbookPromptBlock: playbookHints.strategyBlock,
        stubSwotJson: playbookHints.stubSwotJson,
      });
      const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
      const competitorSnapshot = this.kpiClosedLoop.isEnabled()
        ? buildCompetitorSnapshotFromBrief(brief, this.orchestrator.stubMode ? 'stub' : 'ai')
        : draft.competitor_snapshot_json;
      await this.repo.upsertDraft(
        lifecycleId,
        {
          ...draft,
          strategy_framework: out.strategy_framework,
          target_market_prof: out.target_market_prof,
          swot_json: out.swot_json,
          ...(competitorSnapshot ? { competitor_snapshot_json: competitorSnapshot } : {}),
          quality_score_json: {
            ...draft.quality_score_json,
            ...(out.rag_citations ? { rag_citations: out.rag_citations } : {}),
          },
        },
        actorEmail,
      );
      return out as unknown as Record<string, unknown>;
    });
  }

  async runCampaignJob(lifecycleId: number, actorEmail: string) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const brief = await this.requireBrief(lifecycleId);

    return this.runJob(lifecycleId, 'campaign_generate', actorEmail, async () => {
      const playbookHints = this.loadPlaybookPromptHints(brief, String(lc.service_slug ?? ''));
      const campaigns = await this.orchestrator.generateCampaigns(brief, {
        playbookPromptBlock: playbookHints.campaignBlock,
      });
      const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
      const nextDraft: MktAiDraft = { ...draft, campaigns_json: campaigns };
      if (
        this.config.mktAiPlanDepthEnabled &&
        (!draft.kpi_tree_json?.length || !draft.kpi_tree_json[0]?.children?.length)
      ) {
        nextDraft.kpi_tree_json = suggestKpiTreeFromContext(brief, campaigns);
      }
      await this.repo.upsertDraft(lifecycleId, nextDraft, actorEmail);
      await this.repo.replaceCampaigns(lifecycleId, null, campaigns);
      return { campaigns } as Record<string, unknown>;
    });
  }

  async runContentJob(lifecycleId: number, actorEmail: string) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const brief = await this.requireBrief(lifecycleId);
    const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
    const campaigns = (draft.campaigns_json ?? []) as MktAiCampaignDraft[];

    return this.runJob(lifecycleId, 'content_generate', actorEmail, async () => {
      const out = await this.orchestrator.generateContent(brief, campaigns);
      await this.repo.upsertDraft(
        lifecycleId,
        { ...draft, content_json: out.content_json },
        actorEmail,
      );
      await this.repo.replaceContentAssets(lifecycleId, null, out.assets);
      return out as unknown as Record<string, unknown>;
    });
  }

  async runQualityJob(lifecycleId: number, actorEmail: string) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const briefRow = await this.repo.getBrief(lifecycleId);
    const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
    const quality = computeQualityScore(briefRow?.brief_json ?? null, draft, {
      planDepthEnabled: this.config.mktAiPlanDepthEnabled,
    });

    return this.runJob(lifecycleId, 'quality_score', actorEmail, async () => {
      const prevRag = draft.quality_score_json?.rag_citations;
      await this.repo.upsertDraft(
        lifecycleId,
        {
          ...draft,
          quality_score_json: {
            ...(quality as unknown as Record<string, unknown>),
            ...(prevRag ? { rag_citations: prevRag } : {}),
          },
        },
        actorEmail,
      );
      return quality as unknown as Record<string, unknown>;
    });
  }

  async runBudgetSimulateJob(
    lifecycleId: number,
    actorEmail: string,
    count = 3,
  ) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const brief = await this.requireBrief(lifecycleId);

    return this.runJob(lifecycleId, 'budget_simulate', actorEmail, async (jobId) => {
      const scenarios = await this.budget.simulate(lifecycleId, brief, jobId, count);
      return { scenarios, count: scenarios.length } as unknown as Record<string, unknown>;
    });
  }

  async applyBudgetScenario(lifecycleId: number, scenarioId: number, actorEmail: string) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
    const campaigns = (draft.campaigns_json ?? []) as MktAiCampaignDraft[];
    const applied = await this.budget.applyScenario(lifecycleId, scenarioId, campaigns, actorEmail);
    return applied;
  }

  async listApprovals(lifecycleId: number) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const approvals = await this.approval.listApprovals(lifecycleId);
    return { approvals };
  }

  async submitApproval(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    return this.approval.submitForApproval(lifecycleId, actorEmail, {
      label: body.label != null ? String(body.label) : undefined,
      note: body.note != null ? String(body.note) : undefined,
    });
  }

  async decideApproval(
    lifecycleId: number,
    approvalId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const decision = String(body.decision ?? '').trim();
    const mapped =
      decision === 'approve'
        ? 'approved'
        : decision === 'reject'
          ? 'rejected'
          : decision === 'changes_requested'
            ? 'changes_requested'
            : null;
    if (!mapped) {
      throw new BadRequestException({ error: 'invalid_decision', decision });
    }
    const approval = await this.approval.decideApproval(
      lifecycleId,
      approvalId,
      mapped,
      actorEmail,
      body.note != null ? String(body.note) : undefined,
    );
    return { approval };
  }

  async listComments(lifecycleId: number, planVersionId?: number) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const comments = await this.approval.listComments(lifecycleId, planVersionId);
    return { comments };
  }

  async createComment(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const comment = await this.approval.addComment(lifecycleId, actorEmail, {
      body: String(body.body ?? ''),
      plan_version_id: body.plan_version_id != null ? Number(body.plan_version_id) : undefined,
      approval_id: body.approval_id != null ? Number(body.approval_id) : undefined,
      anchor: (body.anchor as Record<string, unknown>) ?? undefined,
    });
    return { comment };
  }

  async listPlanVersions(lifecycleId: number) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const versions = await this.versions.listVersions(lifecycleId);
    return { versions };
  }

  async getPlanVersion(lifecycleId: number, versionId: number) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const version = await this.versions.getVersion(lifecycleId, versionId);
    return { version };
  }

  async restorePlanVersion(lifecycleId: number, versionId: number, actorEmail: string) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    const restored = await this.versions.restoreVersionToDraft(lifecycleId, versionId, actorEmail);
    return restored;
  }

  async retryJob(lifecycleId: number, jobType: string, actorEmail: string) {
    if (!RETRY_JOB_TYPES.includes(jobType as MktAiJobType)) {
      throw new BadRequestException({ error: 'invalid_job_type', job_type: jobType });
    }
    switch (jobType) {
      case 'strategy_generate':
        return this.runStrategyJob(lifecycleId, actorEmail);
      case 'campaign_generate':
        return this.runCampaignJob(lifecycleId, actorEmail);
      case 'content_generate':
        return this.runContentJob(lifecycleId, actorEmail);
      case 'quality_score':
        return this.runQualityJob(lifecycleId, actorEmail);
      default:
        throw new BadRequestException({ error: 'invalid_job_type' });
    }
  }

  async applyToTmmt(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));

    if (!body.confirm_overwrite) {
      throw new BadRequestException({ error: 'confirm_overwrite_required' });
    }

    const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
    const briefRow = await this.repo.getBrief(lifecycleId);
    const quality = computeQualityScore(briefRow?.brief_json ?? null, draft, {
      planDepthEnabled: this.config.mktAiPlanDepthEnabled,
    });
    if (!quality.can_apply) {
      throw new BadRequestException({
        error: 'quality_score_too_low',
        score: quality.score,
      });
    }

    const patchBody: Record<string, unknown> = {
      strategy_framework: body.strategy_framework ?? draft.strategy_framework,
      target_market_prof: body.target_market_prof ?? draft.target_market_prof,
    };

    let planPayload;
    try {
      planPayload = await this.lifecycle.patchMarketingPlan(lifecycleId, patchBody);
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw new ConflictException({
          error: 'no_official_marketing_plan',
          message: 'Chưa có Kế hoạch MKT chính thức — promote presales R5 trước khi apply.',
        });
      }
      throw err;
    }
    const jobResult = await this.runJob(lifecycleId, 'apply_to_tmmt', actorEmail, async () => ({
      applied: true,
      validation: planPayload.validation,
      quality_score: quality.score,
      quality_can_apply: quality.can_apply,
      quality_criteria: quality.criteria,
    }));

    if (draft.kpi_tree_json?.length) {
      await this.repo.upsertDraft(
        lifecycleId,
        {
          ...draft,
          kpi_tree_applied_json: normalizeKpiTree(draft.kpi_tree_json),
        },
        actorEmail,
      );
    }

    return {
      plan: planPayload.plan,
      tmmt_validation: planPayload.validation,
      filled_count: planPayload.filled_count,
      job_id: jobResult.job_id,
      quality_score: {
        score: quality.score,
        can_apply: quality.can_apply,
        criteria: quality.criteria,
      },
    };
  }

  async exportPlan(
    lifecycleId: number,
    format: string,
    actorEmail: string,
  ): Promise<MktAiExportFileResult> {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));

    const fmt = String(format ?? 'pdf').toLowerCase();
    if (!['pdf', 'docx', 'xlsx'].includes(fmt)) {
      throw new BadRequestException({ error: 'invalid_export_format', format: fmt });
    }

    const ctx = await this.getContext(lifecycleId);
    const score = ctx.quality_score?.score ?? 0;
    if (score < 60) {
      throw new BadRequestException({ error: 'quality_score_too_low', score });
    }
    if (ctx.quality_score?.can_export_docx_only && fmt !== 'docx') {
      throw new BadRequestException({ error: 'export_docx_only', score });
    }

    this.approval.assertExportAllowed(
      ctx.flags.approval_required,
      ctx.approval?.latest?.status,
    );

    const isDraftExport = !ctx.tmmt_validation.ok;
    const result = await this.exportService.buildExport({
      lifecycleId,
      ctx,
      format: fmt as 'pdf' | 'docx' | 'xlsx',
      isDraftExport,
    });

    await this.repo.createExport({
      lifecycle_id: lifecycleId,
      format: fmt,
      exported_by: actorEmail,
      quality_score: score,
    });

    return result;
  }

  getDashboard(
    lifecycleId: number,
    opts: { weeks?: number; channel?: string } = {},
  ): Promise<MktAiDashboardPayload> {
    return this.dashboard.getDashboard(lifecycleId, opts);
  }

  async runOptimizeJob(
    lifecycleId: number,
    body: MktAiOptimizeBody,
    actorEmail: string,
  ): Promise<MktAiOptimizeResult> {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));

    const jobResult = await this.runJob(lifecycleId, 'optimize', actorEmail, async () => {
      const payload = await this.optimize.execute(lifecycleId, body);
      return payload as unknown as Record<string, unknown>;
    });

    const output = (jobResult.output ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      job_id: jobResult.job_id,
      status: 'succeeded',
      kpi_context: output.kpi_context as MktAiOptimizeResult['kpi_context'],
      recommendations: (output.recommendations ?? []) as MktAiOptimizeResult['recommendations'],
      tasks_created: output.tasks_created as MktAiOptimizeResult['tasks_created'],
    };
  }

  getKpiAlertStatus() {
    return this.kpiAlerts.status();
  }

  runKpiAlertScan(opts: { dryRun?: boolean } = {}) {
    return this.kpiAlerts.runWeeklyScan(opts);
  }

  getKpiClosedLoopStatus() {
    return this.kpiClosedLoop.status();
  }

  getKpiClosedLoop(
    lifecycleId: number,
    opts: { weeks?: number; channel?: string } = {},
  ): Promise<MktAiKpiClosedLoopPayload> {
    return this.kpiClosedLoop.getClosedLoop(lifecycleId, opts);
  }

  getWeeklyMemoStatus() {
    return this.weeklyMemo.status();
  }

  runWeeklyMemoCron(opts: { dryRun?: boolean } = {}) {
    return this.weeklyMemo.runWeeklyCron(opts);
  }

  async runWeeklyMemoJob(
    lifecycleId: number,
    actorEmail: string,
    opts: {
      notify?: boolean;
      dry_run?: boolean;
      send_email?: boolean;
      email_customer?: boolean;
      notify_client?: boolean;
    } = {},
  ): Promise<MktAiWeeklyMemoResult> {
    rejectMktAiAutoCustomerEmail(this.config.mktAiAutoCustomerEmailEnabled, opts);
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));

    const jobResult = await this.runJob(lifecycleId, 'weekly_memo', actorEmail, async () => {
      const memo = await this.weeklyMemo.buildMemoForLifecycle(lifecycleId);
      let notificationSent = false;
      if (opts.notify !== false) {
        notificationSent = await this.weeklyMemo.maybeNotifyMemo(lifecycleId, memo, {
          dryRun: opts.dry_run === true,
        });
      }
      return this.weeklyMemo.wrapJobResult(memo, notificationSent) as unknown as Record<string, unknown>;
    });

    const output = (jobResult.output ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      job_id: jobResult.job_id,
      status: 'succeeded',
      memo: output.memo as MktAiWeeklyMemoResult['memo'],
      notification_sent: output.notification_sent as boolean | undefined,
    };
  }

  async runCompetitorSnapshotJob(lifecycleId: number, actorEmail: string) {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    if (!this.kpiClosedLoop.isEnabled()) {
      throw new NotFoundException({ error: 'mkt_ai_kpi_closed_loop_disabled' });
    }
    const brief = await this.requireBrief(lifecycleId);

    return this.runJob(lifecycleId, 'competitor_snapshot', actorEmail, async () => {
      const snapshot = buildCompetitorSnapshotFromBrief(
        brief,
        this.orchestrator.stubMode ? 'stub' : 'ai',
      );
      const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
      await this.repo.upsertDraft(
        lifecycleId,
        { ...draft, competitor_snapshot_json: snapshot },
        actorEmail,
      );
      return { competitor_snapshot: snapshot } as unknown as Record<string, unknown>;
    });
  }

  loadLifecyclePublic(id: number) {
    return this.loadLifecycleRow(id);
  }

  assertEnabledPublic(serviceSlug?: string) {
    return this.assertEnabled(serviceSlug);
  }

  getOrchestratorModelName() {
    return this.orchestrator.modelName;
  }

  isStubMode() {
    return this.orchestrator.stubMode;
  }

  async runMultiAgentJob(
    lifecycleId: number,
    body: MktAiMultiAgentBody,
    actorEmail: string,
  ): Promise<MktAiMultiAgentResult | MktAiMultiAgentAsyncResult> {
    return this.multiAgent.run(lifecycleId, body, actorEmail);
  }

  async getMultiAgentStatus(lifecycleId: number): Promise<MktAiMultiAgentStatusPayload> {
    return this.multiAgent.getStatus(lifecycleId);
  }

  async runStrategyScenariosJob(
    lifecycleId: number,
    actorEmail: string,
    count = 3,
  ): Promise<{ job_id: number; status: string; scenarios: MktAiStrategyScenarioRow[] }> {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    if (!this.strategyScenarios.isEnabled()) {
      throw new NotFoundException({ error: 'mkt_ai_scenario_compare_disabled' });
    }
    const brief = await this.requireBrief(lifecycleId);

    const job = await this.runJob(lifecycleId, 'strategy_scenarios', actorEmail, async (jobId) => {
      const scenarios = await this.strategyScenarios.executeGenerate(
        lifecycleId,
        count,
        jobId,
        brief,
      );
      return { scenarios, count: scenarios.length } as unknown as Record<string, unknown>;
    });
    return {
      job_id: job.job_id,
      status: job.status,
      scenarios: (job.output?.scenarios as MktAiStrategyScenarioRow[]) ?? [],
    };
  }

  listStrategyScenarios(lifecycleId: number) {
    return this.strategyScenarios.list(lifecycleId);
  }

  selectStrategyScenario(lifecycleId: number, scenarioId: number, actorEmail: string) {
    return this.strategyScenarios.selectScenario(lifecycleId, scenarioId, actorEmail);
  }

  compareStrategyScenarios(
    lifecycleId: number,
    scenarioAId: number,
    scenarioBId: number,
  ): Promise<MktAiStrategyScenarioComparePayload> {
    return this.strategyScenarios.compare(lifecycleId, scenarioAId, scenarioBId);
  }

  listSectionComments(lifecycleId: number, sectionKey?: string): Promise<MktAiSectionCommentRow[]> {
    return this.sectionComments.list(lifecycleId, sectionKey);
  }

  createSectionComment(
    lifecycleId: number,
    body: { section_key: string; body: string; mention_email?: string | null },
    actorEmail: string,
  ) {
    return this.sectionComments.create(lifecycleId, body, actorEmail);
  }

  async exportPptx(
    lifecycleId: number,
    body: MktAiPptxExportBody,
    actorEmail: string,
  ): Promise<MktAiExportFileResult> {
    if (!this.config.mktAiExportPptx) {
      throw new NotFoundException({ error: 'mkt_ai_export_pptx_disabled' });
    }
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));

    const ctx = await this.getContext(lifecycleId);
    const score = ctx.quality_score?.score ?? 0;
    if (score < 60) {
      throw new BadRequestException({ error: 'quality_score_too_low', score });
    }
    this.approval.assertExportAllowed(
      ctx.flags.approval_required,
      ctx.approval?.latest?.status,
    );

    const picked = body.sections?.length
      ? body.sections
      : (['strategy', 'campaign'] as const);
    const brand = ctx.brief?.brand_name ?? 'plan';
    const isDraftExport = !ctx.tmmt_validation.ok;
    const doc = buildExportDocument({
      lifecycleId,
      stage: ctx.stage,
      serviceSlug: ctx.service_slug,
      brand,
      qualityScore: score,
      isDraftExport,
      brief: ctx.brief,
      draft: ctx.draft,
    });
    const allSections = buildExportSections(doc);
    const sections = pickPptxSections(allSections, [...picked]);
    const buffer = await buildMarketingPlanPptx(sections);
    const filename = buildExportFilename(brand, 'pptx', isDraftExport);

    await this.repo.createExport({
      lifecycle_id: lifecycleId,
      format: 'pptx',
      exported_by: actorEmail,
      quality_score: score,
    });

    return {
      format: 'pptx',
      filename,
      content: buffer.toString('base64'),
      mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      encoding: 'base64',
    };
  }
}

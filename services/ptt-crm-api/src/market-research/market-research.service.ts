import { createHash } from 'crypto';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, dirname, resolve as resolvePath } from 'path';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ContentMarketingRepository } from '../content-marketing/content-marketing.repository';
import { ContentMarketingService } from '../content-marketing/content-marketing.service';
import { MarketingPlansSqliteRepository } from '../marketing-plans/marketing-plans-sqlite.repository';
import { OpsAlertPgRepository } from '../ops/ops-alert-pg.repository';
import { ClientScopeContext, StaffClientScopeService } from '../staff-client-scope/staff-client-scope.service';
import { JobQueueRepository } from '../webhooks/job-queue.repository';
import { lifecycleFromVelocity, snapshotFactDiff, velocity } from './pulse-signal.util';
import {
  APPROVED_INTERNAL_PLUS,
  INSIGHT_STATUSES,
  PROJECT_STATUSES,
  type InsightStatus,
  type ProjectStatus,
} from './market-research.constants';
import {
  buildInsightCopilotPrompt,
  buildReportCopilotPrompt,
  redactEvidenceForAiRunLog,
  toInsightCopilotEvidenceFields,
} from './market-research-copilot.prompt';
import { MarketResearchLlmService } from './market-research-llm.service';
import { MarketResearchRepository } from './market-research.repository';
import { evidenceChecksum } from './evidence-checksum.util';
import { assertEvidenceMutable, piiHint } from './evidence-immutable.util';
import { assertNoFakeConfidence, buildConfidenceJson } from './confidence-rubric.util';
import { assertSimilarwebTier, sanitizeCompetitorFact } from './competitor-snapshot.util';
import { assertNotSelfApprove, canApproveTarget, evaluateInsightGate, extractRubric } from './insight-gate.util';
import {
  assertConsentHasNoPii,
  assertExcerptNotRawTranscript,
  assertStudyIngestable,
  assertTranscriptLocator,
  defaultConsentExpiry,
} from './study-consent.util';
import { assertNoRawInPayload, excerptsFromTranscript } from './whisper-excerpt.util';
import { transcribeAudio } from './whisper-transcribe';
import { collectSparkToro } from './sparktoro-collect';
import { mapSparkToroResponse } from './sparktoro-mapper.util';
import { mapTalkwalkerResponse } from './talkwalker-mapper.util';
import { TALKWALKER_STUB_RESULTS } from './talkwalker-stub.util';
import { collectTalkwalker } from './talkwalker-collect';
import { collectQualtrics } from './qualtrics-collect';
import { resolveQualtricsColumnMap } from './qualtrics-map.util';
import type {
  ApproveInsightInput,
  CodebookEvidenceDraft,
  ConfidenceJson,
  ConfidenceRubric,
  CreateCompetitorInput,
  CreateCompetitorSnapshotInput,
  CreateConsentInput,
  CreateEvidenceInput,
  CreateInsightInput,
  CreateProjectInput,
  CreateStudyInput,
  CreateWaveInput,
  CreateDecisionInput,
  ResearchConsent,
  ResearchDecision,
  ResearchPrefill,
  ResearchStudy,
  ResearchWave,
  InsertPlanInsightsInput,
  MethodologyBlock,
  PlanInsightSnapshot,
  CreateQuestionInput,
  CreateReportInput,
  CreateReportResult,
  CreateSourceInput,
  PatchCompetitorInput,
  PatchDecisionInput,
  PatchStudyInput,
  InsightCopilotInput,
  InsightCopilotResult,
  CopilotRagHit,
  CopilotRagNote,
  ListProjectsFilters,
  OpsAnalyticsPayload,
  ThemeQuarterAnalyticsPayload,
  PatchEvidenceInput,
  PatchInsightInput,
  PatchProjectInput,
  PatchQuestionInput,
  PatchSourceInput,
  ReportCopilotInput,
  ReportCopilotResult,
  ResearchAiRunRow,
  ResearchCompetitorRow,
  ResearchCompetitorSnapshotRow,
  ResearchEvidenceRow,
  ResearchInsightRow,
  ResearchProjectDetail,
  ResearchProjectRow,
  ResearchQuestionRow,
  ResearchReportRow,
  ResearchReportVersionRow,
  ResearchSourceRow,
  PublishPortalInput,
  ResearchExportFormat,
  SurveyImportFormat,
  SurveyImportResult,
  UpdateExecEnInput,
  UpdateReportEmbargoInput,
  RunDeepInput,
  RunDeepResult,
  RunDeskInput,
  RunDeskResult,
  RunPulseInput,
  RunPulseResult,
  RunSparktoroInput,
  RunSparktoroResult,
  RunTalkwalkerInput,
  RunTalkwalkerResult,
  RagSearchResult,
  RagReembedInput,
  RagReembedPreviewResult,
  RagReembedStartResult,
  SearchInsightsInput,
  TaxonomyTheme,
  CreateTaxonomyInput,
  PatchTaxonomyInput,
  AttachInsightThemeInput,
  RunQualtricsInput,
  RunQualtricsResult,
  QualtricsColumnMapEntry,
  RunTriangulateResult,
  WhisperIngestResult,
  TrendSignal,
  SubmitReviewInput,
  ResearchCjSummaryRow,
  ResearchVwSummaryRow,
  CjWhatIfResult,
  CjWhatIfPersistResult,
  CjWhatIfRunRow,
  CjChoice,
  IsoGapCheckPayload,
} from './market-research.types';
import {
  CODEBOOK_LIMITATION,
  CONSENT_TYPES,
  DECISION_STATUSES,
  QUALTRICS_LIMITATION_NOTE,
  QUALTRICS_SURVEY_ID_RE,
  RAG_CORPUS_STATUSES,
  RAG_COPILOT_HIT_LIMIT,
  RAG_EMBED_DIMS,
  OPENAI_EMBED_DIMS,
  OPENAI_EMBED_MODEL,
  STUDY_METHODS,
  STUDY_MODES,
  SURVEY_IMPORT_FORMATS,
  VW_BASES,
} from './market-research.types';
import type { InsightEmbedResult } from './market-research.types';
import {
  isSurveyEvidenceLocator,
  parseCodebookCsv,
  parseConjointCsv,
  conjointDraftsFromChoices,
  parseVwCsv,
} from './survey-codebook.util';
import { choicesFromCjEvidence, computeConjointLite } from './conjoint-lite.util';
import { simulateConjointWhatIf as computeConjointWhatIf } from './conjoint-whatif.util';
import { buildIso20252GapCheck, summarizeIsoGapItems } from './iso20252-gap.util';
import { computeVanWestendorp, respondentsFromVwEvidence } from './van-westendorp.util';
import {
  embedInsightText,
  insightEmbedText,
  isRagCorpusStatus,
  parseRagStaleOnlyFlag,
  rankRagHits,
  shouldSkipRagEmbed,
} from './research-rag.util';
import { fetchOpenAIEmbedding } from './openai-embed.util';
import { shouldUsePgvectorAnn } from './pgvector.util';
import {
  buildCopilotRagQuery,
  shouldSkipCopilotRag,
  toCopilotRagHits,
} from './research-copilot-rag.util';
import { buildResearchReportDocx, sectionsFromReportSnapshot } from './market-research-docx.util';
import { buildResearchReportPdf } from './market-research-pdf.util';
import {
  REPORT_PDF_STALE_FOOTER_STAFF,
  reportSnapshotHasStaleInsights,
} from './report-pdf-stale.util';
import { collectReportInsightIds } from '../portal-research/portal-report-stale.util';
import { bakePublishedValidTo } from './report-publish-bake.util';
import {
  buildReportSnapshot,
  CB_METHODOLOGY_STUB,
  type ResearchReportSnapshot,
} from './market-research-report-snapshot.util';
import {
  validateCreateDecision,
  validateCreateEvidence,
  validateCreateProject,
  validateCreateWave,
  validateThemeCode,
} from './market-research.validation';
import { compareLatestWaves } from './wave-compare.util';
import { buildResearchPrefill, EMPTY_RESEARCH_PREFILL, stripPrefillPii } from './research-prefill.util';
import { enrichThemeQuarterRows } from './theme-quarter-delta.util';
import { assertMethodologyExportable } from './methodology-gate.util';
import { assertExecEnEditable, normalizeReportExec } from './report-exec.util';
import { assertPublishableInsights } from './portal-publish.util';
import { CONTENT_RESEARCH_BRIEF_KEY, freezeContentInsights } from './content-insight-snapshot.util';
import { assertNoInsightTextLeak, freezePlanInsights } from './plan-insight-snapshot.util';
import { completenessPct, percentile50 } from './ops-analytics.util';
import { canTransitionProject, listValidTransitions } from './project-state.util';

@Injectable()
export class MarketResearchService implements OnModuleInit {
  private ragPgvectorReady = false;
  private ragIvfflatReady = false;

  constructor(
    private readonly repo: MarketResearchRepository,
    private readonly clientScope: StaffClientScopeService,
    private readonly jobQueue: JobQueueRepository,
    private readonly config: AppConfigService,
    private readonly llm: MarketResearchLlmService,
    private readonly plans: MarketingPlansSqliteRepository,
    private readonly opsAlerts: OpsAlertPgRepository,
    private readonly contentItems: ContentMarketingRepository,
    private readonly contentMarketing: ContentMarketingService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.ragPgvectorReady = await this.repo.probePgvectorReady();
    } catch {
      this.ragPgvectorReady = false;
    }
    try {
      this.ragIvfflatReady = await this.repo.probeIvfflatReady();
    } catch {
      this.ragIvfflatReady = false;
    }
  }

  health(): {
    ok: true;
    enabled: true;
    deep_provider: string;
    sparktoro_enabled: boolean;
    qualtrics_enabled: boolean;
    talkwalker_enabled: boolean;
    talkwalker_live_enabled: boolean;
    rag_enabled: boolean;
    rag_openai_embed_enabled: boolean;
    rag_embed_model: 'openai' | 'local';
    rag_pgvector_enabled: boolean;
    rag_pgvector_ready: boolean;
    rag_ivfflat_ready: boolean;
  } {
    const sparktoroKey = String(this.config.sparktoroApiKey ?? '').trim();
    const qualtricsKey = String(this.config.qualtricsApiKey ?? '').trim();
    const qualtricsDc = String(this.config.qualtricsDatacenter ?? '').trim();
    const talkwalkerToken = String(this.config.talkwalkerAccessToken ?? '').trim();
    const talkwalkerProjectId = String(this.config.talkwalkerProjectId ?? '').trim();
    const openaiKey = (process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY ?? '').trim();
    const openaiEmbedLive = Boolean(this.config.researchRagOpenaiEmbedEnabled && openaiKey);
    return {
      ok: true,
      enabled: true,
      deep_provider: this.config.researchDeepProvider,
      sparktoro_enabled: Boolean(this.config.researchSparktoroEnabled && sparktoroKey),
      qualtrics_enabled: Boolean(
        this.config.researchQualtricsEnabled && qualtricsKey && qualtricsDc,
      ),
      talkwalker_enabled: Boolean(this.config.researchTalkwalkerEnabled && talkwalkerToken),
      talkwalker_live_enabled: Boolean(
        this.config.researchTalkwalkerEnabled && talkwalkerToken && talkwalkerProjectId,
      ),
      rag_enabled: Boolean(this.config.researchRagEnabled),
      rag_openai_embed_enabled: openaiEmbedLive,
      rag_embed_model: openaiEmbedLive ? 'openai' : 'local',
      rag_pgvector_enabled: Boolean(this.config.researchRagPgvectorEnabled),
      rag_pgvector_ready: this.ragPgvectorReady,
      rag_ivfflat_ready: this.ragIvfflatReady,
    };
  }

  private openaiEmbedLive(): boolean {
    const key = (process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY ?? '').trim();
    return Boolean(this.config.researchRagOpenaiEmbedEnabled && key);
  }

  private async resolveInsightEmbedding(text: string): Promise<InsightEmbedResult> {
    if (!this.openaiEmbedLive()) {
      return { embedding: embedInsightText(text), model: 'local-hash', dims: RAG_EMBED_DIMS };
    }
    const key = (process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY ?? '').trim();
    return fetchOpenAIEmbedding({ text, apiKey: key });
  }

  private deepFallbackProvider(): string {
    return this.config.researchDeepProvider === 'gemini'
      ? 'gemini_fallback_tavily'
      : 'openai_fallback_tavily';
  }

  private assertClientInScope(scope: ClientScopeContext, clientId: string): void {
    if (!scope.restricted) return;
    const allowed = this.clientScope.allowedClientIdsForList(scope) ?? [];
    if (!allowed.includes(clientId.trim())) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
  }

  private async loadScopedProject(
    id: number,
    scope: ClientScopeContext,
  ): Promise<ResearchProjectRow> {
    const clientId = await this.repo.getProjectClientId(id);
    if (clientId == null) throw new NotFoundException({ error: 'not_found' });
    this.assertClientInScope(scope, clientId);
    const project = await this.repo.getProject(id);
    if (!project) throw new NotFoundException({ error: 'not_found' });
    return project;
  }

  async listApprovedInsightsForClient(
    scope: ClientScopeContext,
    clientId: string,
  ): Promise<{ insights: ResearchInsightRow[] }> {
    const cid = String(clientId ?? '').trim();
    if (!cid) {
      throw new BadRequestException({ error: 'validation_error', messages: ['client_id is required'] });
    }
    this.assertClientInScope(scope, cid);
    const insights = await this.repo.listApprovedInsightsByClient(cid);
    return { insights };
  }

  async insertPlanInsights(
    planId: number,
    scope: ClientScopeContext,
    input: InsertPlanInsightsInput,
    actor: string,
  ): Promise<{ ok: true; snapshot: PlanInsightSnapshot }> {
    const clientId = String(input.client_id ?? '').trim();
    if (!clientId) {
      throw new BadRequestException({ error: 'validation_error', messages: ['client_id is required'] });
    }
    this.assertClientInScope(scope, clientId);

    const plan = this.plans.getPlanById(planId);
    if (!plan) throw new NotFoundException({ error: 'not_found' });

    const insightIds = normalizePositiveIds(input.insight_ids);
    if (insightIds.length === 0) {
      throw new BadRequestException({ error: 'validation_error', messages: ['insight_ids is required'] });
    }

    for (const id of insightIds) {
      const insight = await this.loadScopedInsight(id, scope);
      const insightClientId = await this.repo.getProjectClientId(insight.project_id);
      if (insightClientId !== clientId) {
        throw new BadRequestException({ error: 'client_mismatch' });
      }
      if (!APPROVED_INTERNAL_PLUS.includes(insight.status)) {
        throw new BadRequestException({ error: 'insight_not_approved' });
      }
    }

    const snapshot = freezePlanInsights({
      client_id: clientId,
      insight_ids: insightIds,
      inserted_by: actor,
    });
    assertNoInsightTextLeak(snapshot);
    this.plans.patchPlan(planId, { khtn_market_research_json: JSON.stringify(snapshot) });
    return { ok: true, snapshot };
  }

  async insertContentInsights(
    itemId: number,
    scope: ClientScopeContext,
    input: InsertPlanInsightsInput,
    actor: string,
  ): Promise<{ ok: true; snapshot: PlanInsightSnapshot }> {
    const clientId = String(input.client_id ?? '').trim();
    if (!clientId) {
      throw new BadRequestException({ error: 'validation_error', messages: ['client_id is required'] });
    }
    this.assertClientInScope(scope, clientId);

    const item = await this.contentItems.findItemById(itemId);
    if (!item) throw new NotFoundException({ error: 'not_found' });

    const lifecycleClientId = await this.contentMarketing.getLifecycleClientId(item.lifecycle_id);
    if (lifecycleClientId) {
      this.assertClientInScope(scope, lifecycleClientId);
    } else {
      throw new BadRequestException({ error: 'content_item_no_client' });
    }
    if (clientId !== lifecycleClientId) {
      throw new BadRequestException({ error: 'content_item_client_mismatch' });
    }

    if (item.status === 'published' || item.status === 'archived') {
      throw new BadRequestException({ error: 'item_locked', status: item.status });
    }

    const insightIds = normalizePositiveIds(input.insight_ids);
    if (insightIds.length === 0) {
      throw new BadRequestException({ error: 'validation_error', messages: ['insight_ids is required'] });
    }

    for (const id of insightIds) {
      const insight = await this.loadScopedInsight(id, scope);
      const insightClientId = await this.repo.getProjectClientId(insight.project_id);
      if (insightClientId !== clientId) {
        throw new BadRequestException({ error: 'client_mismatch' });
      }
      if (!APPROVED_INTERNAL_PLUS.includes(insight.status)) {
        throw new BadRequestException({ error: 'insight_not_approved' });
      }
    }

    const snapshot = freezeContentInsights({
      client_id: clientId,
      insight_ids: insightIds,
      inserted_by: actor,
    });
    assertNoInsightTextLeak(snapshot);
    const brief_json = {
      ...(item.brief_json ?? {}),
      [CONTENT_RESEARCH_BRIEF_KEY]: snapshot,
    };
    await this.contentItems.patchItem(item.lifecycle_id, itemId, { brief_json });
    return { ok: true, snapshot };
  }

  async listProjects(
    scope: ClientScopeContext,
    filters: ListProjectsFilters,
  ): Promise<{ projects: ResearchProjectRow[] }> {
    if (filters.client_id?.trim()) {
      this.clientScope.assertListClientFilter(scope, filters.client_id);
    }
    const allowed = this.clientScope.allowedClientIdsForList(scope);
    const projects = await this.repo.listProjects(filters, allowed);
    return { projects };
  }

  async getOpsAnalytics(scope: ClientScopeContext, clientId?: string): Promise<OpsAnalyticsPayload> {
    const cid = clientId?.trim();
    if (cid) {
      try {
        this.clientScope.assertListClientFilter(scope, cid);
      } catch {
        throw new ForbiddenException({ error: 'forbidden' });
      }
    }
    const allowed = this.clientScope.allowedClientIdsForList(scope);
    const raw = await this.repo.getOpsAnalytics(cid ? { client_id: cid } : {}, allowed);
    const projects = allowed
      ? raw.projects.filter((row) => allowed.includes(row.client_id))
      : raw.projects;
    return {
      cycle_time_hours: {
        designed_to_approved_p50: percentile50(raw.cycleHours),
        sample: raw.cycleHours.length,
      },
      evidence_completeness: {
        projects: raw.totalProjects,
        with_verified_pct: completenessPct(raw.totalProjects, raw.withVerified),
      },
      activation: {
        distributed_projects: raw.distributedProjects,
        approved_reports: raw.approvedReports,
      },
      projects,
    };
  }

  async getThemeQuarterAnalytics(
    scope: ClientScopeContext,
    opts?: { client_id?: string; year?: number },
  ): Promise<ThemeQuarterAnalyticsPayload> {
    const cid = opts?.client_id?.trim();
    if (cid) {
      try {
        this.clientScope.assertListClientFilter(scope, cid);
      } catch {
        throw new ForbiddenException({ error: 'forbidden' });
      }
    }
    const year = opts?.year ?? new Date().getUTCFullYear();
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException({ error: 'invalid_year' });
    }
    const allowed = this.clientScope.allowedClientIdsForList(scope);
    const filters = { client_id: cid, year };
    const currentRows = await this.repo.getThemeQuarterAnalytics(filters, allowed);
    const priorYearRows =
      year > 2000
        ? await this.repo.getThemeQuarterAnalytics({ client_id: cid, year: year - 1 }, allowed)
        : [];
    const rows = enrichThemeQuarterRows(currentRows, priorYearRows);
    return {
      ok: true,
      year,
      client_id: cid ?? null,
      corpus_statuses: RAG_CORPUS_STATUSES,
      rows,
    };
  }

  async getPrefill(scope: ClientScopeContext, clientId: string): Promise<ResearchPrefill> {
    const cid = String(clientId ?? '').trim();
    if (!cid) return { ...EMPTY_RESEARCH_PREFILL };
    this.assertClientInScope(scope, cid);
    const formData = await this.repo.findConsultFormDataByClientId(cid);
    if (!formData) return { ...EMPTY_RESEARCH_PREFILL };
    return buildResearchPrefill(formData);
  }

  async createProject(
    scope: ClientScopeContext,
    input: CreateProjectInput,
    actor: string,
  ): Promise<{ ok: true; project: ResearchProjectDetail }> {
    const messages = validateCreateProject(input);
    if (messages.length) {
      throw new BadRequestException({ error: 'validation_error', messages });
    }
    this.assertClientInScope(scope, input.client_id);
    const project = await this.repo.createProject(input, actor);
    const names = Array.isArray(input.prefill_competitors) ? input.prefill_competitors : [];
    for (const raw of names) {
      const name = stripPrefillPii(String(raw ?? '')).slice(0, 200);
      if (!name) continue;
      await this.repo.createCompetitor(project.id, { name, aliases: [] }, actor);
    }
    return { ok: true, project: await this.toDetail(project) };
  }

  async getProject(id: number, scope: ClientScopeContext): Promise<ResearchProjectDetail> {
    const project = await this.loadScopedProject(id, scope);
    return this.toDetail(project);
  }

  async getIsoGapCheck(projectId: number, scope: ClientScopeContext): Promise<IsoGapCheckPayload> {
    const project = await this.loadScopedProject(projectId, scope);
    const facts = await this.repo.getIsoGapFacts(projectId);
    if (!facts) throw new NotFoundException({ error: 'not_found' });
    const items = buildIso20252GapCheck({
      project: {
        decision_statement: facts.decision_statement,
        product_type: facts.product_type,
        dv12_tier: facts.dv12_tier,
        geo: facts.geo,
      },
      rq_count: facts.rq_count,
      source_count: facts.source_count,
      verified_evidence_count: facts.verified_evidence_count,
      study_count: facts.study_count,
      ai_run_count: facts.ai_run_count,
      insight_counts: {
        draft: facts.draft_count,
        published: facts.published_count,
        approved_client_facing: facts.acf_count,
      },
      acf_with_verified_evidence: facts.acf_with_verified_evidence,
      review_count: facts.review_count,
      latest_report:
        facts.report_version_count > 0
          ? {
              methodology: facts.latest_report_methodology ?? undefined,
              findings_count: facts.latest_report_findings_count,
            }
          : null,
    });
    return {
      ok: true,
      project_id: project.id,
      product_type: project.product_type,
      items,
      summary: summarizeIsoGapItems(items),
    };
  }

  async patchProject(
    id: number,
    scope: ClientScopeContext,
    input: PatchProjectInput,
    actor: string,
  ): Promise<ResearchProjectDetail> {
    const project = await this.loadScopedProject(id, scope);
    if (input.status != null && input.status !== project.status) {
      if (!PROJECT_STATUSES.includes(input.status as ProjectStatus)) {
        throw new ConflictException({
          error: 'invalid_transition',
          reason: `${project.status}->${input.status}`,
        });
      }
      const result = canTransitionProject(project.status, input.status as ProjectStatus, {
        rqCount: project.rq_count,
        verifiedInsightCount: project.verified_insight_count,
      });
      if (!result.ok) {
        throw new ConflictException({ error: result.error, reason: result.reason });
      }
    }
    const updated = await this.repo.patchProject(id, input, actor);
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return this.toDetail(updated);
  }

  async addQuestion(
    projectId: number,
    scope: ClientScopeContext,
    input: CreateQuestionInput,
  ): Promise<ResearchQuestionRow> {
    await this.loadScopedProject(projectId, scope);
    if (!String(input.question_vi ?? '').trim()) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['question_vi is required'],
      });
    }
    return this.repo.addQuestion(projectId, input);
  }

  async patchQuestion(
    questionId: number,
    scope: ClientScopeContext,
    input: PatchQuestionInput,
  ): Promise<ResearchQuestionRow> {
    const existing = await this.repo.getQuestion(questionId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    if (input.question_vi != null && !input.question_vi.trim()) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['question_vi is required'],
      });
    }
    const updated = await this.repo.patchQuestion(questionId, input);
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async deleteQuestion(questionId: number, scope: ClientScopeContext): Promise<{ ok: true }> {
    const existing = await this.repo.getQuestion(questionId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    const evidenceCount = await this.repo.countEvidenceForQuestion(questionId);
    if (evidenceCount > 0) {
      throw new ConflictException({ error: 'question_has_evidence' });
    }
    await this.repo.deleteQuestion(questionId);
    return { ok: true };
  }

  async createSource(
    projectId: number,
    scope: ClientScopeContext,
    input: CreateSourceInput,
  ): Promise<ResearchSourceRow> {
    await this.loadScopedProject(projectId, scope);
    if (!String(input.title ?? '').trim()) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['title is required'],
      });
    }
    return this.repo.createSource(projectId, input);
  }

  async patchSource(
    sourceId: number,
    scope: ClientScopeContext,
    input: PatchSourceInput,
  ): Promise<ResearchSourceRow> {
    const existing = await this.repo.getSource(sourceId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    if (typeof input.keep !== 'boolean') {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['keep is required'],
      });
    }
    const updated = await this.repo.patchSourceKeep(sourceId, input.keep);
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async listCompetitors(
    projectId: number,
    scope: ClientScopeContext,
  ): Promise<{ competitors: ResearchCompetitorRow[] }> {
    await this.loadScopedProject(projectId, scope);
    const competitors = await this.repo.listCompetitors(projectId);
    return { competitors };
  }

  async createCompetitor(
    projectId: number,
    scope: ClientScopeContext,
    input: CreateCompetitorInput,
    actor: string,
  ): Promise<ResearchCompetitorRow> {
    await this.loadScopedProject(projectId, scope);
    if (!String(input.name ?? '').trim()) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['name is required'],
      });
    }
    return this.repo.createCompetitor(projectId, {
      name: String(input.name).trim().slice(0, 200),
      aliases: this.sanitizeAliases(input.aliases),
    }, actor);
  }

  async patchCompetitor(
    competitorId: number,
    scope: ClientScopeContext,
    input: PatchCompetitorInput,
  ): Promise<ResearchCompetitorRow> {
    const existing = await this.repo.getCompetitor(competitorId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    if (input.name != null && !String(input.name).trim()) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['name is required'],
      });
    }
    const updated = await this.repo.patchCompetitor(competitorId, {
      name: input.name != null ? String(input.name).trim().slice(0, 200) : undefined,
      aliases: input.aliases != null ? this.sanitizeAliases(input.aliases) : undefined,
    });
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async createSnapshot(
    competitorId: number,
    scope: ClientScopeContext,
    input: CreateCompetitorSnapshotInput,
    actor: string,
  ): Promise<ResearchCompetitorSnapshotRow> {
    const existing = await this.repo.getCompetitor(competitorId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    const sourceId = Number(input.source_id);
    if (!Number.isFinite(sourceId) || sourceId <= 0) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['source_id is required'],
      });
    }
    const observedAt = String(input.observed_at ?? '').trim();
    if (!observedAt) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['observed_at is required'],
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(observedAt) || Number.isNaN(Date.parse(observedAt))) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['observed_at must be YYYY-MM-DD'],
      });
    }
    const kind = String(input.kind ?? '').trim();
    if (kind !== 'fact' && kind !== 'hypothesis') {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['kind must be fact or hypothesis'],
      });
    }
    const source = await this.assertSourceInProject(existing.project_id, sourceId);
    if (!source) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['source_id is invalid'],
      });
    }
    const limitation_note = input.limitation_note ?? null;
    try {
      assertSimilarwebTier({
        publisher: source.publisher,
        url: source.url,
        reliability_tier: this.effectiveSimilarwebTier(source),
        limitation_note,
      });
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === 'reliability_capped' || code === 'limitation_required') {
        throw new BadRequestException({ error: code, messages: [code] });
      }
      throw err;
    }
    return this.repo.createCompetitorSnapshot(
      competitorId,
      existing.project_id,
      {
        source_id: sourceId,
        observed_at: observedAt,
        kind,
        fact: sanitizeCompetitorFact(input.fact),
        limitation_note,
      },
      actor,
    );
  }

  async listStudies(
    projectId: number,
    scope: ClientScopeContext,
  ): Promise<{ studies: ResearchStudy[] }> {
    await this.loadScopedProject(projectId, scope);
    const studies = await this.repo.listStudies(projectId);
    return { studies };
  }

  async createStudy(
    projectId: number,
    scope: ClientScopeContext,
    input: CreateStudyInput,
    actor: string,
  ): Promise<ResearchStudy> {
    await this.loadScopedProject(projectId, scope);
    const name = String(input.name ?? '').trim();
    if (!name) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['name is required'],
      });
    }
    const method = String(input.method ?? '').trim();
    if (!STUDY_METHODS.includes(method as (typeof STUDY_METHODS)[number])) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['method is invalid'],
      });
    }
    return this.repo.createStudy(
      projectId,
      {
        name: name.slice(0, 200),
        method,
        n: this.optionalPositiveInt(input.n),
        field_start: this.optionalDate(input.field_start, 'field_start'),
        field_end: this.optionalDate(input.field_end, 'field_end'),
        mode: this.optionalStudyMode(input.mode),
        instrument_version: this.optionalText(input.instrument_version),
        weighting_note: this.optionalText(input.weighting_note),
      },
      actor,
    );
  }

  async importSurvey(
    projectId: number,
    scope: ClientScopeContext,
    input: {
      csvText: string;
      format: string;
      studyId?: number | null;
      expertReview?: string | null;
      periodNote?: string | null;
      geography?: string | null;
      unit?: string | null;
    },
    actor: string,
  ): Promise<SurveyImportResult> {
    await this.loadScopedProject(projectId, scope);
    const format = String(input.format ?? '').trim().toLowerCase();
    if (!SURVEY_IMPORT_FORMATS.includes(format as SurveyImportFormat)) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['format is invalid'],
      });
    }

    let drafts: CodebookEvidenceDraft[];
    try {
      if (format === 'vw') {
        drafts = this.draftsFromVw(input);
      } else if (format === 'conjoint') {
        drafts = this.draftsFromConjoint(input);
      } else {
        drafts = parseCodebookCsv(input.csvText);
      }
    } catch (err) {
      this.rethrowUtilCode(err, [
        'survey_pii_forbidden',
        'codebook_csv_invalid',
        'codebook_row_cap',
        'cj_too_few_attributes',
        'cj_too_many_attributes',
      ]);
    }

    if (!drafts.length) {
      throw new BadRequestException({
        error: 'codebook_csv_invalid',
        messages: ['codebook_csv_invalid'],
      });
    }

    for (const draft of drafts) {
      const messages = validateCreateEvidence({
        study_id: 1,
        source_id: 1,
        locator: draft.locator,
        value_num: draft.value_num,
        unit: draft.unit,
        value_base: draft.value_base,
        period_note: draft.period_note,
        geography: draft.geography,
      });
      if (messages.length) {
        throw new BadRequestException({ error: 'validation_error', messages });
      }
    }

    const study = await this.resolveImportStudy(projectId, scope, input.studyId, actor);
    const expert = String(input.expertReview ?? '').trim();
    const { source_id, evidence_ids, n } = await this.persistCodebookDrafts({
      projectId,
      study,
      drafts,
      publisher: 'Forms',
      limitationNote: expert || CODEBOOK_LIMITATION,
      aiGenerated: false,
      actor,
      scope,
    });
    return {
      ok: true,
      study_id: study.id,
      source_id,
      evidence_ids,
      n,
    };
  }

  private async persistCodebookDrafts(input: {
    projectId: number;
    study: ResearchStudy;
    drafts: CodebookEvidenceDraft[];
    publisher: 'Qualtrics' | 'Forms';
    limitationNote: string;
    aiGenerated: boolean;
    actor: string;
    scope: ClientScopeContext;
  }): Promise<{ source_id: number; evidence_ids: number[]; n: number }> {
    for (const draft of input.drafts) {
      const messages = validateCreateEvidence({
        study_id: input.study.id,
        source_id: 1,
        locator: draft.locator,
        value_num: draft.value_num,
        unit: draft.unit,
        value_base: draft.value_base,
        period_note: draft.period_note,
        geography: draft.geography,
      });
      if (messages.length) {
        throw new BadRequestException({ error: 'validation_error', messages });
      }
    }
    const source = await this.createSource(input.projectId, input.scope, {
      title: input.study.name,
      publisher: input.publisher,
      reliability_tier: 'medium',
      limitation_note: input.limitationNote,
      ai_generated: input.aiGenerated,
    });
    const evidence_ids: number[] = [];
    for (const draft of input.drafts) {
      const ev = await this.createEvidence(
        input.projectId,
        input.scope,
        {
          study_id: input.study.id,
          source_id: source.id,
          locator: draft.locator,
          value_num: draft.value_num,
          unit: draft.unit,
          value_base: draft.value_base,
          period_note: draft.period_note,
          geography: draft.geography,
        },
        input.actor,
      );
      evidence_ids.push(ev.id);
    }
    const n = new Set(input.drafts.map((d) => d.respondent_id)).size;
    await this.patchStudy(input.study.id, input.scope, { n });
    return { source_id: source.id, evidence_ids, n };
  }

  private draftsFromVw(input: {
    csvText: string;
    periodNote?: string | null;
    geography?: string | null;
    unit?: string | null;
  }): CodebookEvidenceDraft[] {
    const unit = String(input.unit ?? '').trim() || 'VND';
    const period_note = String(input.periodNote ?? '').trim();
    const geography = String(input.geography ?? '').trim();
    const respondents = parseVwCsv(input.csvText);
    const drafts: CodebookEvidenceDraft[] = [];
    for (const row of respondents) {
      for (const base of VW_BASES) {
        drafts.push({
          locator: `R-${row.respondent_id}:${base}`,
          value_num: row[base],
          unit,
          value_base: base,
          period_note,
          geography,
          respondent_id: row.respondent_id,
        });
      }
    }
    return drafts;
  }

  private draftsFromConjoint(input: {
    csvText: string;
    periodNote?: string | null;
    geography?: string | null;
  }): CodebookEvidenceDraft[] {
    const period_note = String(input.periodNote ?? '').trim();
    const geography = String(input.geography ?? '').trim();
    const choices = parseConjointCsv(input.csvText);
    return conjointDraftsFromChoices(choices, period_note, geography);
  }

  private async resolveImportStudy(
    projectId: number,
    scope: ClientScopeContext,
    studyId: number | null | undefined,
    actor: string,
  ): Promise<ResearchStudy> {
    if (studyId != null && String(studyId).trim() !== '') {
      const id = Number(studyId);
      if (!Number.isInteger(id) || id < 1) {
        throw new BadRequestException({
          error: 'validation_error',
          messages: ['study_id is invalid'],
        });
      }
      const existing = await this.repo.getStudy(id);
      if (!existing || existing.project_id !== projectId || existing.method !== 'survey') {
        throw new BadRequestException({
          error: 'validation_error',
          messages: ['study_id is invalid'],
        });
      }
      return existing;
    }
    const utcDate = new Date().toISOString().slice(0, 10);
    return this.createStudy(
      projectId,
      scope,
      { name: `Codebook ${utcDate}`, method: 'survey' },
      actor,
    );
  }

  private assertTracker(project: ResearchProjectRow): void {
    if (project.product_type !== 'TRACKER') {
      throw new BadRequestException({ error: 'waves_not_tracker' });
    }
  }

  private assertPriceOffer(project: ResearchProjectRow): void {
    if (project.product_type !== 'PRICE_OFFER') {
      throw new BadRequestException({ error: 'vw_not_price_offer' });
    }
  }

  private assertPriceOfferConjoint(project: ResearchProjectRow): void {
    if (project.product_type !== 'PRICE_OFFER') {
      throw new BadRequestException({ error: 'cj_not_price_offer' });
    }
  }

  private async loadConjointChoices(
    projectId: number,
    input: { study_id?: number | null },
  ): Promise<{ choices: CjChoice[]; studyId: number | null }> {
    let studyId: number | null = null;
    if (input.study_id != null && String(input.study_id).trim() !== '') {
      const id = Number(input.study_id);
      if (!Number.isInteger(id) || id < 1) {
        throw new BadRequestException({
          error: 'validation_error',
          messages: ['study_id is invalid'],
        });
      }
      const existing = await this.repo.getStudy(id);
      if (!existing || existing.project_id !== projectId || existing.method !== 'survey') {
        throw new BadRequestException({
          error: 'validation_error',
          messages: ['study_id is invalid'],
        });
      }
      studyId = id;
    }

    const evidence = await this.repo.listEvidence(projectId);
    let rows = evidence.filter((row) => String(row.locator ?? '').trim().startsWith('C-'));
    if (studyId == null) {
      const studies = await this.repo.listStudies(projectId);
      const surveyIds = new Set(
        studies.filter((study) => study.method === 'survey').map((study) => study.id),
      );
      const candidateIds = [
        ...new Set(
          rows
            .map((row) => row.study_id)
            .filter((id): id is number => id != null && surveyIds.has(id)),
        ),
      ].sort((a, b) => b - a);
      studyId = candidateIds[0] ?? null;
    }
    rows = studyId != null ? rows.filter((row) => row.study_id === studyId) : [];

    return {
      studyId,
      choices: choicesFromCjEvidence(
        rows.map((row) => ({
          value_num: row.value_num,
          value_base: String(row.value_base ?? ''),
          locator: String(row.locator ?? ''),
          unit: row.unit != null ? String(row.unit) : null,
        })),
      ),
    };
  }

  async getConjoint(
    projectId: number,
    scope: ClientScopeContext,
  ): Promise<{ summary: ResearchCjSummaryRow | null }> {
    await this.loadScopedProject(projectId, scope);
    const summary = await this.repo.getLatestCjSummary(projectId);
    return { summary: summary ?? null };
  }

  async createConjoint(
    projectId: number,
    scope: ClientScopeContext,
    input: { study_id?: number | null },
    actor: string,
  ): Promise<ResearchCjSummaryRow> {
    const project = await this.loadScopedProject(projectId, scope);
    this.assertPriceOfferConjoint(project);

    const { choices, studyId } = await this.loadConjointChoices(projectId, input);

    let computed: ReturnType<typeof computeConjointLite>;
    try {
      computed = computeConjointLite(choices);
    } catch (err) {
      this.rethrowUtilCode(err, [
        'cj_insufficient_n',
        'cj_insufficient_choices',
        'cj_too_few_attributes',
        'cj_too_many_attributes',
        'forbidden_confidence_wording',
      ]);
    }

    return this.repo.insertCjSummary(
      projectId,
      {
        study_id: studyId,
        n: computed.n,
        n_choices: computed.n_choices,
        attributes: computed.attributes,
        recommendation: computed.recommendation,
        limitation_note: computed.limitation_note,
        statistical_inference: false,
      },
      actor,
    );
  }

  async simulateConjointWhatIf(
    projectId: number,
    scope: ClientScopeContext,
    input: { study_id?: number | null; scenario?: Record<string, string>; persist?: boolean },
    actor?: string,
  ): Promise<CjWhatIfPersistResult> {
    const project = await this.loadScopedProject(projectId, scope);
    this.assertPriceOfferConjoint(project);
    const { choices, studyId } = await this.loadConjointChoices(projectId, input);
    const scenario =
      input.scenario && typeof input.scenario === 'object' && !Array.isArray(input.scenario)
        ? input.scenario
        : {};
    let computed: CjWhatIfResult;
    try {
      computed = computeConjointWhatIf(choices, scenario);
    } catch (err) {
      this.rethrowUtilCode(err, [
        'cj_whatif_empty',
        'cj_whatif_unknown_attribute',
        'cj_whatif_no_choices',
        'forbidden_confidence_wording',
      ]);
    }
    if (input.persist !== true) {
      return computed;
    }
    const row = await this.repo.insertCjWhatIfRun(
      projectId,
      studyId,
      computed,
      actor?.trim() || 'unknown',
    );
    return {
      ...computed,
      run_id: row.id,
      persisted_at: row.created_at,
    };
  }

  async listConjointWhatIfRuns(
    projectId: number,
    scope: ClientScopeContext,
  ): Promise<{ runs: CjWhatIfRunRow[] }> {
    const project = await this.loadScopedProject(projectId, scope);
    this.assertPriceOfferConjoint(project);
    const runs = await this.repo.listCjWhatIfRuns(projectId);
    return { runs };
  }

  async getVanWestendorp(
    projectId: number,
    scope: ClientScopeContext,
  ): Promise<{ summary: ResearchVwSummaryRow | null }> {
    await this.loadScopedProject(projectId, scope);
    const summary = await this.repo.getLatestVwSummary(projectId);
    return { summary: summary ?? null };
  }

  async createVanWestendorp(
    projectId: number,
    scope: ClientScopeContext,
    input: { study_id?: number | null },
    actor: string,
  ): Promise<ResearchVwSummaryRow> {
    const project = await this.loadScopedProject(projectId, scope);
    this.assertPriceOffer(project);

    let studyId: number | null = null;
    if (input.study_id != null && String(input.study_id).trim() !== '') {
      const id = Number(input.study_id);
      if (!Number.isInteger(id) || id < 1) {
        throw new BadRequestException({
          error: 'validation_error',
          messages: ['study_id is invalid'],
        });
      }
      const existing = await this.repo.getStudy(id);
      if (!existing || existing.project_id !== projectId || existing.method !== 'survey') {
        throw new BadRequestException({
          error: 'validation_error',
          messages: ['study_id is invalid'],
        });
      }
      studyId = id;
    }

    const evidence = await this.repo.listEvidence(projectId);
    const bases = new Set<string>(VW_BASES);
    let rows = evidence.filter((row) => bases.has(String(row.value_base ?? '')));
    if (studyId == null) {
      const studies = await this.repo.listStudies(projectId);
      const surveyIds = new Set(
        studies.filter((study) => study.method === 'survey').map((study) => study.id),
      );
      const candidateIds = [
        ...new Set(
          rows
            .map((row) => row.study_id)
            .filter((id): id is number => id != null && surveyIds.has(id)),
        ),
      ].sort((a, b) => b - a);
      studyId = candidateIds[0] ?? null;
    }
    rows = studyId != null ? rows.filter((row) => row.study_id === studyId) : [];

    const units = new Set(
      rows.map((row) => String(row.unit ?? '').trim()).filter((unit) => unit.length > 0),
    );
    if (units.size > 1) {
      throw new BadRequestException({ error: 'vw_mixed_unit' });
    }

    const respondents = respondentsFromVwEvidence(
      rows.map((row) => ({
        value_num: row.value_num,
        value_base: String(row.value_base ?? ''),
        locator: String(row.locator ?? ''),
      })),
    );

    let computed: ReturnType<typeof computeVanWestendorp>;
    try {
      computed = computeVanWestendorp(respondents);
    } catch (err) {
      this.rethrowUtilCode(err, ['vw_insufficient_n', 'forbidden_confidence_wording']);
    }

    const unit = String(rows.find((row) => String(row.unit ?? '').trim())?.unit ?? '').trim() || 'VND';
    return this.repo.insertVwSummary(
      projectId,
      {
        study_id: studyId,
        unit,
        n: computed.n,
        bins: computed.bins,
        points: computed.points,
        limitation_note: computed.limitation_note,
        statistical_inference: false,
      },
      actor,
    );
  }

  async listWaves(
    projectId: number,
    scope: ClientScopeContext,
  ): Promise<{ waves: ResearchWave[]; compare: ReturnType<typeof compareLatestWaves> }> {
    const project = await this.loadScopedProject(projectId, scope);
    this.assertTracker(project);
    const waves = await this.repo.listWaves(projectId);
    return { waves, compare: compareLatestWaves(waves) };
  }

  async createWave(
    projectId: number,
    scope: ClientScopeContext,
    input: CreateWaveInput,
    actor: string,
  ): Promise<ResearchWave> {
    const project = await this.loadScopedProject(projectId, scope);
    this.assertTracker(project);
    const messages = validateCreateWave(input ?? ({} as CreateWaveInput));
    if (messages.length) {
      throw new BadRequestException({ error: 'validation_error', messages });
    }
    const metric_json = (Array.isArray(input.metric_json) ? input.metric_json : []).map((row) => ({
      key: String(row.key).trim().slice(0, 40),
      value: row.value == null ? null : Number(row.value),
    }));
    try {
      return await this.repo.createWave(
        projectId,
        {
          wave_no: Number(input.wave_no),
          label: this.optionalText(input.label),
          field_start: this.optionalDate(input.field_start, 'field_start'),
          field_end: this.optionalDate(input.field_end, 'field_end'),
          metric_json,
        },
        actor,
      );
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException({ error: 'wave_no_duplicate' });
      }
      throw err;
    }
  }

  async listDecisions(
    projectId: number,
    scope: ClientScopeContext,
  ): Promise<{ decisions: ResearchDecision[] }> {
    await this.loadScopedProject(projectId, scope);
    const decisions = await this.repo.listDecisions(projectId);
    return { decisions };
  }

  async createDecision(
    projectId: number,
    scope: ClientScopeContext,
    input: CreateDecisionInput,
    actor: string,
  ): Promise<ResearchDecision> {
    await this.loadScopedProject(projectId, scope);
    const messages = validateCreateDecision(input ?? ({} as CreateDecisionInput));
    if (messages.length) {
      throw new BadRequestException({ error: 'validation_error', messages });
    }
    const insight = await this.repo.getInsight(Number(input.insight_id));
    if (!insight || insight.project_id !== projectId || !APPROVED_INTERNAL_PLUS.includes(insight.status)) {
      throw new BadRequestException({ error: 'insight_not_approved' });
    }
    return this.repo.createDecision(
      projectId,
      {
        insight_id: insight.id,
        decision_text: String(input.decision_text).trim(),
        owner_email: String(input.owner_email).trim(),
        due_at: this.optionalDate(input.due_at, 'due_at'),
      },
      actor,
    );
  }

  async patchDecision(
    decisionId: number,
    scope: ClientScopeContext,
    input: PatchDecisionInput,
  ): Promise<ResearchDecision> {
    const existing = await this.repo.getDecision(decisionId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    if (input != null && ('decision_text' in input || 'insight_id' in input)) {
      throw new BadRequestException({ error: 'decision_locked' });
    }
    if (input?.status != null && !DECISION_STATUSES.includes(input.status)) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['status is invalid'],
      });
    }
    if (input?.owner_email !== undefined && !String(input.owner_email).trim()) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['owner_email is required'],
      });
    }
    const updated = await this.repo.patchDecision(decisionId, {
      status: input?.status,
      due_at: input?.due_at !== undefined ? this.optionalDate(input.due_at, 'due_at') : undefined,
      owner_email: input?.owner_email != null ? String(input.owner_email).trim() : undefined,
    });
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async patchStudy(
    studyId: number,
    scope: ClientScopeContext,
    input: PatchStudyInput,
  ): Promise<ResearchStudy> {
    const existing = await this.repo.getStudy(studyId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    if (input.name != null && !String(input.name).trim()) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['name is required'],
      });
    }
    const updated = await this.repo.patchStudy(studyId, {
      name: input.name != null ? String(input.name).trim().slice(0, 200) : undefined,
      n: input.n !== undefined ? this.optionalPositiveInt(input.n) : undefined,
      field_start: input.field_start !== undefined ? this.optionalDate(input.field_start, 'field_start') : undefined,
      field_end: input.field_end !== undefined ? this.optionalDate(input.field_end, 'field_end') : undefined,
      mode: input.mode !== undefined ? this.optionalStudyMode(input.mode) : undefined,
      instrument_version:
        input.instrument_version !== undefined ? this.optionalText(input.instrument_version) : undefined,
      weighting_note: input.weighting_note !== undefined ? this.optionalText(input.weighting_note) : undefined,
    });
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async listConsents(
    studyId: number,
    scope: ClientScopeContext,
  ): Promise<{ consents: ResearchConsent[] }> {
    const existing = await this.repo.getStudy(studyId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    const consents = await this.repo.listConsents(studyId);
    return { consents };
  }

  async createConsent(
    studyId: number,
    scope: ClientScopeContext,
    input: CreateConsentInput,
    actor: string,
  ): Promise<ResearchConsent> {
    const existing = await this.repo.getStudy(studyId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    const subject_code = String(input.subject_code ?? '').trim();
    if (!subject_code) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['subject_code is required'],
      });
    }
    const consent_type = String(input.consent_type ?? '').trim();
    if (!CONSENT_TYPES.includes(consent_type as (typeof CONSENT_TYPES)[number])) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['consent_type is invalid'],
      });
    }
    const notes = input.notes != null ? String(input.notes) : null;
    try {
      assertConsentHasNoPii({ subject_code, notes });
    } catch (err) {
      this.rethrowUtilCode(err, ['consent_pii_forbidden']);
    }
    const recordedAt = new Date();
    return this.repo.createConsent(
      existing.id,
      existing.project_id,
      {
        subject_code: subject_code.slice(0, 64),
        consent_type,
        notes: notes?.trim() || null,
        recorded_at: recordedAt,
        expires_at: defaultConsentExpiry(recordedAt),
      },
      actor,
    );
  }

  async getEvidence(
    evidenceId: number,
    scope: ClientScopeContext,
  ): Promise<ResearchEvidenceRow> {
    const existing = await this.repo.getEvidence(evidenceId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    return existing;
  }

  async ingestWhisper(
    projectId: number,
    studyId: number,
    scope: ClientScopeContext,
    input: { tempPath: string; mime?: string | null; questionId?: number | null },
    actor: string,
  ): Promise<WhisperIngestResult> {
    let handedOff = false;
    try {
      const project = await this.loadScopedProject(projectId, scope);
      const study = await this.repo.getStudy(studyId);
      if (!study || study.project_id !== projectId) {
        throw new NotFoundException({ error: 'not_found' });
      }
      const consents = await this.repo.listConsents(studyId);
      try {
        assertStudyIngestable(consents, new Date());
      } catch (err) {
        this.rethrowUtilCode(err, ['consent_required', 'consent_expired']);
      }

      let questionId: number | null = null;
      const rawQid = input.questionId;
      if (rawQid != null && rawQid !== ('' as unknown as number)) {
        questionId = Number(rawQid);
        if (!Number.isFinite(questionId) || questionId <= 0) {
          throw new BadRequestException({
            error: 'validation_error',
            messages: ['question_id is invalid'],
          });
        }
        const question = await this.repo.getQuestion(questionId);
        if (!question || question.project_id !== projectId) {
          throw new NotFoundException({ error: 'not_found' });
        }
      }

      const run = await this.repo.insertAiRun({
        projectId,
        questionId,
        jobType: 'whisper_ingest',
        provider: 'openai',
        actor,
      });
      const job = await this.jobQueue.enqueueResearchWhisperJob({
        projectId,
        studyId,
        runId: run.id,
        tempPath: input.tempPath,
        mime: input.mime ?? null,
        questionId,
        clientId: project.client_id,
        idempotencyKey: `research_whisper_ingest:${projectId}:${studyId}:run:${run.id}`,
      });
      if (job) {
        handedOff = true;
        return { ok: true, run_id: run.id, study_id: studyId, excerpt_ids: [], status: 'pending' };
      }
      return await this.persistWhisperExcerpts({
        projectId,
        studyId,
        scope,
        runId: run.id,
        tempPath: input.tempPath,
        questionId,
        actor,
      });
    } finally {
      if (!handedOff) {
        await unlinkQuiet(input.tempPath);
      }
    }
  }

  private async persistWhisperExcerpts(input: {
    projectId: number;
    studyId: number;
    scope: ClientScopeContext;
    runId: number;
    tempPath: string;
    questionId: number | null;
    actor: string;
  }): Promise<WhisperIngestResult> {
    try {
      const text = await transcribeAudio(input.tempPath);
      const excerpts = excerptsFromTranscript(text);
      const excerpt_ids: number[] = [];
      for (const row of excerpts) {
        const ev = await this.createEvidence(
          input.projectId,
          input.scope,
          {
            study_id: input.studyId,
            question_id: input.questionId,
            locator: row.locator,
            excerpt: row.excerpt,
          },
          input.actor,
        );
        excerpt_ids.push(ev.id);
      }
      const output = { excerpt_ids };
      assertNoRawInPayload(output);
      await this.repo.succeedAiRun(input.runId, { outputJson: output });
      return {
        ok: true,
        run_id: input.runId,
        study_id: input.studyId,
        excerpt_ids,
      };
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'whisper_disabled') {
        await this.repo.failAiRun(input.runId, 'whisper_disabled');
        return {
          ok: true,
          run_id: input.runId,
          study_id: input.studyId,
          excerpt_ids: [],
          status: 'failed',
          note: 'whisper_disabled',
        };
      }
      throw err;
    }
  }

  async createEvidence(
    projectId: number,
    scope: ClientScopeContext,
    input: CreateEvidenceInput,
    actor: string,
  ): Promise<ResearchEvidenceRow> {
    await this.loadScopedProject(projectId, scope);
    const messages = validateCreateEvidence(input);
    if (messages.length) {
      throw new BadRequestException({ error: 'validation_error', messages });
    }
    await this.assertSourceInProject(projectId, input.source_id);
    const study = await this.assertStudyInProject(projectId, input.study_id);
    this.applyStudyEvidenceGates(input, study);
    const { pii_class, pii_warning } = this.resolvePiiClass(input);
    const row = await this.repo.createEvidence(projectId, { ...input, pii_class }, actor);
    return pii_warning ? { ...row, pii_warning: true } : row;
  }

  async patchEvidence(
    evidenceId: number,
    scope: ClientScopeContext,
    input: PatchEvidenceInput,
  ): Promise<ResearchEvidenceRow> {
    const existing = await this.repo.getEvidence(evidenceId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    this.assertMutable(existing.qc_status);
    const merged: CreateEvidenceInput = {
      source_id: existing.source_id,
      study_id: existing.study_id,
      question_id: input.question_id !== undefined ? input.question_id : existing.question_id,
      locator: input.locator !== undefined ? input.locator : existing.locator,
      excerpt: input.excerpt !== undefined ? input.excerpt : existing.excerpt,
      value_num: input.value_num !== undefined ? input.value_num : existing.value_num,
      unit: input.unit !== undefined ? input.unit : existing.unit,
      value_base: input.value_base !== undefined ? input.value_base : existing.value_base,
      period_note: input.period_note !== undefined ? input.period_note : existing.period_note,
      geography: input.geography !== undefined ? input.geography : existing.geography,
      pii_class: input.pii_class !== undefined ? input.pii_class : existing.pii_class,
    };
    const messages = validateCreateEvidence(merged);
    if (messages.length) {
      throw new BadRequestException({ error: 'validation_error', messages });
    }
    const study = await this.assertStudyInProject(existing.project_id, merged.study_id);
    this.applyStudyEvidenceGates(merged, study);
    const { pii_class, pii_warning } = this.resolvePiiClass({
      ...merged,
      pii_class: merged.pii_class,
    });
    const updated = await this.repo.patchEvidence(evidenceId, { ...input, pii_class });
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return pii_warning ? { ...updated, pii_warning: true } : updated;
  }

  async verifyEvidence(
    evidenceId: number,
    scope: ClientScopeContext,
  ): Promise<ResearchEvidenceRow> {
    const existing = await this.repo.getEvidence(evidenceId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    this.assertMutable(existing.qc_status);
    const checksum = evidenceChecksum(existing);
    let updated: ResearchEvidenceRow | null;
    try {
      updated = await this.repo.verifyEvidence(evidenceId, checksum);
    } catch (err) {
      const pgCode = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
      if (pgCode === '23505') {
        throw new ConflictException({ error: 'evidence_duplicate_checksum' });
      }
      throw err;
    }
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async supersedeEvidence(
    evidenceId: number,
    scope: ClientScopeContext,
    input: CreateEvidenceInput,
    actor: string,
  ): Promise<{ old: ResearchEvidenceRow; evidence: ResearchEvidenceRow }> {
    const existing = await this.repo.getEvidence(evidenceId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    const body: CreateEvidenceInput = {
      source_id: input.source_id ?? existing.source_id,
      study_id: input.study_id ?? existing.study_id,
      question_id: input.question_id !== undefined ? input.question_id : existing.question_id,
      locator: input.locator ?? existing.locator,
      excerpt: input.excerpt !== undefined ? input.excerpt : existing.excerpt,
      value_num: input.value_num !== undefined ? input.value_num : existing.value_num,
      unit: input.unit !== undefined ? input.unit : existing.unit,
      value_base: input.value_base !== undefined ? input.value_base : existing.value_base,
      period_note: input.period_note !== undefined ? input.period_note : existing.period_note,
      geography: input.geography !== undefined ? input.geography : existing.geography,
      pii_class: input.pii_class,
    };
    const messages = validateCreateEvidence(body);
    if (messages.length) {
      throw new BadRequestException({ error: 'validation_error', messages });
    }
    await this.assertSourceInProject(existing.project_id, body.source_id);
    const study = await this.assertStudyInProject(existing.project_id, body.study_id);
    this.applyStudyEvidenceGates(body, study);
    const { pii_class, pii_warning } = this.resolvePiiClass(body);
    const result = await this.repo.supersedeEvidence(
      existing,
      { ...body, pii_class },
      actor,
    );
    return pii_warning ? { ...result, evidence: { ...result.evidence, pii_warning: true } } : result;
  }

  async createInsight(
    projectId: number,
    scope: ClientScopeContext,
    input: CreateInsightInput,
    actor: string,
  ): Promise<ResearchInsightRow> {
    await this.loadScopedProject(projectId, scope);
    if (!String(input.statement ?? '').trim()) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['statement is required'],
      });
    }
    this.assertConfidenceWording(input.confidence_rationale, input.confidence_json);
    const singleSource = await this.resolveSingleSource(projectId, []);
    return this.repo.createInsight(projectId, this.withComputedConfidence(input, singleSource), actor);
  }

  async patchInsight(
    insightId: number,
    scope: ClientScopeContext,
    input: PatchInsightInput,
  ): Promise<ResearchInsightRow> {
    const existing = await this.loadScopedInsight(insightId, scope);
    this.assertInsightContentMutable(existing.status);
    if (input.statement != null && !input.statement.trim()) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['statement is required'],
      });
    }
    this.assertConfidenceWording(
      input.confidence_rationale !== undefined ? input.confidence_rationale : existing.confidence_rationale,
      input.confidence_json !== undefined ? input.confidence_json : existing.confidence_json,
    );
    const singleSource = await this.resolveSingleSource(existing.project_id, existing.evidence_ids);
    const updated = await this.repo.patchInsight(
      insightId,
      this.withComputedConfidence(input, singleSource),
    );
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async attachEvidence(
    insightId: number,
    scope: ClientScopeContext,
    evidenceIds: number[],
  ): Promise<ResearchInsightRow> {
    const existing = await this.loadScopedInsight(insightId, scope);
    this.assertInsightContentMutable(existing.status);
    const ids = (Array.isArray(evidenceIds) ? evidenceIds : [])
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0);
    const verifiedIds: number[] = [];
    for (const id of ids) {
      const ev = await this.repo.getEvidence(id);
      if (!ev || ev.project_id !== existing.project_id) {
        throw new BadRequestException({
          error: 'validation_error',
          messages: ['evidence_ids is invalid'],
        });
      }
      if (ev.qc_status === 'verified') verifiedIds.push(id);
    }
    await this.repo.replaceInsightEvidence(insightId, verifiedIds);
    const nextStatus =
      existing.status === 'draft' || existing.status === 'evidence_attached'
        ? verifiedIds.length >= 1
          ? 'evidence_attached'
          : 'draft'
        : existing.status;
    if (nextStatus !== existing.status) {
      const updated = await this.repo.updateInsightStatus(insightId, nextStatus);
      if (!updated) throw new NotFoundException({ error: 'not_found' });
      return updated;
    }
    const refreshed = await this.repo.getInsight(insightId);
    if (!refreshed) throw new NotFoundException({ error: 'not_found' });
    return refreshed;
  }

  async submitReview(
    insightId: number,
    scope: ClientScopeContext,
    input: SubmitReviewInput = {},
  ): Promise<ResearchInsightRow> {
    const existing = await this.loadScopedInsight(insightId, scope);
    if (existing.status !== 'draft' && existing.status !== 'evidence_attached' && existing.status !== 'rejected') {
      throw new ConflictException({ error: 'invalid_transition' });
    }
    const rubric =
      extractRubric(input.confidence_json) ?? extractRubric(existing.confidence_json);
    this.assertInsightGate(
      await this.repo.countVerifiedEvidenceForInsight(insightId),
      existing.confidence_rationale,
      rubric,
    );
    const singleSource = await this.resolveSingleSource(existing.project_id, existing.evidence_ids);
    await this.repo.patchInsight(insightId, {
      confidence_json: buildConfidenceJson({ rubric: rubric!, single_source: singleSource }),
    } as PatchInsightInput);
    const updated = await this.repo.updateInsightStatus(insightId, 'analyst_verified');
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async approveInsight(
    insightId: number,
    scope: ClientScopeContext,
    input: ApproveInsightInput,
    reviewer: string,
  ): Promise<ResearchInsightRow> {
    const existing = await this.loadScopedInsight(insightId, scope);
    try {
      assertNotSelfApprove(existing.created_by, reviewer);
    } catch (err) {
      if ((err as Error & { code?: string }).code === 'cannot_self_approve') {
        throw new ForbiddenException({ error: 'cannot_self_approve' });
      }
      throw err;
    }
    const target = String(input.target_status ?? '') as InsightStatus;
    if (!INSIGHT_STATUSES.includes(target)) {
      throw new ConflictException({ error: 'invalid_transition' });
    }
    if (target === 'approved_internal' || target === 'approved_client_facing') {
      this.assertInsightGate(
        await this.repo.countVerifiedEvidenceForInsight(insightId),
        existing.confidence_rationale,
        extractRubric(existing.confidence_json),
      );
    }
    const project = await this.repo.getProject(existing.project_id);
    if (!canApproveTarget(existing.status, target, project?.risk_class ?? 'low')) {
      throw new ConflictException({ error: 'invalid_transition' });
    }
    const updated = await this.repo.updateInsightStatus(insightId, target);
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    await this.repo.insertReview({
      project_id: existing.project_id,
      object_type: 'insight',
      object_id: insightId,
      reviewer,
      role: 'approver',
      decision: target === 'rejected' ? 'reject' : 'approve',
      comments: input.comments ?? null,
    });
    if (isRagCorpusStatus(target)) {
      const embedText = insightEmbedText({
        statement: updated.statement,
        observation: updated.observation,
      });
      if (!shouldSkipRagEmbed(embedText)) {
        try {
          const resolved = await this.resolveInsightEmbedding(embedText);
          await this.repo.upsertInsightEmbedding({
            insight_id: updated.id,
            project_id: updated.project_id,
            embedding: resolved.embedding,
            embed_text: embedText,
            embed_model: resolved.model,
            embed_dims: resolved.dims,
            write_vec: this.config.researchRagPgvectorEnabled && this.ragPgvectorReady,
          });
        } catch {
          // skip upsert — approve already committed
        }
      }
    } else if (target === 'superseded' || target === 'expired' || target === 'rejected') {
      await this.repo.deleteInsightEmbedding(insightId);
    }
    return updated;
  }

  async searchInsights(scope: ClientScopeContext, input: SearchInsightsInput): Promise<RagSearchResult> {
    if (!this.config.researchRagEnabled) {
      return { hits: [], note: 'rag_disabled' };
    }
    const q = String(input.q ?? '').trim();
    if (!q) {
      throw new BadRequestException({ error: 'rag_query_required' });
    }
    const clientId = String(input.client_id ?? '').trim();
    if (clientId) {
      this.assertClientInScope(scope, clientId);
    }
    const rawLimit = Number(input.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 20) : 10;
    const themeCode = String(input.theme_code ?? '').trim() || undefined;
    let queryVec: number[] | undefined;
    if (this.openaiEmbedLive()) {
      try {
        queryVec = (await this.resolveInsightEmbedding(q)).embedding;
      } catch {
        return { hits: [], note: 'rag_embed_failed' };
      }
    }
    const allowedClientIds =
      !clientId && scope.restricted
        ? this.clientScope.allowedClientIdsForList(scope) ?? []
        : undefined;
    const annVec = queryVec ?? embedInsightText(q);
    const embeddingFilters = {
      client_id: clientId || undefined,
      allowedClientIds,
      theme_code: themeCode,
    };
    const rows = shouldUsePgvectorAnn(
      this.config.researchRagPgvectorEnabled,
      this.ragPgvectorReady,
      annVec,
    )
      ? await this.repo.listEmbeddingsByVec(embeddingFilters, annVec, 50)
      : await this.repo.listEmbeddings(embeddingFilters);
    const staleOnly = parseRagStaleOnlyFlag(input.stale_only);
    return {
      hits: rankRagHits(q, rows, {
        theme_code: themeCode,
        limit,
        queryVec: annVec,
        stale_only: staleOnly,
      }),
    };
  }

  private reembedFilters(scope: ClientScopeContext, clientId?: string) {
    const trimmed = String(clientId ?? '').trim();
    if (trimmed) {
      this.assertClientInScope(scope, trimmed);
    }
    const allowedClientIds =
      !trimmed && scope.restricted
        ? this.clientScope.allowedClientIdsForList(scope) ?? []
        : undefined;
    return {
      client_id: trimmed || undefined,
      allowedClientIds,
      target_dims: OPENAI_EMBED_DIMS,
      target_model: OPENAI_EMBED_MODEL,
    };
  }

  private assertRagReembedEnabled(): void {
    if (!this.config.researchRagEnabled) {
      throw new BadRequestException({ error: 'rag_disabled' });
    }
    if (!this.openaiEmbedLive()) {
      throw new BadRequestException({ error: 'rag_reembed_disabled' });
    }
  }

  async previewRagReembed(
    scope: ClientScopeContext,
    input: RagReembedInput,
  ): Promise<RagReembedPreviewResult> {
    this.assertRagReembedEnabled();
    const filters = this.reembedFilters(scope, input.client_id);
    const stale_count = await this.repo.countReembedStale(filters);
    return {
      ok: true,
      stale_count,
      target_dims: OPENAI_EMBED_DIMS,
      target_model: OPENAI_EMBED_MODEL,
    };
  }

  private async processRagReembedBatch(input: {
    client_id?: string;
    allowedClientIds?: string[];
    limit: number;
    runId: number;
  }): Promise<{
    processed: number;
    skipped_pii: number;
    failed: number;
    remaining: number;
  }> {
    const filters = {
      client_id: input.client_id,
      allowedClientIds: input.allowedClientIds,
      target_dims: OPENAI_EMBED_DIMS,
      target_model: OPENAI_EMBED_MODEL,
      limit: input.limit,
    };
    const candidates = await this.repo.listReembedCandidates(filters);
    let processed = 0;
    let skipped_pii = 0;
    let failed = 0;
    for (const row of candidates) {
      const embedText = insightEmbedText(row);
      if (shouldSkipRagEmbed(embedText)) {
        skipped_pii += 1;
        continue;
      }
      try {
        const resolved = await this.resolveInsightEmbedding(embedText);
        await this.repo.upsertInsightEmbedding({
          insight_id: row.insight_id,
          project_id: row.project_id,
          embedding: resolved.embedding,
          embed_text: embedText,
          embed_model: resolved.model,
          embed_dims: resolved.dims,
          write_vec: this.config.researchRagPgvectorEnabled && this.ragPgvectorReady,
        });
        processed += 1;
      } catch {
        failed += 1;
      }
    }
    const remaining = await this.repo.countReembedStale({
      client_id: input.client_id,
      allowedClientIds: input.allowedClientIds,
      target_dims: OPENAI_EMBED_DIMS,
      target_model: OPENAI_EMBED_MODEL,
    });
    const output = { processed, skipped_pii, failed, remaining };
    if (failed > 0 && processed === 0) {
      await this.repo.failAiRun(input.runId, 'rag_reembed_failed');
    } else {
      await this.repo.succeedAiRun(input.runId, {
        outputJson: output,
        creditsUsed: processed,
      });
    }
    return output;
  }

  async startRagReembed(
    scope: ClientScopeContext,
    input: RagReembedInput,
    actor: string,
  ): Promise<RagReembedStartResult> {
    this.assertRagReembedEnabled();
    const filters = this.reembedFilters(scope, input.client_id);
    const rawLimit = Number(input.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 200) : 50;

    if (input.dry_run) {
      const stale_count = await this.repo.countReembedStale(filters);
      return {
        ok: true,
        status: stale_count > 0 ? 'pending' : 'noop',
        remaining: stale_count,
      };
    }

    const anchor = await this.repo.listReembedCandidates({ ...filters, limit: 1 });
    if (anchor.length === 0) {
      return { ok: true, status: 'noop', processed: 0, skipped_pii: 0, failed: 0, remaining: 0 };
    }

    const run = await this.repo.insertAiRun({
      projectId: anchor[0].project_id,
      jobType: 'rag_reembed',
      provider: 'openai',
      model: OPENAI_EMBED_MODEL,
      actor,
    });

    const job = await this.jobQueue.enqueueResearchRagReembedJob({
      projectId: anchor[0].project_id,
      runId: run.id,
      clientId: filters.client_id,
      allowedClientIds: filters.allowedClientIds,
      limit,
      idempotencyKey: `research_rag_reembed:${filters.client_id ?? 'all'}:run:${run.id}`,
    });

    if (!job) {
      const batch = await this.processRagReembedBatch({
        client_id: filters.client_id,
        allowedClientIds: filters.allowedClientIds,
        limit,
        runId: run.id,
      });
      return {
        ok: true,
        run_id: run.id,
        status: batch.failed > 0 && batch.processed === 0 ? 'failed' : 'succeeded',
        note: 'jobs_disabled',
        ...batch,
      };
    }

    return { ok: true, run_id: run.id, status: 'pending' };
  }

  async listTaxonomy(): Promise<{ themes: TaxonomyTheme[] }> {
    return { themes: await this.repo.listTaxonomy() };
  }

  async createTaxonomy(input: CreateTaxonomyInput): Promise<TaxonomyTheme> {
    const themeCode = String(input.theme_code ?? '').trim();
    if (validateThemeCode(themeCode)) {
      throw new BadRequestException({ error: 'taxonomy_code_invalid' });
    }
    const labelVi = String(input.label_vi ?? '').trim();
    if (!labelVi) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['label_vi is required'],
      });
    }
    try {
      return await this.repo.createTaxonomy({
        theme_code: themeCode,
        label_vi: labelVi,
        synonyms: sanitizeSynonyms(input.synonyms),
      });
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException({ error: 'taxonomy_code_exists' });
      }
      throw err;
    }
  }

  async patchTaxonomy(id: number, input: PatchTaxonomyInput): Promise<TaxonomyTheme> {
    const existing = await this.repo.getTaxonomy(id);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    if (input.label_vi != null && !String(input.label_vi).trim()) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['label_vi is required'],
      });
    }
    const updated = await this.repo.patchTaxonomy(id, {
      label_vi: input.label_vi != null ? String(input.label_vi).trim() : undefined,
      synonyms: input.synonyms != null ? sanitizeSynonyms(input.synonyms) : undefined,
      active: input.active,
    });
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async attachInsightTheme(
    insightId: number,
    scope: ClientScopeContext,
    input: AttachInsightThemeInput,
    actor: string,
  ): Promise<ResearchInsightRow> {
    const existing = await this.loadScopedInsight(insightId, scope);
    const taxonomyId = Number(input.taxonomy_id);
    if (!Number.isFinite(taxonomyId) || taxonomyId <= 0) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['taxonomy_id is required'],
      });
    }
    const theme = await this.repo.getTaxonomy(taxonomyId);
    if (!theme) throw new NotFoundException({ error: 'not_found' });
    if (!theme.active) {
      throw new BadRequestException({ error: 'taxonomy_inactive' });
    }
    await this.repo.attachInsightTheme(existing.id, taxonomyId, actor);
    const refreshed = await this.repo.getInsight(existing.id);
    if (!refreshed) throw new NotFoundException({ error: 'not_found' });
    return refreshed;
  }

  async detachInsightTheme(
    insightId: number,
    taxonomyId: number,
    scope: ClientScopeContext,
  ): Promise<ResearchInsightRow> {
    const existing = await this.loadScopedInsight(insightId, scope);
    await this.repo.detachInsightTheme(existing.id, taxonomyId);
    const refreshed = await this.repo.getInsight(existing.id);
    if (!refreshed) throw new NotFoundException({ error: 'not_found' });
    return refreshed;
  }

  async runDesk(
    projectId: number,
    scope: ClientScopeContext,
    input: RunDeskInput,
    actor: string,
  ): Promise<RunDeskResult> {
    const project = await this.loadScopedProject(projectId, scope);
    const questionId = Number(input.question_id);
    if (!Number.isFinite(questionId) || questionId <= 0) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['question_id is required'],
      });
    }
    const question = await this.repo.getQuestion(questionId);
    if (!question || question.project_id !== projectId) {
      throw new NotFoundException({ error: 'not_found' });
    }
    const inFlight = await this.repo.findInFlightDeskRun(projectId, questionId);
    if (inFlight) {
      throw new ConflictException({ error: 'job_in_flight' });
    }
    const run = await this.repo.insertAiRun({
      projectId,
      questionId,
      jobType: 'desk_tavily',
      provider: 'tavily',
      actor,
    });
    const job = await this.jobQueue.enqueueResearchDeskJob({
      projectId,
      questionId,
      runId: run.id,
      clientId: project.client_id,
      idempotencyKey: `research_desk:${projectId}:${questionId}:run:${run.id}`,
    });
    if (!job) {
      await this.repo.failAiRun(run.id, 'jobs_disabled');
      return { ok: true, run_id: run.id, status: 'failed', note: 'jobs_disabled' };
    }
    return { ok: true, run_id: run.id, status: 'pending' };
  }

  async runDeep(
    projectId: number,
    scope: ClientScopeContext,
    input: RunDeepInput,
    actor: string,
  ): Promise<RunDeepResult> {
    if (this.config.researchDeepProvider === 'off') {
      throw new BadRequestException({ error: 'deep_research_disabled' });
    }
    const project = await this.loadScopedProject(projectId, scope);
    const questionId = Number(input.question_id);
    if (!Number.isFinite(questionId) || questionId <= 0) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['question_id is required'],
      });
    }
    const question = await this.repo.getQuestion(questionId);
    if (!question || question.project_id !== projectId) {
      throw new NotFoundException({ error: 'not_found' });
    }
    const inFlight = await this.repo.findInFlightDeepRun(projectId, questionId);
    if (inFlight) {
      throw new ConflictException({ error: 'job_in_flight' });
    }
    const run = await this.repo.insertAiRun({
      projectId,
      questionId,
      jobType: 'deep_research',
      provider: this.deepFallbackProvider(),
      actor,
    });
    const job = await this.jobQueue.enqueueResearchDeepJob({
      projectId,
      questionId,
      runId: run.id,
      clientId: project.client_id,
      idempotencyKey: `research_deep:${projectId}:${questionId}:run:${run.id}`,
    });
    if (!job) {
      await this.repo.failAiRun(run.id, 'jobs_disabled');
      return { ok: true, run_id: run.id, status: 'failed', note: 'jobs_disabled' };
    }
    return { ok: true, run_id: run.id, status: 'pending' };
  }

  async runTriangulate(
    projectId: number,
    questionId: number,
    scope: ClientScopeContext,
    actor: string,
  ): Promise<RunTriangulateResult> {
    const project = await this.loadScopedProject(projectId, scope);
    if (!Number.isFinite(questionId) || questionId <= 0) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['question_id is required'],
      });
    }
    const question = await this.repo.getQuestion(questionId);
    if (!question || question.project_id !== projectId) {
      throw new NotFoundException({ error: 'not_found' });
    }
    const inFlight = await this.repo.findInFlightTriangulateRun(projectId, questionId);
    if (inFlight) {
      throw new ConflictException({ error: 'job_in_flight' });
    }
    const run = await this.repo.insertAiRun({
      projectId,
      questionId,
      jobType: 'research_triangulate',
      provider: 'tavily',
      actor,
    });
    const job = await this.jobQueue.enqueueResearchTriangulateJob({
      projectId,
      questionId,
      runId: run.id,
      clientId: project.client_id,
      idempotencyKey: `research_triangulate:${projectId}:${questionId}:run:${run.id}`,
    });
    if (!job) {
      await this.repo.failAiRun(run.id, 'jobs_disabled');
      return { ok: true, run_id: run.id, status: 'failed', note: 'jobs_disabled' };
    }
    return { ok: true, run_id: run.id, status: 'pending' };
  }

  async runPulse(
    projectId: number,
    scope: ClientScopeContext,
    input: RunPulseInput,
    actor: string,
  ): Promise<RunPulseResult> {
    const project = await this.loadScopedProject(projectId, scope);
    const rawQid = input.question_id;
    let questionId: number | null = null;
    if (rawQid != null && rawQid !== ('' as unknown as number)) {
      questionId = Number(rawQid);
      if (!Number.isFinite(questionId) || questionId <= 0) {
        throw new BadRequestException({
          error: 'validation_error',
          messages: ['question_id is invalid'],
        });
      }
      const question = await this.repo.getQuestion(questionId);
      if (!question || question.project_id !== projectId) {
        throw new NotFoundException({ error: 'not_found' });
      }
    }
    const inFlight = await this.repo.findInFlightPulseRun(projectId);
    if (inFlight) {
      throw new ConflictException({ error: 'job_in_flight' });
    }
    const run = await this.repo.insertAiRun({
      projectId,
      questionId,
      jobType: 'research_pulse',
      provider: 'tavily',
      actor,
    });
    const job = await this.jobQueue.enqueueResearchPulseJob({
      projectId,
      questionId,
      runId: run.id,
      clientId: project.client_id,
      lifecycleId: project.lifecycle_id,
      idempotencyKey: `research_pulse:${projectId}:${questionId ?? 0}:run:${run.id}`,
    });
    if (!job) {
      await this.persistPulseSignalsFromSnapshots(project);
      await this.repo.failAiRun(run.id, 'jobs_disabled');
      return { ok: true, run_id: run.id, status: 'failed', note: 'jobs_disabled' };
    }
    return { ok: true, run_id: run.id, status: 'pending' };
  }

  async runSparktoro(
    projectId: number,
    scope: ClientScopeContext,
    input: RunSparktoroInput,
    actor: string,
  ): Promise<RunSparktoroResult> {
    const project = await this.loadScopedProject(projectId, scope);
    const questionId = Number(input.question_id);
    if (!Number.isFinite(questionId) || questionId <= 0) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['question_id is required'],
      });
    }
    const question = await this.repo.getQuestion(questionId);
    if (!question || question.project_id !== projectId) {
      throw new NotFoundException({ error: 'not_found' });
    }
    if (piiHint(question.question_vi)) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['question_vi contains pii'],
      });
    }
    const apiKey = String(this.config.sparktoroApiKey ?? '').trim();
    if (!this.config.researchSparktoroEnabled || !apiKey) {
      return { ok: true, note: 'sparktoro_disabled' };
    }
    const run = await this.repo.insertAiRun({
      projectId,
      questionId,
      jobType: 'sparktoro',
      provider: 'sparktoro',
      actor,
    });
    const job = await this.jobQueue.enqueueResearchSparktoroJob({
      projectId,
      questionId,
      runId: run.id,
      clientId: project.client_id,
      idempotencyKey: `research_sparktoro:${projectId}:${questionId}:run:${run.id}`,
    });
    if (job) {
      return { ok: true, run_id: run.id, status: 'pending' };
    }
    return this.persistSparktoroSources({
      projectId,
      questionId,
      runId: run.id,
      questionVi: question.question_vi,
      geo: project.geo,
      apiKey,
    });
  }

  async runTalkwalker(
    projectId: number,
    scope: ClientScopeContext,
    input: RunTalkwalkerInput,
    actor: string,
  ): Promise<RunTalkwalkerResult> {
    await this.loadScopedProject(projectId, scope);
    const questionId = Number(input.question_id);
    if (!Number.isFinite(questionId) || questionId <= 0) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['question_id is required'],
      });
    }
    const question = await this.repo.getQuestion(questionId);
    if (!question || question.project_id !== projectId) {
      throw new NotFoundException({ error: 'not_found' });
    }
    if (piiHint(question.question_vi)) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['question_vi contains pii'],
      });
    }
    const token = String(this.config.talkwalkerAccessToken ?? '').trim();
    if (!this.config.researchTalkwalkerEnabled || !token) {
      return { ok: true, note: 'talkwalker_disabled' };
    }
    const talkwalkerProjectId = String(this.config.talkwalkerProjectId ?? '').trim();
    const run = await this.repo.insertAiRun({
      projectId,
      questionId,
      jobType: 'talkwalker',
      provider: 'talkwalker',
      actor,
    });
    let normalized = TALKWALKER_STUB_RESULTS;
    let note: 'talkwalker_stub' | 'talkwalker_live' = 'talkwalker_stub';
    if (talkwalkerProjectId) {
      try {
        normalized = await collectTalkwalker({
          query: question.question_vi,
          accessToken: token,
          projectId: talkwalkerProjectId,
        });
        note = 'talkwalker_live';
      } catch {
        await this.repo.failAiRun(run.id, 'talkwalker_failed');
        throw new BadRequestException({ error: 'talkwalker_failed' });
      }
    }
    const candidates = mapTalkwalkerResponse(normalized);
    const source_ids: number[] = [];
    for (const row of candidates) {
      const created = await this.repo.createSource(projectId, {
        title: row.title,
        url: row.url,
        publisher: row.publisher,
        reliability_tier: row.reliability_tier,
        limitation_note: row.limitation_note,
        question_id: questionId,
        source_type: 'social_public',
        ai_generated: true,
        keep: true,
      });
      source_ids.push(created.id);
    }
    await this.repo.succeedAiRun(run.id, {
      creditsUsed: 0,
      outputJson:
        note === 'talkwalker_live'
          ? { source_ids, live: true, note: 'talkwalker_live' }
          : { source_ids, stub: true, note: 'talkwalker_stub' },
    });
    return { ok: true, run_id: run.id, status: 'succeeded', source_ids, note };
  }

  async runQualtrics(
    projectId: number,
    scope: ClientScopeContext,
    input: RunQualtricsInput,
    actor: string,
  ): Promise<RunQualtricsResult> {
    const project = await this.loadScopedProject(projectId, scope);
    const apiKey = String(this.config.qualtricsApiKey ?? '').trim();
    const datacenter = String(this.config.qualtricsDatacenter ?? '').trim();
    if (!this.config.researchQualtricsEnabled || !apiKey || !datacenter) {
      return { ok: true, note: 'qualtrics_disabled' };
    }

    const studyId = Number(input.study_id);
    if (!Number.isFinite(studyId) || studyId <= 0) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['study_id is required'],
      });
    }
    const study = await this.repo.getStudy(studyId);
    if (!study || study.project_id !== projectId || study.method !== 'survey') {
      throw new NotFoundException({ error: 'not_found' });
    }
    const surveyId = String(study.instrument_version ?? '').trim();
    if (!QUALTRICS_SURVEY_ID_RE.test(surveyId)) {
      throw new BadRequestException({
        error: 'qualtrics_survey_id_required',
        messages: ['qualtrics_survey_id_required'],
      });
    }
    const columnMap = resolveQualtricsColumnMap(study, input.column_map);
    if (!columnMap) {
      throw new BadRequestException({
        error: 'qualtrics_map_required',
        messages: ['qualtrics_map_required'],
      });
    }

    const run = await this.repo.insertAiRun({
      projectId,
      questionId: null,
      jobType: 'qualtrics',
      provider: 'qualtrics',
      actor,
    });
    const job = await this.jobQueue.enqueueResearchQualtricsJob({
      projectId,
      studyId,
      runId: run.id,
      columnMap,
      clientId: project.client_id,
      idempotencyKey: `research_qualtrics:${projectId}:${studyId}:run:${run.id}`,
    });
    if (job) {
      return { ok: true, run_id: run.id, status: 'pending' };
    }
    return this.persistQualtricsEvidence({
      projectId,
      study,
      columnMap,
      runId: run.id,
      apiKey,
      datacenter,
      actor,
      scope,
    });
  }

  private async persistQualtricsEvidence(input: {
    projectId: number;
    study: ResearchStudy;
    columnMap: Record<string, QualtricsColumnMapEntry>;
    runId: number;
    apiKey: string;
    datacenter: string;
    actor: string;
    scope: ClientScopeContext;
  }): Promise<RunQualtricsResult> {
    const surveyId = String(input.study.instrument_version ?? '').trim();
    let collected: Awaited<ReturnType<typeof collectQualtrics>>;
    try {
      collected = await collectQualtrics({
        surveyId,
        apiKey: input.apiKey,
        datacenter: input.datacenter,
        columnMap: input.columnMap,
      });
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
      if (code === 'survey_pii_forbidden') {
        await this.repo.failAiRun(input.runId, 'survey_pii_forbidden');
        return { ok: true, run_id: input.runId, status: 'failed' };
      }
      await this.repo.failAiRun(input.runId, 'qualtrics_failed');
      return { ok: true, run_id: input.runId, status: 'failed' };
    }
    if (!collected.drafts.length) {
      await this.repo.failAiRun(input.runId, 'qualtrics_failed');
      return { ok: true, run_id: input.runId, status: 'failed' };
    }
    const { source_id, evidence_ids, n } = await this.persistCodebookDrafts({
      projectId: input.projectId,
      study: input.study,
      drafts: collected.drafts,
      publisher: 'Qualtrics',
      limitationNote: QUALTRICS_LIMITATION_NOTE,
      aiGenerated: true,
      actor: input.actor,
      scope: input.scope,
    });
    await this.repo.succeedAiRun(input.runId, {
      outputJson: {
        evidence_ids,
        source_id,
        n,
        progress_id: collected.progress_id,
        file_id: collected.file_id,
        survey_id: surveyId,
      },
    });
    return { ok: true, run_id: input.runId, status: 'succeeded', evidence_ids };
  }

  private async persistSparktoroSources(input: {
    projectId: number;
    questionId: number;
    runId: number;
    questionVi: string;
    geo: string[];
    apiKey: string;
  }): Promise<RunSparktoroResult> {
    const query = [input.questionVi.trim(), ...input.geo.map((g) => String(g).trim()).filter(Boolean)]
      .join(' ')
      .slice(0, 500);
    let raw: Awaited<ReturnType<typeof collectSparkToro>>;
    try {
      raw = await collectSparkToro({ query, apiKey: input.apiKey, geo: input.geo });
    } catch {
      await this.repo.failAiRun(input.runId, 'sparktoro_failed');
      return { ok: true, run_id: input.runId, status: 'failed' };
    }
    const candidates = mapSparkToroResponse(raw);
    const source_ids: number[] = [];
    for (const row of candidates) {
      const created = await this.repo.createSource(input.projectId, {
        title: row.title,
        url: row.url,
        publisher: row.publisher,
        reliability_tier: row.reliability_tier,
        limitation_note: row.limitation_note,
        question_id: input.questionId,
        source_type: 'web',
        ai_generated: true,
        keep: true,
      });
      source_ids.push(created.id);
    }
    await this.repo.succeedAiRun(input.runId, {
      creditsUsed: Number(raw.credits_used ?? 0),
      outputJson: {
        source_ids,
        query,
        credits_used: raw.credits_used ?? 0,
        report_id: raw.report_id ?? null,
        location: raw.location ?? null,
      },
    });
    return { ok: true, run_id: input.runId, status: 'succeeded', source_ids };
  }

  private async persistPulseSignalsFromSnapshots(project: ResearchProjectRow): Promise<TrendSignal[]> {
    const competitors = await this.repo.listCompetitors(project.id);
    const signals: TrendSignal[] = [];
    for (const comp of competitors) {
      const snaps = [...(comp.snapshots ?? [])].sort((a, b) => a.id - b.id);
      if (snaps.length < 2) continue;
      const prev = snaps[snaps.length - 2];
      const next = snaps[snaps.length - 1];
      const prevFact = (prev.fact ?? {}) as Record<string, unknown>;
      const nextFact = (next.fact ?? {}) as Record<string, unknown>;
      const { changed, topic } = snapshotFactDiff(prevFact, nextFact);
      if (!changed.length || !topic) continue;
      const baseline = parseFactNumber(prevFact[topic]);
      const current = parseFactNumber(nextFact[topic]);
      const vel = velocity(baseline, current);
      const signal = await this.repo.insertTrendSignal({
        projectId: project.id,
        topic,
        metric: topic,
        baseline,
        current,
        velocity: vel,
        lifecycle: lifecycleFromVelocity(vel),
      });
      signals.push(signal);
      if (project.lifecycle_id != null) {
        await this.opsAlerts.upsertAlert({
          lifecycleId: project.lifecycle_id,
          dvCode: 'DV12',
          alertType: 'research_pulse',
          severity: 'warning',
          title: `Pulse: ${topic}`,
          message: `Đối thủ đổi ${topic} trên project ${project.id}`,
          sourceKey: `research_pulse:${project.id}:${signal.id}`,
        });
      }
    }
    return signals;
  }

  async acceptSingleSource(
    sourceId: number,
    scope: ClientScopeContext,
  ): Promise<ResearchSourceRow> {
    const existing = await this.repo.getSource(sourceId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    const updated = await this.repo.acceptSingleSource(sourceId);
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async getJob(
    projectId: number,
    runId: number,
    scope: ClientScopeContext,
  ): Promise<ResearchAiRunRow> {
    await this.loadScopedProject(projectId, scope);
    const run = await this.repo.getAiRun(projectId, runId);
    if (!run) throw new NotFoundException({ error: 'not_found' });
    return run;
  }

  async insightCopilot(
    projectId: number,
    scope: ClientScopeContext,
    input: InsightCopilotInput,
    actor: string,
  ): Promise<InsightCopilotResult> {
    const project = await this.loadScopedProject(projectId, scope);
    const evidenceIds = normalizePositiveIds(input.evidence_ids);
    if (evidenceIds.length === 0) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['evidence_ids is required'],
      });
    }
    const evidence: ResearchEvidenceRow[] = [];
    for (const id of evidenceIds) {
      const ev = await this.repo.getEvidence(id);
      if (!ev || ev.project_id !== projectId || ev.qc_status !== 'verified') {
        throw new BadRequestException({
          error: 'validation_error',
          messages: ['evidence_ids is invalid'],
        });
      }
      evidence.push(ev);
    }

    const evidenceFields = evidence.map(toInsightCopilotEvidenceFields);
    let ragHits: CopilotRagHit[] = [];
    let ragNote: CopilotRagNote | undefined = 'rag_disabled';
    let prompt = buildInsightCopilotPrompt(evidenceFields);
    let promptVersion = 'research-insight-v1';

    if (this.config.researchRagEnabled) {
      const q = buildCopilotRagQuery(evidenceFields);
      if (shouldSkipCopilotRag(q)) {
        ragNote = q.trim() ? 'rag_skipped_pii' : 'rag_empty';
      } else {
        try {
          const search = await this.searchInsights(scope, {
            q,
            client_id: project.client_id,
            limit: RAG_COPILOT_HIT_LIMIT,
          });
          ragHits = toCopilotRagHits(search.hits);
          ragNote = ragHits.length ? undefined : 'rag_empty';
          prompt = buildInsightCopilotPrompt(evidenceFields, { ragHits });
          promptVersion = 'research-insight-v2';
        } catch {
          ragHits = [];
          ragNote = 'rag_empty';
        }
      }
    }

    const run = await this.repo.insertAiRun({
      projectId,
      jobType: 'insight_draft',
      provider: 'anthropic',
      actor,
    });
    if (!this.llm.isConfigured()) {
      await this.repo.failAiRun(run.id, 'llm_unconfigured');
      throw new ServiceUnavailableException({ error: 'llm_unconfigured' });
    }

    const inputHash = hashPrompt(prompt.system, prompt.user);
    try {
      const { parsed, modelName } = await this.llm.completeJson({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
      });
      const draft = normalizeInsightDraft(parsed);
      if (!draft.statement.trim()) {
        throw new Error('invalid_llm_output');
      }
      const created = await this.repo.createInsight(
        projectId,
        { ...draft, ai_generated: true },
        actor,
      );
      await this.repo.replaceInsightEvidence(created.id, evidence.map((row) => row.id));
      const insight = (await this.repo.getInsight(created.id)) ?? created;
      if (insight.status === 'published') {
        throw new Error('ai_insight_must_stay_draft');
      }
      await this.repo.succeedAiRun(run.id, {
        model: modelName,
        promptVersion,
        inputHash,
        outputJson: {
          insight_id: insight.id,
          status: insight.status,
          evidence: evidence.map(redactEvidenceForAiRunLog),
          rag_hit_ids: ragHits.map((h) => h.insight_id),
          rag_note: ragNote ?? null,
        },
      });
      return { ok: true, insight, run_id: run.id, rag_hits: ragHits, rag_note: ragNote };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        await this.repo.failAiRun(run.id, errorCode(err) ?? 'llm_provider_error');
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      await this.repo.failAiRun(run.id, message);
      throw new ServiceUnavailableException({ error: 'llm_provider_error', message });
    }
  }

  async reportCopilot(
    projectId: number,
    scope: ClientScopeContext,
    input: ReportCopilotInput,
    actor: string,
  ): Promise<ReportCopilotResult> {
    const project = await this.loadScopedProject(projectId, scope);
    const insightIds = normalizePositiveIds(input.insight_ids);
    if (insightIds.length === 0) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['insight_ids is required'],
      });
    }
    const insights: ResearchInsightRow[] = [];
    for (const id of insightIds) {
      const insight = await this.repo.getInsight(id);
      if (!insight || insight.project_id !== projectId) {
        throw new BadRequestException({
          error: 'validation_error',
          messages: ['insight_ids is invalid'],
        });
      }
      if (!APPROVED_INTERNAL_PLUS.includes(insight.status)) {
        throw new BadRequestException({
          error: 'validation_error',
          messages: ['insight must be approved_internal+'],
        });
      }
      insights.push(insight);
    }

    const run = await this.repo.insertAiRun({
      projectId,
      jobType: 'report_draft',
      provider: 'anthropic',
      actor,
    });
    if (!this.llm.isConfigured()) {
      await this.repo.failAiRun(run.id, 'llm_unconfigured');
      throw new ServiceUnavailableException({ error: 'llm_unconfigured' });
    }

    const prompt = buildReportCopilotPrompt(
      insights.map((row) => ({
        id: row.id,
        statement: row.statement,
        observation: row.observation,
        interpretation: row.interpretation,
        implication: row.implication,
        recommendation: row.recommendation,
        evidence_ids: row.evidence_ids,
      })),
    );
    const inputHash = hashPrompt(prompt.system, prompt.user);
    try {
      const { parsed, modelName } = await this.llm.completeJson({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
      });
      const snapshot = await this.snapshotFromInsights(project, insights, insightIds, parsed);
      const draft = await this.repo.createReportDraft({
        projectId,
        contentSnapshot: snapshot,
        generatedBy: actor,
      });
      await this.repo.succeedAiRun(run.id, {
        model: modelName,
        promptVersion: 'research-report-v1',
        inputHash,
        outputJson: {
          report_id: draft.report_id,
          version: draft.version,
          status: 'draft',
          insight_ids: insightIds,
          evidence: snapshot.evidence_index,
        },
      });
      return {
        ok: true,
        report_id: draft.report_id,
        version: draft.version,
        content_snapshot: draft.content_snapshot,
        run_id: run.id,
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        await this.repo.failAiRun(run.id, errorCode(err) ?? 'llm_provider_error');
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      await this.repo.failAiRun(run.id, message);
      throw new ServiceUnavailableException({ error: 'llm_provider_error', message });
    }
  }

  async createReport(
    projectId: number,
    scope: ClientScopeContext,
    input: CreateReportInput,
    actor: string,
  ): Promise<CreateReportResult> {
    const project = await this.loadScopedProject(projectId, scope);
    const insights = await this.loadApprovedInsights(projectId, input.insight_ids);
    const methodology = this.assertMethodologyForTier(project.dv12_tier, input.methodology);
    const snapshot = await this.snapshotFromInsights(
      project,
      insights,
      insights.map((row) => row.id),
      undefined,
      methodology,
    );
    const draft = await this.repo.insertReportVersion({
      projectId,
      contentSnapshot: snapshot,
      generatedBy: actor,
    });
    return {
      ok: true,
      report_id: draft.report_id,
      version_id: draft.version_id,
      version: draft.version,
      content_snapshot: draft.content_snapshot,
      content_hash: draft.content_hash,
      portal_visible: false,
      published_by: null,
    };
  }

  async listReports(
    projectId: number,
    scope: ClientScopeContext,
  ): Promise<{ reports: ResearchReportRow[] }> {
    await this.loadScopedProject(projectId, scope);
    const reports = await this.repo.listReports(projectId);
    const allIds = new Set<number>();
    for (const report of reports) {
      for (const version of report.versions) {
        for (const id of collectReportInsightIds(version.content_snapshot)) {
          allIds.add(id);
        }
      }
    }
    const validToById =
      allIds.size > 0
        ? await this.repo.listInsightValidToForProject(projectId, [...allIds])
        : new Map<number, string | null>();
    const now = new Date();
    return {
      reports: reports.map((report) => ({
        ...report,
        versions: report.versions.map((version) => ({
          ...version,
          has_stale_insights: reportSnapshotHasStaleInsights(
            version.content_snapshot,
            validToById,
            now,
          ),
        })),
      })),
    };
  }

  async exportReportVersion(
    reportId: number,
    versionId: number,
    scope: ClientScopeContext,
    format: ResearchExportFormat = 'docx',
  ): Promise<StreamableFile> {
    const report = await this.repo.getReport(reportId);
    if (!report) throw new NotFoundException({ error: 'not_found' });
    const project = await this.loadScopedProject(report.project_id, scope);
    const version = await this.repo.getReportVersion(reportId, versionId);
    if (!version) throw new NotFoundException({ error: 'not_found' });
    const raw = version.content_snapshot as ResearchReportSnapshot;
    const snapshot: ResearchReportSnapshot = {
      ...raw,
      exec: normalizeReportExec(raw.exec),
    };
    this.assertMethodologyForTier(project.dv12_tier, snapshot.methodology);
    const sections = sectionsFromReportSnapshot(snapshot);
    const ids = collectReportInsightIds(snapshot);
    const validToById = await this.repo.listInsightValidToForProject(project.id, ids);
    const footer = reportSnapshotHasStaleInsights(snapshot, validToById)
      ? REPORT_PDF_STALE_FOOTER_STAFF
      : undefined;
    if (format === 'pdf') {
      const buffer = buildResearchReportPdf(sections, undefined, footer);
      return new StreamableFile(buffer, {
        type: 'application/pdf',
        disposition: `attachment; filename="research-report-${reportId}-v${version.version}.pdf"`,
      });
    }
    const buffer = await buildResearchReportDocx(sections, footer);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      disposition: `attachment; filename="research-report-${reportId}-v${version.version}.docx"`,
    });
  }

  async updateReportExecEn(
    reportId: number,
    versionId: number,
    scope: ClientScopeContext,
    input: UpdateExecEnInput,
    _actor: string,
  ): Promise<ResearchReportVersionRow> {
    const report = await this.repo.getReport(reportId);
    if (!report) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(report.project_id, scope);
    const version = await this.repo.getReportVersion(reportId, versionId);
    if (!version) throw new NotFoundException({ error: 'not_found' });

    const snapshot = { ...version.content_snapshot };
    const exec = normalizeReportExec(snapshot.exec);
    try {
      assertExecEnEditable(exec);
    } catch (err) {
      if ((err as Error & { code?: string }).code === 'exec_en_locked') {
        throw new BadRequestException({ error: 'exec_en_locked' });
      }
      throw err;
    }
    const en = String(input?.en ?? '').trim();
    if (!en) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['en is required'],
      });
    }
    const updated = await this.repo.updateReportVersionSnapshot(reportId, versionId, {
      ...snapshot,
      exec: { vi: exec.vi, en, en_status: 'draft' },
    });
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async approveReportExecEn(
    reportId: number,
    versionId: number,
    scope: ClientScopeContext,
    actor: string,
  ): Promise<ResearchReportVersionRow> {
    const report = await this.repo.getReport(reportId);
    if (!report) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(report.project_id, scope);
    const version = await this.repo.getReportVersion(reportId, versionId);
    if (!version) throw new NotFoundException({ error: 'not_found' });
    try {
      assertNotSelfApprove(version.generated_by, actor);
    } catch (err) {
      if ((err as Error & { code?: string }).code === 'cannot_self_approve') {
        throw new ForbiddenException({ error: 'cannot_self_approve' });
      }
      throw err;
    }
    const snapshot = { ...version.content_snapshot };
    const exec = normalizeReportExec(snapshot.exec);
    try {
      assertExecEnEditable(exec);
    } catch (err) {
      if ((err as Error & { code?: string }).code === 'exec_en_locked') {
        throw new BadRequestException({ error: 'exec_en_locked' });
      }
      throw err;
    }
    const en = String(exec.en ?? '').trim();
    if (!en) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['en is required'],
      });
    }
    const updated = await this.repo.updateReportVersionSnapshot(reportId, versionId, {
      ...snapshot,
      exec: { vi: exec.vi, en: exec.en, en_status: 'approved' },
    });
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async updateReportEmbargo(
    reportId: number,
    versionId: number,
    scope: ClientScopeContext,
    input: UpdateReportEmbargoInput,
  ): Promise<ResearchReportVersionRow> {
    const report = await this.repo.getReport(reportId);
    if (!report) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(report.project_id, scope);
    const version = await this.repo.getReportVersion(reportId, versionId);
    if (!version) throw new NotFoundException({ error: 'not_found' });
    const patch: UpdateReportEmbargoInput = {};
    if (input.embargo_until !== undefined) {
      patch.embargo_until = parseOptionalIso(input.embargo_until, 'embargo_until');
    }
    if (input.expires_at !== undefined) {
      patch.expires_at = parseOptionalIso(input.expires_at, 'expires_at');
    }
    const updated = await this.repo.updateReportVersionEmbargo(reportId, versionId, patch);
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    return updated;
  }

  async publishPortal(
    reportId: number,
    versionId: number,
    scope: ClientScopeContext,
    input: PublishPortalInput,
    actor: string,
  ): Promise<ResearchReportVersionRow> {
    const report = await this.repo.getReport(reportId);
    if (!report) throw new NotFoundException({ error: 'not_found' });
    const project = await this.loadScopedProject(report.project_id, scope);
    const version = await this.repo.getReportVersion(reportId, versionId);
    if (!version) throw new NotFoundException({ error: 'not_found' });
    if (typeof input?.visible !== 'boolean') {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['visible is required'],
      });
    }
    if (input.visible) {
      const insightIds = snapshotInsightIds(version.content_snapshot);
      const statuses: Array<string | null | undefined> = [];
      for (const id of insightIds) {
        const insight = await this.repo.getInsight(id);
        statuses.push(insight?.status);
      }
      try {
        assertPublishableInsights(statuses);
      } catch (err) {
        if ((err as Error & { code?: string }).code === 'insights_not_client_facing') {
          throw new BadRequestException({ error: 'insights_not_client_facing' });
        }
        throw err;
      }
      try {
        assertNotSelfApprove(version.generated_by, actor);
      } catch (err) {
        if ((err as Error & { code?: string }).code === 'cannot_self_approve') {
          throw new ForbiddenException({ error: 'cannot_self_approve' });
        }
        throw err;
      }
      const ids = collectReportInsightIds(version.content_snapshot);
      const validToById = await this.repo.listInsightValidToForProject(project.id, ids);
      const baked = bakePublishedValidTo(version.content_snapshot, validToById);
      await this.repo.updateReportVersionSnapshot(reportId, versionId, {
        ...version.content_snapshot,
        findings: baked.findings,
        recs: baked.recs,
      });
    }
    const updated = await this.repo.updateReportVersionPortalVisible(
      reportId,
      versionId,
      input.visible,
      actor,
    );
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    if (input.visible && project.status === 'approved') {
      await this.repo.patchProject(project.id, { status: 'distributed' }, actor);
    }
    return updated;
  }

  private async loadApprovedInsights(
    projectId: number,
    rawIds: unknown,
  ): Promise<ResearchInsightRow[]> {
    const insightIds = normalizePositiveIds(rawIds);
    if (insightIds.length === 0) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['insight_ids is required'],
      });
    }
    const insights: ResearchInsightRow[] = [];
    for (const id of insightIds) {
      const insight = await this.repo.getInsight(id);
      if (!insight || insight.project_id !== projectId) {
        throw new BadRequestException({
          error: 'validation_error',
          messages: ['insight_ids is invalid'],
        });
      }
      if (!APPROVED_INTERNAL_PLUS.includes(insight.status)) {
        throw new BadRequestException({
          error: 'validation_error',
          messages: ['insight must be approved_internal+'],
        });
      }
      insights.push(insight);
    }
    return insights;
  }

  private async snapshotFromInsights(
    project: ResearchProjectRow,
    insights: ResearchInsightRow[],
    selectedInsightIds: number[],
    llmDraft?: Record<string, unknown> | null,
    methodology?: MethodologyBlock,
  ): Promise<ResearchReportSnapshot> {
    const [questions, evidence] = await Promise.all([
      this.repo.listQuestions(project.id),
      this.repo.listEvidence(project.id),
    ]);
    const nextVersion = await this.nextReportVersion(project.id);
    return buildReportSnapshot({
      project,
      insights,
      questions,
      evidence,
      selectedInsightIds,
      version: nextVersion,
      llmDraft,
      methodology,
    });
  }

  private assertMethodologyForTier(
    tier: ResearchProjectRow['dv12_tier'],
    raw?: MethodologyBlock | null,
  ): MethodologyBlock {
    const methodology: MethodologyBlock = raw ?? CB_METHODOLOGY_STUB;
    try {
      assertMethodologyExportable(tier, methodology);
    } catch (err) {
      if ((err as Error & { code?: string }).code === 'methodology_incomplete') {
        throw new BadRequestException({ error: 'methodology_incomplete' });
      }
      throw err;
    }
    return methodology;
  }

  private async nextReportVersion(projectId: number): Promise<number> {
    const reports = await this.repo.listReports(projectId);
    const latest = reports.at(-1);
    const maxVersion = latest?.versions.reduce((max, row) => Math.max(max, row.version), 0) ?? 0;
    return maxVersion + 1;
  }

  private async loadScopedInsight(
    insightId: number,
    scope: ClientScopeContext,
  ): Promise<ResearchInsightRow> {
    const existing = await this.repo.getInsight(insightId);
    if (!existing) throw new NotFoundException({ error: 'not_found' });
    await this.loadScopedProject(existing.project_id, scope);
    return existing;
  }

  private assertInsightContentMutable(status: InsightStatus): void {
    if (status === 'approved_internal' || status === 'approved_client_facing' || status === 'published') {
      throw new ConflictException({ error: 'invalid_transition' });
    }
  }

  private assertInsightGate(
    verifiedEvidenceCount: number,
    confidenceRationale: string | null,
    confidenceRubric?: ConfidenceRubric | null,
  ): void {
    const gate = evaluateInsightGate({ verifiedEvidenceCount, confidenceRationale, confidenceRubric });
    if (!gate.ok) {
      throw new BadRequestException({ error: gate.error, messages: gate.messages });
    }
  }

  private assertConfidenceWording(
    rationale: string | null | undefined,
    raw: ConfidenceRubric | ConfidenceJson | null | undefined,
  ): void {
    try {
      assertNoFakeConfidence(String(rationale || ''), Boolean(extractRubric(raw)?.statistical_inference));
    } catch (err) {
      if ((err as Error & { code?: string }).code === 'forbidden_confidence_wording') {
        throw new BadRequestException({
          error: 'insight_gate',
          messages: ['forbidden_confidence_wording'],
        });
      }
      throw err;
    }
  }

  private async resolveSingleSource(projectId: number, evidenceIds: number[]): Promise<boolean> {
    const ids = (Array.isArray(evidenceIds) ? evidenceIds : [])
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) return false;
    const sources: ResearchSourceRow[] = [];
    const seen = new Set<number>();
    for (const evId of ids) {
      const ev = await this.repo.getEvidence(evId);
      if (!ev || ev.project_id !== projectId || ev.source_id == null) continue;
      if (seen.has(ev.source_id)) continue;
      seen.add(ev.source_id);
      const src = await this.repo.getSource(ev.source_id);
      if (src) sources.push(src);
    }
    if (sources.length === 0) return false;
    if (sources.some((s) => s.single_source_accepted)) return true;
    return sources.length === 1 && !sources[0].triangulated;
  }

  private withComputedConfidence<T extends { confidence_json?: ConfidenceRubric | ConfidenceJson }>(
    input: T,
    singleSource = false,
  ): T {
    if (input.confidence_json == null) return input;
    const rubric = extractRubric(input.confidence_json) ?? (input.confidence_json as ConfidenceRubric);
    return { ...input, confidence_json: buildConfidenceJson({ rubric, single_source: singleSource }) };
  }

  private assertMutable(qcStatus: string): void {
    try {
      assertEvidenceMutable(qcStatus);
    } catch (err) {
      if ((err as Error & { code?: string }).code === 'evidence_immutable') {
        throw new ConflictException({ error: 'evidence_immutable' });
      }
      throw err;
    }
  }

  private resolvePiiClass(input: CreateEvidenceInput): { pii_class: string; pii_warning: boolean } {
    const provided = input.pii_class != null && String(input.pii_class).trim() !== '';
    if (input.excerpt && piiHint(input.excerpt) && !provided) {
      return { pii_class: 'internal', pii_warning: true };
    }
    return { pii_class: provided ? String(input.pii_class).trim() : 'none', pii_warning: false };
  }

  private sanitizeAliases(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((a) => String(a).trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  private effectiveSimilarwebTier(source: ResearchSourceRow): string {
    const hay = `${source.publisher ?? ''} ${source.url ?? ''}`.toLowerCase();
    const paid = /similarweb|semrush|sparktoro/.test(hay);
    const tier = String(source.reliability_tier ?? '').trim();
    if (paid && (tier === 'unknown' || tier === '')) return 'medium';
    return source.reliability_tier;
  }

  private async assertSourceInProject(
    projectId: number,
    sourceId?: number | null,
  ): Promise<ResearchSourceRow | undefined> {
    if (sourceId == null) return undefined;
    const source = await this.repo.getSource(sourceId);
    if (!source || source.project_id !== projectId) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['source_id is invalid'],
      });
    }
    return source;
  }

  private async assertStudyInProject(
    projectId: number,
    studyId?: number | null,
  ): Promise<ResearchStudy | undefined> {
    if (studyId == null) return undefined;
    const study = await this.repo.getStudy(studyId);
    if (!study || study.project_id !== projectId) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['study_id is invalid'],
      });
    }
    return study;
  }

  private applyStudyEvidenceGates(input: CreateEvidenceInput, study?: ResearchStudy): void {
    if (input.study_id == null) return;
    if (study?.method === 'survey' && isSurveyEvidenceLocator(String(input.locator ?? ''))) {
      try {
        assertExcerptNotRawTranscript(input.excerpt);
      } catch (err) {
        this.rethrowUtilCode(err, ['raw_transcript_forbidden']);
      }
      return;
    }
    try {
      assertTranscriptLocator(String(input.locator ?? ''));
      assertExcerptNotRawTranscript(input.excerpt);
    } catch (err) {
      this.rethrowUtilCode(err, ['invalid_transcript_locator', 'raw_transcript_forbidden']);
    }
  }

  private rethrowUtilCode(err: unknown, allowed: string[]): never {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
    if (allowed.includes(code)) {
      throw new BadRequestException({ error: code, messages: [code] });
    }
    throw err;
  }

  private optionalText(value: string | null | undefined): string | null {
    if (value == null) return null;
    const s = String(value).trim();
    return s || null;
  }

  private optionalPositiveInt(value: number | null | undefined): number | null {
    if (value == null) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['n must be a positive integer'],
      });
    }
    return n;
  }

  private optionalDate(value: string | null | undefined, field: string): string | null {
    if (value == null || String(value).trim() === '') return null;
    const s = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: [`${field} must be YYYY-MM-DD`],
      });
    }
    return s;
  }

  private optionalStudyMode(value: string | null | undefined): string | null {
    if (value == null || String(value).trim() === '') return null;
    const mode = String(value).trim();
    if (!STUDY_MODES.includes(mode as (typeof STUDY_MODES)[number])) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['mode is invalid'],
      });
    }
    return mode;
  }

  private async toDetail(project: ResearchProjectRow): Promise<ResearchProjectDetail> {
    const [questions, sources, evidence, insights, ai_runs, trend_signals, tavily_credits_used] =
      await Promise.all([
        this.repo.listQuestions(project.id),
        this.repo.listSources(project.id),
        this.repo.listEvidence(project.id),
        this.repo.listInsights(project.id),
        this.repo.listRecentAiRuns(project.id),
        this.repo.listTrendSignals(project.id),
        this.repo.sumTavilyCredits(project.id),
      ]);
    return {
      ...project,
      questions,
      sources,
      evidence,
      insights,
      ai_runs,
      trend_signals,
      tavily_credits_used,
      tavily_credits_limit: this.config.maxTavilyCreditsPerResearch,
      deep_research_provider: this.config.researchDeepProvider,
      valid_transitions: listValidTransitions(project.status, {
        rqCount: project.rq_count,
        verifiedInsightCount: project.verified_insight_count,
      }),
    };
  }
}

function sanitizeSynonyms(raw?: string[]): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const s = String(item ?? '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function isAllowedWhisperTemp(tempPath: string): boolean {
  const resolved = resolvePath(tempPath);
  const tempRoot = resolvePath(tmpdir());
  return dirname(resolved) === tempRoot && basename(resolved).startsWith('research-whisper-');
}

async function unlinkQuiet(tempPath: string | undefined): Promise<void> {
  if (!tempPath || !isAllowedWhisperTemp(tempPath)) return;
  try {
    await unlink(tempPath);
  } catch {
    // already gone
  }
}

function parseFactNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizePositiveIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const value of raw) {
    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function snapshotInsightIds(snapshot: Record<string, unknown>): number[] {
  return normalizePositiveIds(snapshot.insight_ids);
}

function parseOptionalIso(value: string | null, field: string): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) {
    throw new BadRequestException({
      error: 'validation_error',
      messages: [`${field} must be ISO or null`],
    });
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException({
      error: 'validation_error',
      messages: [`${field} must be ISO or null`],
    });
  }
  return text;
}

function hashPrompt(system: string, user: string): string {
  return createHash('sha256').update(`${system}\n---\n${user}`).digest('hex').slice(0, 16);
}

function asTrimmed(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeInsightDraft(parsed: Record<string, unknown>): CreateInsightInput {
  return {
    statement: asTrimmed(parsed.statement) ?? '',
    observation: asTrimmed(parsed.observation),
    interpretation: asTrimmed(parsed.interpretation),
    implication: asTrimmed(parsed.implication),
    recommendation: asTrimmed(parsed.recommendation),
    confidence_rationale: asTrimmed(parsed.confidence_rationale),
    ai_generated: true,
  };
}

function errorCode(err: ServiceUnavailableException): string | null {
  const body = err.getResponse();
  if (body && typeof body === 'object' && 'error' in body) {
    return String((body as { error?: unknown }).error ?? '') || null;
  }
  return null;
}

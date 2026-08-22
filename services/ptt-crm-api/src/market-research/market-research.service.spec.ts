import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { MarketResearchService } from './market-research.service';
import {
  CODEBOOK_LIMITATION,
  type ResearchEvidenceRow,
  type ResearchInsightRow,
  type ResearchProjectRow,
  type ResearchReportVersionRow,
} from './market-research.types';
import { transcribeAudio } from './whisper-transcribe';
import { collectSparkToro } from './sparktoro-collect';
import { collectQualtrics } from './qualtrics-collect';
import { collectTalkwalker } from './talkwalker-collect';
import { computeVanWestendorp } from './van-westendorp.util';
import { embedInsightText, insightEmbedText, isRagCorpusStatus } from './research-rag.util';
import { fetchOpenAIEmbedding } from './openai-embed.util';
import * as pdfUtil from './market-research-pdf.util';
import * as docxUtil from './market-research-docx.util';
import { REPORT_PDF_STALE_FOOTER_STAFF } from './report-pdf-stale.util';
import { OPENAI_EMBED_MODEL, RAG_EMBED_DIMS } from './market-research.types';

jest.mock('./openai-embed.util', () => ({
  fetchOpenAIEmbedding: jest.fn(),
}));

jest.mock('./whisper-transcribe', () => ({
  transcribeAudio: jest.fn(),
}));

jest.mock('./sparktoro-collect', () => ({
  collectSparkToro: jest.fn(),
}));

jest.mock('./qualtrics-collect', () => ({
  collectQualtrics: jest.fn(),
}));

jest.mock('./talkwalker-collect', () => ({
  collectTalkwalker: jest.fn(),
}));

const project: ResearchProjectRow = {
  id: 9,
  client_id: 'acme',
  client_name: 'Acme',
  lifecycle_id: null,
  title: 'Secret title must not leak',
  product_type: 'CAT_REVIEW',
  dv12_tier: 'CB',
  decision_statement: 'Quyết định có mở SKU premium Q4 hay không.',
  geo: ['VN'],
  languages: ['vi'],
  risk_class: 'low',
  status: 'intake',
  owner_user_id: null,
  data_residency: null,
  related_sales_market_id: null,
  created_by: 'am@ptt',
  updated_by: 'am@ptt',
  created_at: '2026-08-14',
  updated_at: '2026-08-14',
  rq_count: 0,
  verified_insight_count: 0,
};

describe('MarketResearchService', () => {
  const repo = {
    getProjectClientId: jest.fn(),
    getProject: jest.fn(),
    listProjects: jest.fn(),
    getOpsAnalytics: jest.fn(),
    getIsoGapFacts: jest.fn(),
    getThemeQuarterAnalytics: jest.fn(),
    createProject: jest.fn(),
    listQuestions: jest.fn(),
    listSources: jest.fn(),
    listEvidence: jest.fn(),
    listInsights: jest.fn(),
    listInsightValidToForProject: jest.fn().mockResolvedValue(new Map()),
    patchProject: jest.fn(),
    createSource: jest.fn(),
    getSource: jest.fn(),
    patchSourceKeep: jest.fn(),
    createEvidence: jest.fn(),
    getEvidence: jest.fn(),
    patchEvidence: jest.fn(),
    verifyEvidence: jest.fn(),
    supersedeEvidence: jest.fn(),
    getInsight: jest.fn(),
    countVerifiedEvidenceForInsight: jest.fn(),
    updateInsightStatus: jest.fn(),
    insertReview: jest.fn(),
    replaceInsightEvidence: jest.fn(),
    patchInsight: jest.fn(),
    getQuestion: jest.fn(),
    findInFlightDeskRun: jest.fn(),
    findInFlightDeepRun: jest.fn(),
    findInFlightTriangulateRun: jest.fn(),
    findInFlightPulseRun: jest.fn(),
    insertTrendSignal: jest.fn(),
    listTrendSignals: jest.fn(),
    acceptSingleSource: jest.fn(),
    insertAiRun: jest.fn(),
    failAiRun: jest.fn(),
    succeedAiRun: jest.fn(),
    getAiRun: jest.fn(),
    listRecentAiRuns: jest.fn(),
    sumTavilyCredits: jest.fn(),
    createInsight: jest.fn(),
    upsertInsightEmbedding: jest.fn(),
    deleteInsightEmbedding: jest.fn(),
    listEmbeddings: jest.fn(),
    listEmbeddingsByVec: jest.fn(),
    countReembedStale: jest.fn(),
    listReembedCandidates: jest.fn(),
    listTaxonomy: jest.fn(),
    getTaxonomy: jest.fn(),
    createTaxonomy: jest.fn(),
    patchTaxonomy: jest.fn(),
    attachInsightTheme: jest.fn(),
    detachInsightTheme: jest.fn(),
    createReportDraft: jest.fn(),
    insertReportVersion: jest.fn(),
    listReports: jest.fn(),
    getReport: jest.fn(),
    getReportVersion: jest.fn(),
    updateReportVersionSnapshot: jest.fn(),
    updateReportVersionEmbargo: jest.fn(),
    updateReportVersionPortalVisible: jest.fn(),
    listCompetitors: jest.fn(),
    getCompetitor: jest.fn(),
    createCompetitor: jest.fn(),
    patchCompetitor: jest.fn(),
    createCompetitorSnapshot: jest.fn(),
    listStudies: jest.fn(),
    getStudy: jest.fn(),
    createStudy: jest.fn(),
    patchStudy: jest.fn(),
    listConsents: jest.fn(),
    createConsent: jest.fn(),
    listApprovedInsightsByClient: jest.fn(),
    findConsultFormDataByClientId: jest.fn(),
    listWaves: jest.fn(),
    createWave: jest.fn(),
    insertVwSummary: jest.fn(),
    getLatestVwSummary: jest.fn(),
    insertCjSummary: jest.fn(),
    insertCjWhatIfRun: jest.fn(),
    listCjWhatIfRuns: jest.fn(),
    getLatestCjSummary: jest.fn(),
    listDecisions: jest.fn(),
    createDecision: jest.fn(),
    getDecision: jest.fn(),
    patchDecision: jest.fn(),
    probePgvectorReady: jest.fn().mockResolvedValue(false),
    probeIvfflatReady: jest.fn().mockResolvedValue(false),
  };
  const plans = {
    getPlanById: jest.fn(),
    patchPlan: jest.fn(),
  };
  const llm = {
    isConfigured: jest.fn(),
    completeJson: jest.fn(),
  };
  const clientScope = {
    allowedClientIdsForList: jest.fn(),
    assertListClientFilter: jest.fn(),
  };
  const jobQueue = {
    enqueueResearchDeskJob: jest.fn(),
    enqueueResearchDeepJob: jest.fn(),
    enqueueResearchTriangulateJob: jest.fn(),
    enqueueResearchPulseJob: jest.fn(),
    enqueueResearchWhisperJob: jest.fn(),
    enqueueResearchSparktoroJob: jest.fn(),
    enqueueResearchQualtricsJob: jest.fn(),
    enqueueResearchRagReembedJob: jest.fn(),
  };
  const opsAlerts = {
    upsertAlert: jest.fn(),
  };
  const contentItems = {
    findItemById: jest.fn(),
    patchItem: jest.fn(),
  };
  const contentMarketing = {
    getContext: jest.fn(),
    getLifecycleClientId: jest.fn(),
  };
  const config = {
    researchDeepProvider: 'openai',
    maxTavilyCreditsPerResearch: 12,
    researchSparktoroEnabled: false,
    sparktoroApiKey: '',
    researchQualtricsEnabled: false,
    qualtricsApiKey: '',
    qualtricsDatacenter: '',
    researchTalkwalkerEnabled: false,
    talkwalkerAccessToken: '',
    talkwalkerProjectId: '',
    researchRagEnabled: false,
    researchRagOpenaiEmbedEnabled: false,
    researchRagPgvectorEnabled: false,
  };

  let service: MarketResearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.researchDeepProvider = 'openai';
    config.maxTavilyCreditsPerResearch = 12;
    config.researchSparktoroEnabled = false;
    config.sparktoroApiKey = '';
    config.researchQualtricsEnabled = false;
    config.qualtricsApiKey = '';
    config.qualtricsDatacenter = '';
    config.researchTalkwalkerEnabled = false;
    config.talkwalkerAccessToken = '';
    config.talkwalkerProjectId = '';
    config.researchRagEnabled = false;
    config.researchRagOpenaiEmbedEnabled = false;
    config.researchRagPgvectorEnabled = false;
    (fetchOpenAIEmbedding as jest.Mock).mockReset();
    repo.listTrendSignals.mockResolvedValue([]);
    llm.isConfigured.mockReturnValue(true);
    service = new MarketResearchService(
      repo as never,
      clientScope as never,
      jobQueue as never,
      config as never,
      llm as never,
      plans as never,
      opsAlerts as never,
      contentItems as never,
      contentMarketing as never,
    );
  });

  function stubScopedProject(): void {
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(project);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
  }

  function pulseCompetitorWithPriceDiff() {
    return {
      id: 4,
      project_id: 9,
      name: 'Rival',
      aliases: [],
      snapshots: [
        {
          id: 1,
          competitor_id: 4,
          project_id: 9,
          source_id: 1,
          observed_at: '2026-08-01',
          kind: 'fact',
          fact: { price: '10' },
          limitation_note: null,
          created_by: 'am@ptt',
          created_at: '2026-08-01',
        },
        {
          id: 2,
          competitor_id: 4,
          project_id: 9,
          source_id: 2,
          observed_at: '2026-08-14',
          kind: 'fact',
          fact: { price: '12' },
          limitation_note: null,
          created_by: 'am@ptt',
          created_at: '2026-08-14',
        },
      ],
    };
  }

  it('createProject throws validation_error without hitting the repository', async () => {
    await expect(
      service.createProject({ restricted: false, allowedClientIds: [] }, {} as never, 'am@ptt'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createProject).not.toHaveBeenCalled();
  });

  it('getPrefill returns empty JSON when no consult row exists — never 404', async () => {
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.findConsultFormDataByClientId.mockResolvedValue(null);

    const out = await service.getPrefill({ restricted: true, allowedClientIds: ['acme'] }, 'acme');
    expect(out).toEqual({ industry: null, competitor_names: [], suggested_rqs: [] });
    expect(repo.findConsultFormDataByClientId).toHaveBeenCalledWith('acme');
  });

  it('getPrefill form containing 0909 does not include that number', async () => {
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.findConsultFormDataByClientId.mockResolvedValue({
      industry: 'Sữa uống 0909123456',
      top_competitors: 'Vinamilk 0909888777',
      phone: '0909123456',
      email: 'am@acme.vn',
      name: 'Nguyen Van A',
    });

    const out = await service.getPrefill({ restricted: true, allowedClientIds: ['acme'] }, 'acme');
    const blob = JSON.stringify(out);
    expect(blob).not.toContain('0909');
    expect(blob).not.toContain('am@acme.vn');
    expect(blob).not.toContain('Nguyen Van A');
    expect(out.industry).toBe('Sữa uống');
    expect(out.competitor_names).toEqual(['Vinamilk']);
  });

  it('createProject with prefill_competitors creates draft competitors name-only', async () => {
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.createProject.mockResolvedValue(project);
    repo.listQuestions.mockResolvedValue([]);
    repo.listSources.mockResolvedValue([]);
    repo.listEvidence.mockResolvedValue([]);
    repo.listInsights.mockResolvedValue([]);
    repo.listRecentAiRuns.mockResolvedValue([]);
    repo.sumTavilyCredits.mockResolvedValue(0);
    repo.createCompetitor.mockResolvedValue({
      id: 1,
      project_id: 9,
      name: 'Vinamilk',
      aliases: [],
      created_by: 'am@ptt',
      created_at: '2026-08-14',
      updated_at: '2026-08-14',
      snapshots: [],
    });

    await service.createProject(
      { restricted: true, allowedClientIds: ['acme'] },
      {
        client_id: 'acme',
        title: 'Category review sữa uống 2026',
        product_type: 'CAT_REVIEW',
        decision_statement: 'Quyết định có mở SKU premium Q4 hay không.',
        questions: [{ question_vi: 'Quy mô thị trường sữa uống VN?' }],
        prefill_competitors: ['Vinamilk', 'TH True Milk 0909888777', ''],
      },
      'am@ptt',
    );

    expect(repo.createCompetitor).toHaveBeenCalledTimes(2);
    expect(repo.createCompetitor).toHaveBeenNthCalledWith(
      1,
      9,
      { name: 'Vinamilk', aliases: [] },
      'am@ptt',
    );
    expect(repo.createCompetitor).toHaveBeenNthCalledWith(
      2,
      9,
      { name: 'TH True Milk', aliases: [] },
      'am@ptt',
    );
    expect(repo.createCompetitorSnapshot).not.toHaveBeenCalled();
  });

  it('getProject toDetail uses config maxTavilyCreditsPerResearch', async () => {
    stubScopedProject();
    repo.listQuestions.mockResolvedValue([]);
    repo.listSources.mockResolvedValue([]);
    repo.listEvidence.mockResolvedValue([]);
    repo.listInsights.mockResolvedValue([]);
    repo.listRecentAiRuns.mockResolvedValue([]);
    repo.sumTavilyCredits.mockResolvedValue(0);
    config.maxTavilyCreditsPerResearch = 6;

    const out = await service.getProject(9, { restricted: true, allowedClientIds: ['acme'] });
    expect(out.tavily_credits_limit).toBe(6);
  });

  it('P18 getProject passes is_stale on insight rows', async () => {
    stubScopedProject();
    repo.listQuestions.mockResolvedValue([]);
    repo.listSources.mockResolvedValue([]);
    repo.listEvidence.mockResolvedValue([]);
    repo.listInsights.mockResolvedValue([
      insightRow({ id: 1, valid_to: '2020-01-01', is_stale: true }),
      insightRow({ id: 2, valid_to: '2099-01-01', is_stale: false }),
    ]);
    repo.listRecentAiRuns.mockResolvedValue([]);
    repo.listTrendSignals.mockResolvedValue([]);
    repo.sumTavilyCredits.mockResolvedValue(0);

    const out = await service.getProject(9, { restricted: true, allowedClientIds: ['acme'] });
    expect(out.insights?.[0]?.is_stale).toBe(true);
    expect(out.insights?.[1]?.is_stale).toBe(false);
  });

  it('getProject outside scope is 403 without title in the body', async () => {
    repo.getProjectClientId.mockResolvedValue('other-client');
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    try {
      await service.getProject(9, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('Secret title');
    }
    expect(repo.getProject).not.toHaveBeenCalled();
  });

  it('P37 getIsoGapCheck returns checklist without title or certified wording', async () => {
    stubScopedProject();
    repo.getIsoGapFacts.mockResolvedValue({
      decision_statement: project.decision_statement,
      product_type: project.product_type,
      dv12_tier: project.dv12_tier,
      geo: project.geo,
      rq_count: 1,
      source_count: 0,
      verified_evidence_count: 0,
      study_count: 0,
      ai_run_count: 0,
      review_count: 0,
      draft_count: 0,
      published_count: 0,
      acf_count: 0,
      acf_with_verified_evidence: 0,
      report_version_count: 0,
      latest_report_methodology: null,
      latest_report_findings_count: 0,
    });

    const out = await service.getIsoGapCheck(9, { restricted: true, allowedClientIds: ['acme'] });
    expect(out.ok).toBe(true);
    expect(out.project_id).toBe(9);
    expect(out.product_type).toBe('CAT_REVIEW');
    expect(out.items.length).toBeGreaterThan(0);
    expect(out.summary.fail).toBeGreaterThan(0);
    expect(JSON.stringify(out)).not.toContain('Secret title');
    expect(JSON.stringify(out)).not.toMatch(/ISO certified|đạt chuẩn ISO 20252/i);
    expect(repo.getIsoGapFacts).toHaveBeenCalledWith(9);
  });

  it('P37 getIsoGapCheck outside scope is 403', async () => {
    repo.getProjectClientId.mockResolvedValue('other-client');
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    await expect(
      service.getIsoGapCheck(9, { restricted: true, allowedClientIds: ['acme'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.getIsoGapFacts).not.toHaveBeenCalled();
  });

  it('patchProject intake→designed with rqCount=0 is invalid_transition need_rq', async () => {
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(project);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    try {
      await service.patchProject(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { status: 'designed' },
        'am@ptt',
      );
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({
        error: 'invalid_transition',
        reason: 'need_rq',
      });
    }
    expect(repo.patchProject).not.toHaveBeenCalled();
  });

  it('createSnapshot without source_id is 400 validation_error', async () => {
    stubScopedProject();
    repo.getCompetitor.mockResolvedValue({
      id: 4,
      project_id: 9,
      name: 'Vinamilk',
      aliases: [],
      created_by: 'am@ptt',
      created_at: '2026-08-14',
      updated_at: '2026-08-14',
      snapshots: [],
    });

    try {
      await service.createSnapshot(
        4,
        { restricted: true, allowedClientIds: ['acme'] },
        { observed_at: '2026-08-01', kind: 'fact', fact: { price: '12000' } },
        'am@ptt',
      );
      throw new Error('expected validation_error');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({
        error: 'validation_error',
        messages: expect.arrayContaining(['source_id is required']),
      });
    }
    expect(repo.createCompetitorSnapshot).not.toHaveBeenCalled();
  });

  it('createSnapshot invalid observed_at is 400 validation_error', async () => {
    stubScopedProject();
    repo.getCompetitor.mockResolvedValue(competitorRow());

    try {
      await service.createSnapshot(
        4,
        { restricted: true, allowedClientIds: ['acme'] },
        { source_id: 11, observed_at: '14/08/2026', kind: 'fact', fact: { price: '12000' } },
        'am@ptt',
      );
      throw new Error('expected validation_error');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'validation_error' }),
      );
    }
    expect(repo.createCompetitorSnapshot).not.toHaveBeenCalled();
    expect(repo.getSource).not.toHaveBeenCalled();
  });

  it('createSnapshot Similarweb unknown tier with limitation_note inserts', async () => {
    stubScopedProject();
    repo.getCompetitor.mockResolvedValue(competitorRow());
    repo.getSource.mockResolvedValue(
      similarwebSource({ reliability_tier: 'unknown' }),
    );
    repo.createCompetitorSnapshot.mockResolvedValue({
      id: 1,
      competitor_id: 4,
      project_id: 9,
      source_id: 11,
      observed_at: '2026-08-01',
      kind: 'fact',
      fact: { price: '12000' },
      limitation_note: 'Paid panel estimate',
      created_by: 'am@ptt',
      created_at: '2026-08-14',
    });

    await service.createSnapshot(
      4,
      { restricted: true, allowedClientIds: ['acme'] },
      {
        source_id: 11,
        observed_at: '2026-08-01',
        kind: 'fact',
        fact: { price: '12000' },
        limitation_note: 'Paid panel estimate',
      },
      'am@ptt',
    );

    expect(repo.createCompetitorSnapshot).toHaveBeenCalled();
  });

  it('createSnapshot Similarweb unknown tier without note is 400 limitation_required', async () => {
    stubScopedProject();
    repo.getCompetitor.mockResolvedValue(competitorRow());
    repo.getSource.mockResolvedValue(
      similarwebSource({ reliability_tier: 'unknown' }),
    );

    try {
      await service.createSnapshot(
        4,
        { restricted: true, allowedClientIds: ['acme'] },
        { source_id: 11, observed_at: '2026-08-01', kind: 'fact', fact: { price: '12000' } },
        'am@ptt',
      );
      throw new Error('expected limitation_required');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'limitation_required' }),
      );
    }
    expect(repo.createCompetitorSnapshot).not.toHaveBeenCalled();
  });

  it('createSnapshot Similarweb high tier with note is 400 reliability_capped', async () => {
    stubScopedProject();
    repo.getCompetitor.mockResolvedValue(competitorRow());
    repo.getSource.mockResolvedValue(similarwebSource({ reliability_tier: 'high' }));

    try {
      await service.createSnapshot(
        4,
        { restricted: true, allowedClientIds: ['acme'] },
        {
          source_id: 11,
          observed_at: '2026-08-01',
          kind: 'fact',
          fact: { price: '12000' },
          limitation_note: 'Paid panel estimate',
        },
        'am@ptt',
      );
      throw new Error('expected reliability_capped');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'reliability_capped' }),
      );
    }
    expect(repo.createCompetitorSnapshot).not.toHaveBeenCalled();
  });

  it('listCompetitors outside scope is 403 without competitor name in the body', async () => {
    repo.getProjectClientId.mockResolvedValue('other-client');
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.listCompetitors.mockResolvedValue([
      { id: 4, project_id: 9, name: 'SecretRivalName', aliases: [], snapshots: [] },
    ]);

    try {
      await service.listCompetitors(9, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('SecretRivalName');
      expect(JSON.stringify(body)).not.toContain('name');
    }
    expect(repo.listCompetitors).not.toHaveBeenCalled();
  });

  it('createConsent notes containing a phone is 400 consent_pii_forbidden', async () => {
    repo.getStudy.mockResolvedValue({
      id: 4,
      project_id: 9,
      name: 'IDI sữa uống',
      method: 'idi',
      n: 8,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    });
    stubScopedProject();

    try {
      await service.createConsent(
        4,
        { restricted: true, allowedClientIds: ['acme'] },
        { subject_code: 'R-004', consent_type: 'record', notes: 'gọi 0909123456' },
        'am@ptt',
      );
      throw new Error('expected consent_pii_forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'consent_pii_forbidden' }),
      );
    }
    expect(repo.createConsent).not.toHaveBeenCalled();
  });

  it('listStudies outside scope is 403 without study name in the body', async () => {
    repo.getProjectClientId.mockResolvedValue('other-client');
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.listStudies.mockResolvedValue([{ id: 4, project_id: 9, name: 'SecretStudyName', method: 'idi' }]);

    try {
      await service.listStudies(9, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('SecretStudyName');
      expect(JSON.stringify(body)).not.toContain('name');
    }
    expect(repo.listStudies).not.toHaveBeenCalled();
  });

  it('POST wave on CAT_REVIEW is 400 waves_not_tracker', async () => {
    stubScopedProject();

    try {
      await service.createWave(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { wave_no: 1, metric_json: [{ key: 'nps', value: 10 }] },
        'am@ptt',
      );
      throw new Error('expected waves_not_tracker');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'waves_not_tracker' });
    }
    expect(repo.createWave).not.toHaveBeenCalled();
  });

  it('GET waves out of scope is 403 without title', async () => {
    repo.getProjectClientId.mockResolvedValue('other-client');
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.listWaves.mockResolvedValue([
      { id: 1, project_id: 9, wave_no: 1, label: 'Secret title must not leak', metric_json: [] },
    ]);

    try {
      await service.listWaves(9, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('title');
      expect(JSON.stringify(body)).not.toContain('Secret title');
    }
    expect(repo.listWaves).not.toHaveBeenCalled();
    expect(repo.getProject).not.toHaveBeenCalled();
  });

  it('POST decision with draft insight is 400 insight_not_approved', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(insightRow({ status: 'draft' }));

    try {
      await service.createDecision(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        {
          insight_id: 7,
          decision_text: 'Launch premium SKU in Q4 after readout',
          owner_email: 'am@ptt',
        },
        'am@ptt',
      );
      throw new Error('expected insight_not_approved');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'insight_not_approved' });
    }
    expect(repo.createDecision).not.toHaveBeenCalled();
  });

  it('POST decision with 3-char text is 400 validation_error', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(insightRow({ status: 'approved_internal' }));

    try {
      await service.createDecision(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { insight_id: 7, decision_text: 'abc', owner_email: 'am@ptt' },
        'am@ptt',
      );
      throw new Error('expected validation_error');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'validation_error' }),
      );
    }
    expect(repo.createDecision).not.toHaveBeenCalled();
  });

  it('GET decisions out of scope is 403 without title', async () => {
    repo.getProjectClientId.mockResolvedValue('other-client');
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.listDecisions.mockResolvedValue([
      {
        id: 1,
        project_id: 9,
        insight_id: 7,
        decision_text: 'Secret title must not leak',
        owner_email: 'am@ptt',
        due_at: null,
        status: 'open',
        created_by: 'am@ptt',
        created_at: '2026-08-14',
      },
    ]);

    try {
      await service.listDecisions(9, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('title');
      expect(JSON.stringify(body)).not.toContain('Secret title');
    }
    expect(repo.listDecisions).not.toHaveBeenCalled();
    expect(repo.getProject).not.toHaveBeenCalled();
  });

  it('PATCH decision_text is 400 decision_locked', async () => {
    stubScopedProject();
    repo.getDecision.mockResolvedValue({
      id: 3,
      project_id: 9,
      insight_id: 7,
      decision_text: 'Launch premium SKU in Q4 after readout',
      owner_email: 'am@ptt',
      due_at: null,
      status: 'open',
      created_by: 'am@ptt',
      created_at: '2026-08-14',
    });

    try {
      await service.patchDecision(
        3,
        { restricted: true, allowedClientIds: ['acme'] },
        { decision_text: 'Rewrite the locked decision text' },
      );
      throw new Error('expected decision_locked');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'decision_locked' });
    }
    expect(repo.patchDecision).not.toHaveBeenCalled();
  });

  it('createEvidence with study_id and 800-char excerpt is 400 raw_transcript_forbidden', async () => {
    stubScopedProject();
    repo.getStudy.mockResolvedValue({
      id: 4,
      project_id: 9,
      name: 'IDI sữa uống',
      method: 'idi',
      n: 8,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    });

    try {
      await service.createEvidence(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        {
          study_id: 4,
          locator: 'T-12:03',
          excerpt: 'x'.repeat(800),
        },
        'am@ptt',
      );
      throw new Error('expected raw_transcript_forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'raw_transcript_forbidden' }),
      );
    }
    expect(repo.createEvidence).not.toHaveBeenCalled();
  });

  it('createEvidence on IDI study with Q-Q1 locator is 400 invalid_transcript_locator', async () => {
    stubScopedProject();
    repo.getStudy.mockResolvedValue({
      id: 4,
      project_id: 9,
      name: 'IDI sữa uống',
      method: 'idi',
      n: 8,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    });

    try {
      await service.createEvidence(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        {
          study_id: 4,
          locator: 'Q-Q1',
          excerpt: 'quoted line',
        },
        'am@ptt',
      );
      throw new Error('expected invalid_transcript_locator');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'invalid_transcript_locator' }),
      );
    }
    expect(repo.createEvidence).not.toHaveBeenCalled();
  });

  it('createEvidence with value_num but missing unit/base/period/geo is validation_error (BR-RES-02)', async () => {
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(project);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    try {
      await service.createEvidence(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        {
          source_id: 1,
          locator: 'https://example.com#p3',
          value_num: 12.5,
        },
        'am@ptt',
      );
      throw new Error('expected validation_error');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({
        error: 'validation_error',
        messages: expect.arrayContaining(['unit is required', 'value_base is required', 'period_note is required', 'geography is required']),
      });
    }
    expect(repo.createEvidence).not.toHaveBeenCalled();
  });

  it('patchEvidence content when verified is 409 evidence_immutable', async () => {
    const verified: ResearchEvidenceRow = {
      id: 3,
      project_id: 9,
      source_id: 1,
      study_id: null,
      question_id: null,
      locator: 'https://example.com#p3',
      excerpt: 'locked excerpt',
      value_num: null,
      unit: null,
      value_base: null,
      period_note: null,
      geography: null,
      captured_at: '2026-08-14',
      pii_class: 'none',
      qc_status: 'verified',
      checksum: 'abc',
      created_by: 'am@ptt',
      superseded_by: null,
      created_at: '2026-08-14',
    };
    repo.getEvidence.mockResolvedValue(verified);
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(project);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    try {
      await service.patchEvidence(
        3,
        { restricted: true, allowedClientIds: ['acme'] },
        { excerpt: 'changed' },
      );
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'evidence_immutable' });
    }
    expect(repo.patchEvidence).not.toHaveBeenCalled();
  });

  it('patchEvidence locator-only keeps existing pii_class', async () => {
    const existing = evidenceRow({
      pii_class: 'pii_restricted',
      excerpt: 'public market size excerpt',
      qc_status: 'pending',
    });
    repo.getEvidence.mockResolvedValue(existing);
    stubScopedProject();
    repo.patchEvidence.mockImplementation(async (_id, input) => ({
      ...existing,
      locator: input.locator ?? existing.locator,
      pii_class: input.pii_class ?? existing.pii_class,
    }));

    const out = await service.patchEvidence(
      3,
      { restricted: true, allowedClientIds: ['acme'] },
      { locator: 'new' },
    );

    expect(out.pii_class).toBe('pii_restricted');
    expect(repo.patchEvidence).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ locator: 'new', pii_class: 'pii_restricted' }),
    );
  });

  it('patchEvidence when superseded is 409 evidence_immutable', async () => {
    repo.getEvidence.mockResolvedValue(evidenceRow({ qc_status: 'superseded', checksum: 'abc', superseded_by: 4 }));
    stubScopedProject();

    try {
      await service.patchEvidence(
        3,
        { restricted: true, allowedClientIds: ['acme'] },
        { excerpt: 'changed' },
      );
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'evidence_immutable' });
    }
    expect(repo.patchEvidence).not.toHaveBeenCalled();
  });

  it('verifyEvidence when rejected is 409 evidence_immutable', async () => {
    repo.getEvidence.mockResolvedValue(evidenceRow({ qc_status: 'rejected' }));
    stubScopedProject();

    try {
      await service.verifyEvidence(3, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'evidence_immutable' });
    }
    expect(repo.verifyEvidence).not.toHaveBeenCalled();
  });

  it('supersede identical 6-tuple then verify successor does not throw', async () => {
    const verified = evidenceRow({ qc_status: 'verified', checksum: 'abc' });
    const successor = evidenceRow({
      id: 4,
      qc_status: 'pending',
      checksum: null,
      superseded_by: null,
    });
    const verifiedSuccessor = evidenceRow({
      id: 4,
      qc_status: 'verified',
      checksum: 'abc',
    });
    stubScopedProject();
    repo.getSource.mockResolvedValue({ id: 1, project_id: 9 });
    repo.getEvidence.mockResolvedValueOnce(verified).mockResolvedValueOnce(successor);
    repo.supersedeEvidence.mockResolvedValue({
      old: evidenceRow({ qc_status: 'superseded', checksum: 'abc', superseded_by: 4 }),
      evidence: successor,
    });
    repo.verifyEvidence.mockResolvedValue(verifiedSuccessor);

    const body = {
      source_id: 1,
      locator: verified.locator,
      excerpt: verified.excerpt,
      value_num: verified.value_num,
      unit: verified.unit,
      value_base: verified.value_base,
      period_note: verified.period_note,
      geography: verified.geography,
    };
    await expect(
      service.supersedeEvidence(3, { restricted: true, allowedClientIds: ['acme'] }, body, 'am@ptt'),
    ).resolves.toMatchObject({ evidence: { id: 4, qc_status: 'pending' } });
    await expect(
      service.verifyEvidence(4, { restricted: true, allowedClientIds: ['acme'] }),
    ).resolves.toMatchObject({ id: 4, qc_status: 'verified' });
  });

  it('verifyEvidence maps PG unique violation 23505 to 409 evidence_duplicate_checksum', async () => {
    repo.getEvidence.mockResolvedValue(evidenceRow({ qc_status: 'pending' }));
    stubScopedProject();
    const pgErr = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    repo.verifyEvidence.mockRejectedValue(pgErr);

    try {
      await service.verifyEvidence(3, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'evidence_duplicate_checksum' });
    }
  });

  it('submitReview with 0 verified evidence is 400 insight_gate', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({
        confidence_rationale: 'Method OK',
        status: 'draft',
        confidence_json: validRubric,
      }),
    );
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(0);

    try {
      await service.submitReview(7, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected insight_gate');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({
        error: 'insight_gate',
        messages: ['missing_verified_evidence'],
      });
    }
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
  });

  it('submitReview missing rubric is 400 missing_confidence_rubric', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({ confidence_rationale: 'Method OK', status: 'draft', confidence_json: null }),
    );
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);

    try {
      await service.submitReview(7, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected insight_gate');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({
        error: 'insight_gate',
        messages: ['missing_confidence_rubric'],
      });
    }
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
  });

  it('submitReview persists computed confidence_json and sets analyst_verified', async () => {
    stubScopedProject();
    const current = insightRow({
      confidence_rationale: 'Nguồn verified, sample 2025',
      status: 'draft',
      confidence_json: validRubric,
    });
    const verified = insightRow({ ...current, status: 'analyst_verified' });
    repo.getInsight.mockResolvedValue(current);
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);
    repo.patchInsight.mockResolvedValue(current);
    repo.updateInsightStatus.mockResolvedValue(verified);

    const out = await service.submitReview(7, { restricted: true, allowedClientIds: ['acme'] });

    expect(out.status).toBe('analyst_verified');
    expect(repo.patchInsight).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        confidence_json: expect.objectContaining({
          score: 3,
          band: 'high',
          rubric: expect.objectContaining(validRubric),
        }),
      }),
    );
    expect(repo.updateInsightStatus).toHaveBeenCalledWith(7, 'analyst_verified');
  });

  it('submitReview from approved_internal is 409 invalid_transition', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({
        status: 'approved_internal',
        confidence_rationale: 'Method OK',
        confidence_json: validRubric,
      }),
    );
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);

    try {
      await service.submitReview(7, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'invalid_transition' });
    }
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
  });

  it('attachEvidence [] on approved_internal is 409 invalid_transition', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(insightRow({ status: 'approved_internal' }));

    try {
      await service.attachEvidence(7, { restricted: true, allowedClientIds: ['acme'] }, []);
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'invalid_transition' });
    }
    expect(repo.replaceInsightEvidence).not.toHaveBeenCalled();
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
  });

  it('approveInsight by creator is 403 cannot_self_approve', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({
        created_by: 'analyst@ptt',
        status: 'analyst_verified',
        confidence_rationale: 'Method OK',
        confidence_json: validRubric,
      }),
    );
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);

    try {
      await service.approveInsight(
        7,
        { restricted: true, allowedClientIds: ['acme'] },
        { target_status: 'approved_internal', comments: 'ok' },
        'analyst@ptt',
      );
      throw new Error('expected cannot_self_approve');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toEqual({ error: 'cannot_self_approve' });
    }
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
    expect(repo.insertReview).not.toHaveBeenCalled();
  });

  it('approveInsight happy path writes approved_internal and a review', async () => {
    stubScopedProject();
    const current = insightRow({
      created_by: 'analyst@ptt',
      status: 'analyst_verified',
      confidence_rationale: 'Nguồn verified, sample 2025',
      confidence_json: validRubric,
    });
    const approved = insightRow({
      ...current,
      status: 'approved_internal',
    });
    repo.getInsight.mockResolvedValue(current);
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);
    repo.updateInsightStatus.mockResolvedValue(approved);
    repo.insertReview.mockResolvedValue({ id: 1 });

    const out = await service.approveInsight(
      7,
      { restricted: true, allowedClientIds: ['acme'] },
      { target_status: 'approved_internal', comments: 'Method OK' },
      'lead@ptt',
    );

    expect(out.status).toBe('approved_internal');
    expect(repo.updateInsightStatus).toHaveBeenCalledWith(7, 'approved_internal');
    expect(repo.insertReview).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 9,
        object_type: 'insight',
        object_id: 7,
        reviewer: 'lead@ptt',
        decision: 'approve',
        comments: 'Method OK',
      }),
    );
  });

  it('M2-1a: approve to approved_client_facing upserts embedding; createInsight draft does not', async () => {
    stubScopedProject();
    const current = insightRow({
      created_by: 'analyst@ptt',
      status: 'approved_internal',
      confidence_rationale: 'Nguồn verified, sample 2025',
      confidence_json: validRubric,
    });
    const approved = insightRow({
      ...current,
      status: 'approved_client_facing',
    });
    repo.getInsight.mockResolvedValue(current);
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);
    repo.updateInsightStatus.mockResolvedValue(approved);
    repo.insertReview.mockResolvedValue({ id: 1 });

    const out = await service.approveInsight(
      7,
      { restricted: true, allowedClientIds: ['acme'] },
      { target_status: 'approved_client_facing', comments: 'ok' },
      'lead@ptt',
    );

    expect(out.status).toBe('approved_client_facing');
    expect(isRagCorpusStatus(out.status)).toBe(true);
    expect(repo.insertReview).toHaveBeenCalled();
    const embedText = insightEmbedText({
      statement: approved.statement,
      observation: approved.observation,
    });
    expect(repo.upsertInsightEmbedding).toHaveBeenCalledWith(
      expect.objectContaining({
        insight_id: 7,
        project_id: 9,
        embed_text: embedText,
        embedding: embedInsightText(embedText),
        embed_model: 'local-hash',
        embed_dims: RAG_EMBED_DIMS,
      }),
    );
    expect(fetchOpenAIEmbedding).not.toHaveBeenCalled();

    repo.upsertInsightEmbedding.mockClear();
    const draft = insightRow({ status: 'draft' });
    repo.createInsight.mockResolvedValue(draft);
    await service.createInsight(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { statement: draft.statement },
      'analyst@ptt',
    );
    expect(repo.createInsight).toHaveBeenCalled();
    expect(repo.upsertInsightEmbedding).not.toHaveBeenCalled();
  });

  it('M2-1b: email in statement skips upsert; approve still returns the insight', async () => {
    stubScopedProject();
    const current = insightRow({
      created_by: 'analyst@ptt',
      status: 'approved_internal',
      statement: 'Contact analyst@ptt.vn — Premium SKU tăng share',
      confidence_rationale: 'Nguồn verified, sample 2025',
      confidence_json: validRubric,
    });
    const approved = insightRow({
      ...current,
      status: 'approved_client_facing',
    });
    repo.getInsight.mockResolvedValue(current);
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);
    repo.updateInsightStatus.mockResolvedValue(approved);
    repo.insertReview.mockResolvedValue({ id: 1 });

    const out = await service.approveInsight(
      7,
      { restricted: true, allowedClientIds: ['acme'] },
      { target_status: 'approved_client_facing', comments: 'ok' },
      'lead@ptt',
    );

    expect(out.status).toBe('approved_client_facing');
    expect(out.statement).toBe(approved.statement);
    expect(repo.upsertInsightEmbedding).not.toHaveBeenCalled();
  });

  it('runDesk throws job_in_flight when a pending run exists for the question', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Quy mô?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightDeskRun.mockResolvedValue({ id: 55, status: 'pending' });

    try {
      await service.runDesk(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { question_id: 10 },
        'am@ptt',
      );
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'job_in_flight' });
    }
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchDeskJob).not.toHaveBeenCalled();
  });

  it('runDesk marks the run failed jobs_disabled when enqueue returns null', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Quy mô?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightDeskRun.mockResolvedValue(null);
    repo.insertAiRun.mockResolvedValue({
      id: 77,
      project_id: 9,
      question_id: 10,
      job_type: 'desk_tavily',
      provider: 'tavily',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    repo.failAiRun.mockResolvedValue({
      id: 77,
      project_id: 9,
      question_id: 10,
      job_type: 'desk_tavily',
      provider: 'tavily',
      status: 'failed',
      credits_used: 0,
      error_message: 'jobs_disabled',
      created_at: '2026-08-14',
      finished_at: '2026-08-14',
    });
    jobQueue.enqueueResearchDeskJob.mockResolvedValue(null);

    const out = await service.runDesk(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { question_id: 10 },
      'am@ptt',
    );

    expect(out).toEqual({
      ok: true,
      run_id: 77,
      status: 'failed',
      note: 'jobs_disabled',
    });
    expect(repo.failAiRun).toHaveBeenCalledWith(77, 'jobs_disabled');
  });

  it('runDeep throws deep_research_disabled when provider is off', async () => {
    config.researchDeepProvider = 'off';
    stubScopedProject();

    try {
      await service.runDeep(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { question_id: 10 },
        'am@ptt',
      );
      throw new Error('expected 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'deep_research_disabled' });
    }
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchDeepJob).not.toHaveBeenCalled();
  });

  it('runDeep enqueues deep job and does not insert insight', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Quy mô?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightDeepRun.mockResolvedValue(null);
    repo.insertAiRun.mockResolvedValue({
      id: 88,
      project_id: 9,
      question_id: 10,
      job_type: 'deep_research',
      provider: 'openai_fallback_tavily',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchDeepJob.mockResolvedValue({ id: 'job-deep' });

    const out = await service.runDeep(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { question_id: 10 },
      'am@ptt',
    );

    expect(out).toEqual({ ok: true, run_id: 88, status: 'pending' });
    expect(jobQueue.enqueueResearchDeepJob).toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('runTriangulate enqueues research_triangulate and does not insert insight', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Quy mô?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightTriangulateRun.mockResolvedValue(null);
    repo.insertAiRun.mockResolvedValue({
      id: 99,
      project_id: 9,
      question_id: 10,
      job_type: 'research_triangulate',
      provider: 'tavily',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchTriangulateJob.mockResolvedValue({ id: 'job-tri' });

    const out = await service.runTriangulate(
      9,
      10,
      { restricted: true, allowedClientIds: ['acme'] },
      'am@ptt',
    );

    expect(out).toEqual({ ok: true, run_id: 99, status: 'pending' });
    expect(repo.insertAiRun).toHaveBeenCalledWith(
      expect.objectContaining({ jobType: 'research_triangulate' }),
    );
    expect(jobQueue.enqueueResearchTriangulateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 9,
        questionId: 10,
        runId: 99,
        idempotencyKey: 'research_triangulate:9:10:run:99',
      }),
    );
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('runTriangulate throws job_in_flight when a pending triangulate run exists', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Quy mô?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightTriangulateRun.mockResolvedValue({ id: 44, status: 'pending' });

    try {
      await service.runTriangulate(9, 10, { restricted: true, allowedClientIds: ['acme'] }, 'am@ptt');
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'job_in_flight' });
    }
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchTriangulateJob).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('runPulse enqueues research_pulse and does not insert insight', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Giá đối thủ?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightPulseRun.mockResolvedValue(null);
    repo.listCompetitors.mockResolvedValue([]);
    repo.insertAiRun.mockResolvedValue({
      id: 77,
      project_id: 9,
      question_id: 10,
      job_type: 'research_pulse',
      provider: 'tavily',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchPulseJob.mockResolvedValue({ id: 'job-pulse' });

    const out = await service.runPulse(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { question_id: 10 },
      'am@ptt',
    );

    expect(out).toEqual({ ok: true, run_id: 77, status: 'pending' });
    expect(repo.insertAiRun).toHaveBeenCalledWith(
      expect.objectContaining({ jobType: 'research_pulse' }),
    );
    expect(jobQueue.enqueueResearchPulseJob).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 9,
        questionId: 10,
        runId: 77,
        lifecycleId: null,
        idempotencyKey: 'research_pulse:9:10:run:77',
      }),
    );
    expect(repo.insertTrendSignal).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
    expect(repo.createDecision).not.toHaveBeenCalled();
  });

  it('runPulse without lifecycle_id inserts signal and does not upsert alert', async () => {
    stubScopedProject();
    repo.findInFlightPulseRun.mockResolvedValue(null);
    repo.listCompetitors.mockResolvedValue([pulseCompetitorWithPriceDiff()]);
    repo.insertTrendSignal.mockResolvedValue({
      id: 31,
      project_id: 9,
      topic: 'price',
      metric: 'price',
      baseline: 10,
      current: 12,
      velocity: 0.2,
      lifecycle: 'rising',
    });
    repo.insertAiRun.mockResolvedValue({
      id: 78,
      project_id: 9,
      question_id: null,
      job_type: 'research_pulse',
      provider: 'tavily',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchPulseJob.mockResolvedValue(null);

    await service.runPulse(9, { restricted: true, allowedClientIds: ['acme'] }, {}, 'am@ptt');

    expect(repo.insertTrendSignal).toHaveBeenCalled();
    expect(opsAlerts.upsertAlert).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('runPulse jobsEnabled enqueue does not insert trend signal on Nest', async () => {
    stubScopedProject();
    repo.findInFlightPulseRun.mockResolvedValue(null);
    repo.listCompetitors.mockResolvedValue([pulseCompetitorWithPriceDiff()]);
    repo.insertAiRun.mockResolvedValue({
      id: 79,
      project_id: 9,
      question_id: null,
      job_type: 'research_pulse',
      provider: 'tavily',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchPulseJob.mockResolvedValue({ id: 'job-pulse' });

    const out = await service.runPulse(9, { restricted: true, allowedClientIds: ['acme'] }, {}, 'am@ptt');

    expect(out).toEqual({ ok: true, run_id: 79, status: 'pending' });
    expect(repo.insertTrendSignal).not.toHaveBeenCalled();
    expect(opsAlerts.upsertAlert).not.toHaveBeenCalled();
  });

  it('runPulse jobs_disabled with lifecycle_id upserts DV12 alert', async () => {
    stubScopedProject();
    repo.getProject.mockResolvedValue({ ...project, lifecycle_id: 12 });
    repo.findInFlightPulseRun.mockResolvedValue(null);
    repo.listCompetitors.mockResolvedValue([pulseCompetitorWithPriceDiff()]);
    repo.insertTrendSignal.mockResolvedValue({
      id: 31,
      project_id: 9,
      topic: 'price',
      metric: 'price',
      baseline: 10,
      current: 12,
      velocity: 0.2,
      lifecycle: 'rising',
    });
    repo.insertAiRun.mockResolvedValue({
      id: 80,
      project_id: 9,
      question_id: null,
      job_type: 'research_pulse',
      provider: 'tavily',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchPulseJob.mockResolvedValue(null);

    await service.runPulse(9, { restricted: true, allowedClientIds: ['acme'] }, {}, 'am@ptt');

    expect(repo.insertTrendSignal).toHaveBeenCalled();
    expect(opsAlerts.upsertAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        lifecycleId: 12,
        dvCode: 'DV12',
        alertType: 'research_pulse',
        sourceKey: 'research_pulse:9:31',
      }),
    );
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('ingestWhisper with 0 consents is 400 consent_required and does not enqueue', async () => {
    stubScopedProject();
    repo.getStudy.mockResolvedValue({
      id: 4,
      project_id: 9,
      name: 'IDI sữa uống',
      method: 'idi',
      n: 8,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    });
    repo.listConsents.mockResolvedValue([]);
    const tempPath = writeTempAudio();

    try {
      await service.ingestWhisper(
        9,
        4,
        { restricted: true, allowedClientIds: ['acme'] },
        { tempPath },
        'am@ptt',
      );
      throw new Error('expected consent_required');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'consent_required' }),
      );
    }
    expect(jobQueue.enqueueResearchWhisperJob).not.toHaveBeenCalled();
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(fs.existsSync(tempPath)).toBe(false);
  });

  it('ingestWhisper jobs_disabled persists excerpts without transcript or insight', async () => {
    stubScopedProject();
    repo.getStudy.mockResolvedValue({
      id: 4,
      project_id: 9,
      name: 'IDI sữa uống',
      method: 'idi',
      n: 8,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    });
    repo.listConsents.mockResolvedValue([
      {
        id: 1,
        study_id: 4,
        project_id: 9,
        subject_code: 'R-004',
        consent_type: 'record',
        recorded_at: '2026-08-14',
        expires_at: '2028-08-14T00:00:00.000Z',
        notes: null,
      },
    ]);
    repo.insertAiRun.mockResolvedValue({
      id: 77,
      project_id: 9,
      question_id: null,
      job_type: 'whisper_ingest',
      provider: 'openai',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchWhisperJob.mockResolvedValue(null);
    (transcribeAudio as jest.Mock).mockResolvedValue(
      'First sentence is short. Second sentence is also short. Third sentence wraps it up.',
    );
    repo.createEvidence
      .mockResolvedValueOnce(evidenceRow({ id: 101, study_id: 4, locator: 'T-00:00', excerpt: 'First sentence is short.' }))
      .mockResolvedValueOnce(evidenceRow({ id: 102, study_id: 4, locator: 'T-00:30', excerpt: 'Second sentence is also short.' }))
      .mockResolvedValueOnce(evidenceRow({ id: 103, study_id: 4, locator: 'T-01:00', excerpt: 'Third sentence wraps it up.' }));
    repo.succeedAiRun.mockResolvedValue({
      id: 77,
      project_id: 9,
      question_id: null,
      job_type: 'whisper_ingest',
      provider: 'openai',
      status: 'succeeded',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: '2026-08-14',
    });
    const tempPath = writeTempAudio();

    const out = await service.ingestWhisper(
      9,
      4,
      { restricted: true, allowedClientIds: ['acme'] },
      { tempPath },
      'am@ptt',
    );

    expect(out.ok).toBe(true);
    expect(out.excerpt_ids).toEqual([101, 102, 103]);
    expect(repo.createEvidence).toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
    expect(repo.succeedAiRun).toHaveBeenCalled();
    const completeBody = repo.succeedAiRun.mock.calls[0][1].outputJson as Record<string, unknown>;
    expect(completeBody).not.toHaveProperty('transcript');
    expect(JSON.stringify(completeBody)).not.toContain('transcript');
    expect(completeBody).toEqual({ excerpt_ids: [101, 102, 103] });
    expect(fs.existsSync(tempPath)).toBe(false);
  });

  it('ingestWhisper enqueue payload includes mime and handed-off .mp3 temp is not unlinked', async () => {
    stubScopedProject();
    repo.getStudy.mockResolvedValue({
      id: 4,
      project_id: 9,
      name: 'IDI sữa uống',
      method: 'idi',
      n: 8,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    });
    repo.listConsents.mockResolvedValue([
      {
        id: 1,
        study_id: 4,
        project_id: 9,
        subject_code: 'R-004',
        consent_type: 'record',
        recorded_at: '2026-08-14',
        expires_at: '2028-08-14T00:00:00.000Z',
        notes: null,
      },
    ]);
    repo.insertAiRun.mockResolvedValue({
      id: 77,
      project_id: 9,
      question_id: null,
      job_type: 'whisper_ingest',
      provider: 'openai',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchWhisperJob.mockResolvedValue({ id: 'job-1' });
    const tempPath = writeTempAudio('.mp3');

    try {
      const out = await service.ingestWhisper(
        9,
        4,
        { restricted: true, allowedClientIds: ['acme'] },
        { tempPath, mime: 'audio/mpeg' },
        'am@ptt',
      );
      expect(out.status).toBe('pending');
      expect(tempPath).toMatch(/\.mp3$/);
      expect(jobQueue.enqueueResearchWhisperJob).toHaveBeenCalledWith(
        expect.objectContaining({ tempPath, mime: 'audio/mpeg' }),
      );
      expect(fs.existsSync(tempPath)).toBe(true);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  });

  it('M3-2a: runSparktoro enqueue does not createInsight', async () => {
    stubScopedProject();
    config.researchSparktoroEnabled = true;
    config.sparktoroApiKey = 'st-test-key';
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Ai overlap audience sữa uống?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.insertAiRun.mockResolvedValue({
      id: 81,
      project_id: 9,
      question_id: 10,
      job_type: 'sparktoro',
      provider: 'sparktoro',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchSparktoroJob.mockResolvedValue({ id: 'job-st' });

    const out = await service.runSparktoro(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { question_id: 10 },
      'am@ptt',
    );

    expect(out).toEqual({ ok: true, run_id: 81, status: 'pending' });
    expect(repo.insertAiRun).toHaveBeenCalledWith(
      expect.objectContaining({ jobType: 'sparktoro', provider: 'sparktoro' }),
    );
    expect(jobQueue.enqueueResearchSparktoroJob).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 9,
        questionId: 10,
        runId: 81,
        idempotencyKey: 'research_sparktoro:9:10:run:81',
      }),
    );
    expect(repo.createSource).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
    expect(collectSparkToro).not.toHaveBeenCalled();
  });

  it('M3-2b: runSparktoro with email in question_vi is 400 and does not enqueue', async () => {
    stubScopedProject();
    config.researchSparktoroEnabled = true;
    config.sparktoroApiKey = 'st-test-key';
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Gửi kết quả cho analyst@ptt.vn',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });

    try {
      await service.runSparktoro(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { question_id: 10 },
        'am@ptt',
      );
      throw new Error('expected pii 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'validation_error' }),
      );
    }
    expect(jobQueue.enqueueResearchSparktoroJob).not.toHaveBeenCalled();
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('M3-2c: jobs_disabled persist SparkToro source with medium tier and limitation', async () => {
    stubScopedProject();
    config.researchSparktoroEnabled = true;
    config.sparktoroApiKey = 'st-test-key';
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Ai overlap audience sữa uống?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.insertAiRun.mockResolvedValue({
      id: 82,
      project_id: 9,
      question_id: 10,
      job_type: 'sparktoro',
      provider: 'sparktoro',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchSparktoroJob.mockResolvedValue(null);
    (collectSparkToro as jest.Mock).mockResolvedValue({
      results: [
        {
          url: 'https://sparktoro.com/audience/sua-uong',
          title: 'Audience overlap sữa uống',
          snippet: 'Ước lượng overlap audience ngành sữa uống tại VN.',
        },
      ],
      credits_used: 12,
      report_id: 'rpt-1',
      location: 'us',
    });
    repo.createSource.mockResolvedValue({
      id: 44,
      project_id: 9,
      question_id: 10,
      title: 'Audience overlap sữa uống',
      publisher: 'SparkToro',
      url: 'https://sparktoro.com/audience/sua-uong',
      reliability_tier: 'medium',
      limitation_note:
        'Ước lượng audience SparkToro — không phải census. Không suy “người Việt nghĩ rằng…”.',
      ai_generated: true,
      keep: true,
    });
    repo.succeedAiRun.mockResolvedValue({
      id: 82,
      project_id: 9,
      question_id: 10,
      job_type: 'sparktoro',
      provider: 'sparktoro',
      status: 'succeeded',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: '2026-08-14',
    });

    const out = await service.runSparktoro(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { question_id: 10 },
      'am@ptt',
    );

    expect(out.ok).toBe(true);
    expect(out.run_id).toBe(82);
    expect(repo.createSource).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        title: 'Audience overlap sữa uống',
        publisher: 'SparkToro',
        url: 'https://sparktoro.com/audience/sua-uong',
        reliability_tier: 'medium',
        limitation_note: expect.stringMatching(/\S/),
        question_id: 10,
        ai_generated: true,
        keep: true,
      }),
    );
    const tier = repo.createSource.mock.calls[0][1].reliability_tier;
    expect(['low', 'medium']).toContain(tier);
    expect(repo.createInsight).not.toHaveBeenCalled();
    expect(collectSparkToro).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('Ai overlap audience sữa uống?'),
        geo: expect.any(Array),
      }),
    );
    expect(repo.succeedAiRun).toHaveBeenCalledWith(
      82,
      expect.objectContaining({
        creditsUsed: 12,
        outputJson: expect.objectContaining({
          credits_used: 12,
          report_id: 'rpt-1',
        }),
      }),
    );
  });

  it('M3-2e: jobs_disabled SparkToro HTTP error fails run without insight', async () => {
    stubScopedProject();
    config.researchSparktoroEnabled = true;
    config.sparktoroApiKey = 'st-test-key';
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Ai overlap audience sữa uống?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.insertAiRun.mockResolvedValue({
      id: 83,
      project_id: 9,
      question_id: 10,
      job_type: 'sparktoro',
      provider: 'sparktoro',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchSparktoroJob.mockResolvedValue(null);
    (collectSparkToro as jest.Mock).mockRejectedValue(new Error('sparktoro_create_http_401'));

    const out = await service.runSparktoro(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { question_id: 10 },
      'am@ptt',
    );

    expect(out).toEqual({ ok: true, run_id: 83, status: 'failed' });
    expect(repo.failAiRun).toHaveBeenCalledWith(83, 'sparktoro_failed');
    expect(repo.createSource).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('flag or key off returns sparktoro_disabled without enqueue or insight', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Ai overlap audience sữa uống?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });

    const out = await service.runSparktoro(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { question_id: 10 },
      'am@ptt',
    );

    expect(out).toEqual({ ok: true, note: 'sparktoro_disabled' });
    expect(jobQueue.enqueueResearchSparktoroJob).not.toHaveBeenCalled();
    expect(repo.createSource).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(collectSparkToro).not.toHaveBeenCalled();
  });

  it('M3-2d: acceptSingleSource outside scope is 403 without source title or competitor/study name', async () => {
    repo.getSource.mockResolvedValue({
      id: 5,
      project_id: 9,
      title: 'SecretSourceTitle',
      publisher: 'SparkToro',
      single_source_accepted: false,
      triangulated: false,
    });
    repo.getProjectClientId.mockResolvedValue('other-client');
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.listCompetitors.mockResolvedValue([
      { id: 4, project_id: 9, name: 'SecretRivalName', aliases: [], snapshots: [] },
    ]);
    repo.getStudy.mockResolvedValue({
      id: 4,
      project_id: 9,
      name: 'SecretStudyName',
      method: 'idi',
      n: 8,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    });

    try {
      await service.acceptSingleSource(5, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('SecretSourceTitle');
      expect(JSON.stringify(body)).not.toContain('SecretRivalName');
      expect(JSON.stringify(body)).not.toContain('SecretStudyName');
      expect(JSON.stringify(body)).not.toContain('title');
      expect(JSON.stringify(body)).not.toContain('name');
    }
    expect(repo.acceptSingleSource).not.toHaveBeenCalled();
    expect(repo.listCompetitors).not.toHaveBeenCalled();
    expect(repo.getStudy).not.toHaveBeenCalled();
  });

  it('getEvidence outside scope is 403 without study name in the body', async () => {
    repo.getEvidence.mockResolvedValue(
      evidenceRow({ id: 1, study_id: 4, excerpt: 'quoted line', locator: 'T-00:00' }),
    );
    repo.getStudy.mockResolvedValue({
      id: 4,
      project_id: 9,
      name: 'SecretStudyName',
      method: 'idi',
      n: 8,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    });
    repo.getProjectClientId.mockResolvedValue('other-client');
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    try {
      await service.getEvidence(1, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('SecretStudyName');
      expect(JSON.stringify(body)).not.toContain('name');
    }
    expect(repo.getStudy).not.toHaveBeenCalled();
  });

  it('acceptSingleSource sets single_source_accepted', async () => {
    stubScopedProject();
    repo.getSource.mockResolvedValue({
      id: 5,
      project_id: 9,
      title: 'One source',
      single_source_accepted: false,
      triangulated: false,
    });
    repo.acceptSingleSource.mockResolvedValue({
      id: 5,
      project_id: 9,
      title: 'One source',
      single_source_accepted: true,
      triangulated: false,
    });

    const out = await service.acceptSingleSource(5, { restricted: true, allowedClientIds: ['acme'] });

    expect(out.single_source_accepted).toBe(true);
    expect(repo.acceptSingleSource).toHaveBeenCalledWith(5);
  });

  it('submitReview caps high band to medium when attached source is single_source_accepted', async () => {
    stubScopedProject();
    const current = insightRow({
      confidence_rationale: 'Nguồn verified, sample 2025',
      status: 'draft',
      confidence_json: validRubric,
      evidence_ids: [3],
    });
    const verified = insightRow({ ...current, status: 'analyst_verified' });
    repo.getInsight.mockResolvedValue(current);
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);
    repo.getEvidence.mockResolvedValue(evidenceRow({ id: 3, source_id: 5, qc_status: 'verified' }));
    repo.getSource.mockResolvedValue({
      id: 5,
      project_id: 9,
      triangulated: false,
      single_source_accepted: true,
    });
    repo.patchInsight.mockResolvedValue(current);
    repo.updateInsightStatus.mockResolvedValue(verified);

    await service.submitReview(7, { restricted: true, allowedClientIds: ['acme'] });

    expect(repo.patchInsight).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        confidence_json: expect.objectContaining({
          score: 3,
          band: 'medium',
        }),
      }),
    );
  });

  it('runDeep throws job_in_flight when a pending deep run exists for the question', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Quy mô?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightDeepRun.mockResolvedValue({ id: 88, status: 'running' });

    try {
      await service.runDeep(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { question_id: 10 },
        'am@ptt',
      );
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'job_in_flight' });
    }
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchDeepJob).not.toHaveBeenCalled();
  });

  it('health exposes deep_provider for FE hide/show', () => {
    expect(service.health()).toEqual({
      ok: true,
      enabled: true,
      deep_provider: 'openai',
      sparktoro_enabled: false,
      qualtrics_enabled: false,
      talkwalker_enabled: false,
      talkwalker_live_enabled: false,
      rag_enabled: false,
      rag_openai_embed_enabled: false,
      rag_embed_model: 'local',
      rag_pgvector_enabled: false,
      rag_pgvector_ready: false,
      rag_ivfflat_ready: false,
    });
    config.researchDeepProvider = 'off';
    expect(service.health().deep_provider).toBe('off');
  });

  it('P26 health rag_pgvector_ready true after probe on module init', async () => {
    repo.probePgvectorReady.mockResolvedValue(true);
    repo.probeIvfflatReady.mockResolvedValue(false);
    await service.onModuleInit();
    expect(service.health().rag_pgvector_ready).toBe(true);
    expect(service.health().rag_ivfflat_ready).toBe(false);
    expect(service.health().rag_pgvector_enabled).toBe(false);
  });

  it('P36 health rag_ivfflat_ready true after probe on module init', async () => {
    repo.probeIvfflatReady.mockResolvedValue(true);
    await service.onModuleInit();
    expect(service.health().rag_ivfflat_ready).toBe(true);
  });

  it('health sparktoro_enabled is false when flag is on but key is missing', () => {
    config.researchSparktoroEnabled = true;
    config.sparktoroApiKey = '';
    expect(service.health().sparktoro_enabled).toBe(false);
  });

  it('health sparktoro_enabled is false when key is present but flag is off', () => {
    config.researchSparktoroEnabled = false;
    config.sparktoroApiKey = 'st-secret-never-leak';
    const payload = service.health();
    expect(payload.sparktoro_enabled).toBe(false);
    expect(JSON.stringify(payload)).not.toContain('st-secret-never-leak');
    expect(payload).not.toHaveProperty('sparktoroApiKey');
    expect(payload).not.toHaveProperty('sparktoro_api_key');
  });

  it('health sparktoro_enabled is true only when flag and key are both present', () => {
    config.researchSparktoroEnabled = true;
    config.sparktoroApiKey = 'st-secret-never-leak';
    const payload = service.health();
    expect(payload.sparktoro_enabled).toBe(true);
    expect(JSON.stringify(payload)).not.toContain('st-secret-never-leak');
    expect(JSON.stringify(payload)).not.toMatch(/sparktoroApiKey|SPARKTORO_API_KEY/);
  });

  it('health qualtrics_enabled is false when flag is on but key is missing', () => {
    config.researchQualtricsEnabled = true;
    config.qualtricsApiKey = '';
    expect(service.health().qualtrics_enabled).toBe(false);
  });

  it('health qualtrics_enabled is false when key is present but flag is off', () => {
    config.researchQualtricsEnabled = false;
    config.qualtricsApiKey = 'qx-secret-never-leak';
    const payload = service.health();
    expect(payload.qualtrics_enabled).toBe(false);
    expect(JSON.stringify(payload)).not.toContain('qx-secret-never-leak');
    expect(payload).not.toHaveProperty('qualtricsApiKey');
    expect(payload).not.toHaveProperty('qualtrics_api_key');
    expect(JSON.stringify(payload)).not.toMatch(/QUALTRICS_API_KEY/);
  });

  it('health qualtrics_enabled is true only when flag, key and datacenter are present', () => {
    config.researchQualtricsEnabled = true;
    config.qualtricsApiKey = 'qx-secret-never-leak';
    config.qualtricsDatacenter = 'iad1';
    const payload = service.health();
    expect(payload.qualtrics_enabled).toBe(true);
    expect(JSON.stringify(payload)).not.toContain('qx-secret-never-leak');
    expect(JSON.stringify(payload)).not.toMatch(/qualtricsApiKey|QUALTRICS_API_KEY|QUALTRICS_DATACENTER/);
  });

  it('health qualtrics_enabled is false when datacenter is missing', () => {
    config.researchQualtricsEnabled = true;
    config.qualtricsApiKey = 'qx-secret-never-leak';
    config.qualtricsDatacenter = '';
    expect(service.health().qualtrics_enabled).toBe(false);
  });

  it('health rag_enabled is false by default and does not leak RESEARCH_RAG', () => {
    const payload = service.health();
    expect(payload.rag_enabled).toBe(false);
    expect(JSON.stringify(payload)).not.toMatch(/RESEARCH_RAG/);
    expect(payload).not.toHaveProperty('researchRagEnabled');
  });

  it('health rag_enabled is true when flag is on; payload has no RESEARCH_RAG key leak', () => {
    config.researchRagEnabled = true;
    const payload = service.health();
    expect(payload.rag_enabled).toBe(true);
    expect(JSON.stringify(payload)).not.toMatch(/RESEARCH_RAG/);
    expect(payload).not.toHaveProperty('researchRagEnabled');
  });

  it('health rag_openai_embed_enabled is false when flag is on but key is missing', () => {
    config.researchRagOpenaiEmbedEnabled = true;
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_KEY;
    const payload = service.health();
    expect(payload.rag_openai_embed_enabled).toBe(false);
    expect(payload.rag_embed_model).toBe('local');
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
  });

  it('health rag_openai_embed_enabled is true only when flag and key are present', () => {
    config.researchRagOpenaiEmbedEnabled = true;
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-secret-never-leak';
    const payload = service.health();
    expect(payload.rag_openai_embed_enabled).toBe(true);
    expect(payload.rag_embed_model).toBe('openai');
    expect(JSON.stringify(payload)).not.toContain('sk-secret-never-leak');
    expect(JSON.stringify(payload)).not.toMatch(/OPENAI_API_KEY/);
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    else delete process.env.OPENAI_API_KEY;
  });

  const scope = { restricted: true, allowedClientIds: ['acme'] };

  it('P23 flag and token both off returns talkwalker_disabled without enqueue or insight', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({ id: 9, project_id: 9, question_vi: 'Quy mô sữa uống?' });
    const out = await service.runTalkwalker(9, scope, { question_id: 9 }, 'an@ptt');
    expect(out).toEqual({ ok: true, note: 'talkwalker_disabled' });
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(repo.createSource).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchDeskJob).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchDeepJob).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchTriangulateJob).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchPulseJob).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchWhisperJob).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchSparktoroJob).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchQualtricsJob).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchRagReembedJob).not.toHaveBeenCalled();
  });

  it('P23 health talkwalker_enabled is false when flag is on but token is missing', () => {
    config.researchTalkwalkerEnabled = true;
    config.talkwalkerAccessToken = '';
    expect(service.health().talkwalker_enabled).toBe(false);
  });

  it('P23 health talkwalker_enabled is false when token is present but flag is off', () => {
    config.researchTalkwalkerEnabled = false;
    config.talkwalkerAccessToken = 'tw-secret';
    const payload = service.health();
    expect(payload.talkwalker_enabled).toBe(false);
    expect(JSON.stringify(payload)).not.toContain('tw-secret');
    expect(payload).not.toHaveProperty('talkwalkerAccessToken');
    expect(payload).not.toHaveProperty('talkwalker_access_token');
  });

  it('P23 health talkwalker_enabled is true only when flag and token are both present', () => {
    config.researchTalkwalkerEnabled = true;
    config.talkwalkerAccessToken = 'tw-secret-never-leak';
    const payload = service.health();
    expect(payload.talkwalker_enabled).toBe(true);
    expect(JSON.stringify(payload)).not.toMatch(/tw-secret|TALKWALKER_ACCESS_TOKEN/);
  });

  it('P23 stub persist creates Talkwalker sources and no insight', async () => {
    stubScopedProject();
    config.researchTalkwalkerEnabled = true;
    config.talkwalkerAccessToken = 'tw-secret';
    repo.getQuestion.mockResolvedValue({ id: 9, project_id: 9, question_vi: 'Quy mô sữa uống?' });
    repo.insertAiRun.mockResolvedValue({ id: 77 });
    repo.createSource.mockResolvedValueOnce({ id: 501 }).mockResolvedValueOnce({ id: 502 });
    const out = await service.runTalkwalker(9, scope, { question_id: 9 }, 'an@ptt');
    expect(out).toEqual({
      ok: true,
      run_id: 77,
      status: 'succeeded',
      source_ids: [501, 502],
      note: 'talkwalker_stub',
    });
    expect(repo.insertAiRun).toHaveBeenCalledWith(
      expect.objectContaining({ jobType: 'talkwalker', provider: 'talkwalker' }),
    );
    expect(repo.createSource).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        publisher: 'Talkwalker',
        source_type: 'social_public',
        ai_generated: true,
        keep: true,
      }),
    );
    expect(repo.createInsight).not.toHaveBeenCalled();
    const output = repo.succeedAiRun.mock.calls[0][1];
    expect(output.outputJson.stub).toBe(true);
  });

  it('P23 PII question_vi is 400 before persist', async () => {
    stubScopedProject();
    config.researchTalkwalkerEnabled = true;
    config.talkwalkerAccessToken = 'tw-secret';
    repo.getQuestion.mockResolvedValue({
      id: 9,
      project_id: 9,
      question_vi: 'Gọi 0901234567 hỏi panel',
    });
    await expect(service.runTalkwalker(9, scope, { question_id: 9 }, 'an@ptt')).rejects.toMatchObject({
      status: 400,
    });
    expect(repo.insertAiRun).not.toHaveBeenCalled();
  });

  it('P36 live Talkwalker persists sources when project_id configured', async () => {
    stubScopedProject();
    config.researchTalkwalkerEnabled = true;
    config.talkwalkerAccessToken = 'tw-secret';
    config.talkwalkerProjectId = 'tw-proj-live';
    repo.getQuestion.mockResolvedValue({ id: 9, project_id: 9, question_vi: 'Quy mô sữa uống?' });
    repo.insertAiRun.mockResolvedValue({ id: 88 });
    (collectTalkwalker as jest.Mock).mockResolvedValue({
      results: [
        {
          url: 'https://news.example/live',
          title: 'Live title',
          snippet: 'Live snippet',
        },
      ],
    });
    repo.createSource.mockResolvedValue({ id: 601 });
    const out = await service.runTalkwalker(9, scope, { question_id: 9 }, 'an@ptt');
    expect(out).toEqual({
      ok: true,
      run_id: 88,
      status: 'succeeded',
      source_ids: [601],
      note: 'talkwalker_live',
    });
    expect(collectTalkwalker).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Quy mô sữa uống?',
        accessToken: 'tw-secret',
        projectId: 'tw-proj-live',
      }),
    );
    expect(repo.succeedAiRun.mock.calls[0][1].outputJson.live).toBe(true);
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('P36 live Talkwalker HTTP fail marks run failed', async () => {
    stubScopedProject();
    config.researchTalkwalkerEnabled = true;
    config.talkwalkerAccessToken = 'tw-secret';
    config.talkwalkerProjectId = 'tw-proj-live';
    repo.getQuestion.mockResolvedValue({ id: 9, project_id: 9, question_vi: 'Quy mô sữa uống?' });
    repo.insertAiRun.mockResolvedValue({ id: 89 });
    (collectTalkwalker as jest.Mock).mockRejectedValue(new Error('talkwalker_search_http_401'));
    await expect(service.runTalkwalker(9, scope, { question_id: 9 }, 'an@ptt')).rejects.toMatchObject({
      status: 400,
    });
    expect(repo.failAiRun).toHaveBeenCalledWith(89, 'talkwalker_failed');
    expect(repo.createSource).not.toHaveBeenCalled();
  });

  it('P36 health talkwalker_live_enabled requires flag token and project_id', () => {
    config.researchTalkwalkerEnabled = true;
    config.talkwalkerAccessToken = 'tw-secret';
    config.talkwalkerProjectId = '';
    expect(service.health().talkwalker_live_enabled).toBe(false);
    config.talkwalkerProjectId = 'tw-proj';
    expect(service.health().talkwalker_live_enabled).toBe(true);
    expect(JSON.stringify(service.health())).not.toMatch(/tw-secret|tw-proj/);
  });

  describe('P11 OpenAI embed path', () => {
    it('flag embed off: approve upserts 64-d local-hash; fetchOpenAIEmbedding not called', async () => {
      stubScopedProject();
      const current = insightRow({
        created_by: 'analyst@ptt',
        status: 'approved_internal',
        confidence_rationale: 'Nguồn verified, sample 2025',
        confidence_json: validRubric,
      });
      const approved = insightRow({ ...current, status: 'approved_client_facing' });
      repo.getInsight.mockResolvedValue(current);
      repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);
      repo.updateInsightStatus.mockResolvedValue(approved);
      repo.insertReview.mockResolvedValue({ id: 1 });

      await service.approveInsight(
        7,
        { restricted: true, allowedClientIds: ['acme'] },
        { target_status: 'approved_client_facing' },
        'lead@ptt',
      );

      expect(fetchOpenAIEmbedding).not.toHaveBeenCalled();
      expect(repo.upsertInsightEmbedding).toHaveBeenCalledWith(
        expect.objectContaining({
          embed_model: 'local-hash',
          embed_dims: RAG_EMBED_DIMS,
        }),
      );
      expect(repo.createInsight).not.toHaveBeenCalled();
    });

    it('flag+key on: approve upserts 256-d + model openai', async () => {
      config.researchRagOpenaiEmbedEnabled = true;
      process.env.OPENAI_API_KEY = 'sk-test';
      stubScopedProject();
      const current = insightRow({
        created_by: 'analyst@ptt',
        status: 'approved_internal',
        confidence_rationale: 'Nguồn verified, sample 2025',
        confidence_json: validRubric,
      });
      const approved = insightRow({ ...current, status: 'approved_client_facing' });
      repo.getInsight.mockResolvedValue(current);
      repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);
      repo.updateInsightStatus.mockResolvedValue(approved);
      repo.insertReview.mockResolvedValue({ id: 1 });
      const vec = Array.from({ length: 256 }, (_, i) => (i === 0 ? 1 : 0));
      (fetchOpenAIEmbedding as jest.Mock).mockResolvedValue({
        embedding: vec,
        model: OPENAI_EMBED_MODEL,
        dims: 256,
      });

      await service.approveInsight(
        7,
        { restricted: true, allowedClientIds: ['acme'] },
        { target_status: 'approved_client_facing' },
        'lead@ptt',
      );

      expect(fetchOpenAIEmbedding).toHaveBeenCalled();
      expect(repo.upsertInsightEmbedding).toHaveBeenCalledWith(
        expect.objectContaining({
          embed_model: OPENAI_EMBED_MODEL,
          embed_dims: 256,
          embedding: vec,
        }),
      );
      expect(repo.createInsight).not.toHaveBeenCalled();
      delete process.env.OPENAI_API_KEY;
    });

    it('PII statement: 0 HTTP; no upsert; approve 200', async () => {
      stubScopedProject();
      const current = insightRow({
        created_by: 'analyst@ptt',
        status: 'approved_internal',
        statement: 'Contact analyst@ptt.vn — Premium SKU tăng share',
        confidence_rationale: 'Nguồn verified, sample 2025',
        confidence_json: validRubric,
      });
      const approved = insightRow({ ...current, status: 'approved_client_facing' });
      repo.getInsight.mockResolvedValue(current);
      repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);
      repo.updateInsightStatus.mockResolvedValue(approved);
      repo.insertReview.mockResolvedValue({ id: 1 });
      config.researchRagOpenaiEmbedEnabled = true;
      process.env.OPENAI_API_KEY = 'sk-test';

      const out = await service.approveInsight(
        7,
        { restricted: true, allowedClientIds: ['acme'] },
        { target_status: 'approved_client_facing' },
        'lead@ptt',
      );

      expect(out.status).toBe('approved_client_facing');
      expect(fetchOpenAIEmbedding).not.toHaveBeenCalled();
      expect(repo.upsertInsightEmbedding).not.toHaveBeenCalled();
      delete process.env.OPENAI_API_KEY;
    });

    it('search flag off returns rag_disabled and does not call fetchOpenAIEmbedding', async () => {
      const out = await service.searchInsights(
        { restricted: false, allowedClientIds: [] },
        { q: 'Giá sữa học đường' },
      );
      expect(out).toEqual({ hits: [], note: 'rag_disabled' });
      expect(fetchOpenAIEmbedding).not.toHaveBeenCalled();
      expect(repo.listEmbeddings).not.toHaveBeenCalled();
    });

    it('search embed on + OpenAI fail returns rag_embed_failed', async () => {
      config.researchRagEnabled = true;
      config.researchRagOpenaiEmbedEnabled = true;
      process.env.OPENAI_API_KEY = 'sk-test';
      (fetchOpenAIEmbedding as jest.Mock).mockRejectedValue(
        Object.assign(new Error('openai_embed_failed'), { code: 'openai_embed_failed' }),
      );

      const out = await service.searchInsights(
        { restricted: false, allowedClientIds: [] },
        { q: 'Giá sữa học đường' },
      );

      expect(out).toEqual({ hits: [], note: 'rag_embed_failed' });
      expect(repo.listEmbeddings).not.toHaveBeenCalled();
      expect(repo.createInsight).not.toHaveBeenCalled();
      delete process.env.OPENAI_API_KEY;
    });

    it('search embed on + matching queryVec returns G3 id in hits', async () => {
      config.researchRagEnabled = true;
      config.researchRagOpenaiEmbedEnabled = true;
      process.env.OPENAI_API_KEY = 'sk-test';
      const statement = 'Giá sữa học đường tăng tại Hà Nội';
      const vec = embedInsightText(statement);
      (fetchOpenAIEmbedding as jest.Mock).mockResolvedValue({
        embedding: vec,
        model: OPENAI_EMBED_MODEL,
        dims: vec.length,
      });
      repo.listEmbeddings.mockResolvedValue([
        {
          insight_id: 10,
          project_id: 9,
          status: 'approved_client_facing',
          statement,
          observation: null,
          embedding: vec,
          theme_codes: [],
        },
      ]);

      const out = await service.searchInsights(
        { restricted: false, allowedClientIds: [] },
        { q: 'học sinh uống sữa đắt hơn ở thủ đô' },
      );

      expect(out.hits.map((h) => h.insight_id)).toContain(10);
      expect(repo.createInsight).not.toHaveBeenCalled();
      delete process.env.OPENAI_API_KEY;
    });
  });

  it('M2-1c: search q matches published; draft with the same sentence is not a hit', async () => {
    config.researchRagEnabled = true;
    const sentence = 'Giá sữa học đường tăng ở MT HCM';
    const published = {
      insight_id: 1,
      project_id: 9,
      status: 'published',
      statement: sentence,
      observation: null,
      embedding: embedInsightText(insightEmbedText({ statement: sentence, observation: null })),
      theme_codes: [],
    };
    const draft = {
      insight_id: 2,
      project_id: 9,
      status: 'draft',
      statement: sentence,
      observation: null,
      embedding: embedInsightText(insightEmbedText({ statement: sentence, observation: null })),
      theme_codes: [],
    };
    repo.listEmbeddings.mockResolvedValue([published, draft]);

    const out = await service.searchInsights(
      { restricted: false, allowedClientIds: [] },
      { q: sentence },
    );

    expect(out.hits.map((h) => h.insight_id)).toEqual([1]);
    expect(out.hits.map((h) => h.status)).toEqual(['published']);
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('M2-1d: flag off returns rag_disabled and does not call listEmbeddings', async () => {
    const out = await service.searchInsights(
      { restricted: false, allowedClientIds: [] },
      { q: 'Giá sữa học đường' },
    );

    expect(out).toEqual({ hits: [], note: 'rag_disabled' });
    expect(repo.listEmbeddings).not.toHaveBeenCalled();
    expect(repo.listEmbeddingsByVec).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('P20 searchInsights uses listEmbeddingsByVec when pgvector flag on', async () => {
    config.researchRagEnabled = true;
    config.researchRagPgvectorEnabled = true;
    repo.probePgvectorReady.mockResolvedValue(true);
    await service.onModuleInit();
    const statement = 'Giá sữa học đường tăng tại Hà Nội';
    const vec = embedInsightText(statement);
    repo.listEmbeddingsByVec.mockResolvedValue([
      {
        insight_id: 20,
        project_id: 9,
        status: 'published',
        statement,
        observation: null,
        embedding: vec,
        theme_codes: [],
        client_id: 'acme',
        valid_to: null,
      },
    ]);
    const out = await service.searchInsights(
      { restricted: false, allowedClientIds: [] },
      { q: statement },
    );
    expect(repo.listEmbeddingsByVec).toHaveBeenCalled();
    expect(repo.listEmbeddings).not.toHaveBeenCalled();
    expect(out.hits[0]?.insight_id).toBe(20);
  });

  it('P28 searchInsights falls back to listEmbeddings when pgvector flag on but not ready', async () => {
    config.researchRagEnabled = true;
    config.researchRagPgvectorEnabled = true;
    const statement = 'Giá sữa học đường tăng tại Hà Nội';
    const vec = embedInsightText(statement);
    repo.listEmbeddings.mockResolvedValue([
      {
        insight_id: 21,
        project_id: 9,
        status: 'published',
        statement,
        observation: null,
        embedding: vec,
        theme_codes: [],
        client_id: 'acme',
        valid_to: null,
      },
    ]);
    const out = await service.searchInsights(
      { restricted: false, allowedClientIds: [] },
      { q: statement },
    );
    expect(repo.listEmbeddings).toHaveBeenCalled();
    expect(repo.listEmbeddingsByVec).not.toHaveBeenCalled();
    expect(out.hits[0]?.insight_id).toBe(21);
  });

  it('P22 searchInsights returns is_stale from listEmbeddings valid_to', async () => {
    config.researchRagEnabled = true;
    const statement = 'Giá sữa học đường tăng tại Hà Nội';
    const vec = embedInsightText(statement);
    repo.listEmbeddings.mockResolvedValue([
      {
        insight_id: 20,
        project_id: 9,
        status: 'published',
        statement,
        observation: null,
        embedding: vec,
        theme_codes: [],
        client_id: 'acme',
        valid_to: '2020-01-01',
      },
    ]);
    const out = await service.searchInsights(
      { restricted: false, allowedClientIds: [] },
      { q: statement },
    );
    expect(repo.listEmbeddings).toHaveBeenCalled();
    expect(out.hits).toEqual([]);
  });

  it('P27 searchInsights default excludes stale and returns fresh hits', async () => {
    config.researchRagEnabled = true;
    const statement = 'Giá sữa học đường tăng tại Hà Nội';
    const vec = embedInsightText(statement);
    repo.listEmbeddings.mockResolvedValue([
      {
        insight_id: 20,
        project_id: 9,
        status: 'published',
        statement,
        observation: null,
        embedding: vec,
        theme_codes: [],
        client_id: 'acme',
        valid_to: '2020-01-01',
      },
      {
        insight_id: 21,
        project_id: 9,
        status: 'published',
        statement: 'Giá ổn định',
        observation: null,
        embedding: vec,
        theme_codes: [],
        client_id: 'acme',
        valid_to: null,
      },
    ]);
    const out = await service.searchInsights(
      { restricted: false, allowedClientIds: [] },
      { q: statement },
    );
    expect(out.hits.map((h) => h.insight_id)).toEqual([21]);
    expect(out.hits.every((h) => !h.is_stale)).toBe(true);
  });

  it('P30 searchInsights stale_only returns only stale hits', async () => {
    config.researchRagEnabled = true;
    const statement = 'Giá sữa học đường tăng tại Hà Nội';
    const vec = embedInsightText(statement);
    repo.listEmbeddings.mockResolvedValue([
      {
        insight_id: 20,
        project_id: 9,
        status: 'published',
        statement,
        observation: null,
        embedding: vec,
        theme_codes: [],
        client_id: 'acme',
        valid_to: '2020-01-01',
      },
      {
        insight_id: 21,
        project_id: 9,
        status: 'published',
        statement: 'Giá ổn định',
        observation: null,
        embedding: vec,
        theme_codes: [],
        client_id: 'acme',
        valid_to: null,
      },
    ]);
    const out = await service.searchInsights(
      { restricted: false, allowedClientIds: [] },
      { q: statement, stale_only: '1' },
    );
    expect(out.hits.map((h) => h.insight_id)).toEqual([20]);
    expect(out.hits.every((h) => h.is_stale)).toBe(true);
  });

  it('P30 searchInsights default still excludes stale (P27)', async () => {
    config.researchRagEnabled = true;
    const statement = 'Giá sữa học đường tăng tại Hà Nội';
    const vec = embedInsightText(statement);
    repo.listEmbeddings.mockResolvedValue([
      {
        insight_id: 20,
        project_id: 9,
        status: 'published',
        statement,
        observation: null,
        embedding: vec,
        theme_codes: [],
        client_id: 'acme',
        valid_to: '2020-01-01',
      },
      {
        insight_id: 21,
        project_id: 9,
        status: 'published',
        statement: 'Giá ổn định',
        observation: null,
        embedding: vec,
        theme_codes: [],
        client_id: 'acme',
        valid_to: null,
      },
    ]);
    const out = await service.searchInsights(
      { restricted: false, allowedClientIds: [] },
      { q: statement },
    );
    expect(out.hits.every((h) => !h.is_stale)).toBe(true);
    expect(out.hits.map((h) => h.insight_id)).toEqual([21]);
  });

  it('P27 insightCopilot excludes stale rag hits when flag on', async () => {
    config.researchRagEnabled = true;
    stubInsightCopilotSuccess();
    const embedding = embedInsightText('Giá premium thắng tại MT HCM');
    repo.listEmbeddings.mockResolvedValue([
      {
        insight_id: 88,
        project_id: 4,
        status: 'approved_client_facing',
        statement: 'Giá premium thắng tại MT HCM',
        observation: null,
        embedding,
        theme_codes: ['PRICE'],
        valid_to: '2020-01-01',
      },
      {
        insight_id: 89,
        project_id: 4,
        status: 'approved_client_facing',
        statement: 'Giá premium thắng tại MT HCM',
        observation: null,
        embedding,
        theme_codes: ['PRICE'],
        valid_to: null,
      },
    ]);

    const out = await service.insightCopilot(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { evidence_ids: [3] },
      'am@ptt',
    );

    expect(out.rag_hits.map((h) => h.insight_id)).toEqual([89]);
  });

  it('M2-1e: search outside scope is 403 without statement', async () => {
    config.researchRagEnabled = true;
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.listEmbeddings.mockResolvedValue([
      {
        insight_id: 1,
        project_id: 9,
        status: 'published',
        statement: 'Secret statement must not leak',
        observation: null,
        embedding: embedInsightText(
          insightEmbedText({ statement: 'Secret statement must not leak', observation: null }),
        ),
        theme_codes: [],
      },
    ]);

    try {
      await service.searchInsights(
        { restricted: true, allowedClientIds: ['acme'] },
        { q: 'Secret statement must not leak', client_id: 'other-client' },
      );
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('statement');
      expect(JSON.stringify(body)).not.toContain('Secret statement');
    }
    expect(repo.listEmbeddings).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('M4-1a: attach PRICE → join row; statement unchanged', async () => {
    stubScopedProject();
    const existing = insightRow({
      id: 7,
      statement: 'Premium SKU tăng share ở MT HCM',
    });
    const statementBefore = structuredClone(existing.statement);
    repo.getInsight.mockResolvedValue(existing);
    repo.getTaxonomy.mockResolvedValue({
      id: 11,
      theme_code: 'PRICE',
      label_vi: 'Giá',
      synonyms: ['pricing', 'giá bán'],
      active: true,
    });
    repo.attachInsightTheme.mockResolvedValue({ insight_id: 7, taxonomy_id: 11 });

    const out = await service.attachInsightTheme(
      7,
      { restricted: true, allowedClientIds: ['acme'] },
      { taxonomy_id: 11 },
      'analyst@ptt',
    );

    expect(out.statement).toEqual(statementBefore);
    expect(repo.attachInsightTheme).toHaveBeenCalledWith(7, 11, 'analyst@ptt');
    expect(repo.patchInsight).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('M4-1b: search theme_code=PRICE excludes insight not tagged PRICE', async () => {
    config.researchRagEnabled = true;
    const sentence = 'Giá sữa học đường tăng ở MT HCM';
    const priced = {
      insight_id: 1,
      project_id: 9,
      status: 'published',
      statement: sentence,
      observation: null,
      embedding: embedInsightText(insightEmbedText({ statement: sentence, observation: null })),
      theme_codes: ['PRICE'],
      theme_synonyms: ['pricing', 'giá bán'],
    };
    const other = {
      insight_id: 2,
      project_id: 9,
      status: 'published',
      statement: sentence,
      observation: null,
      embedding: embedInsightText(insightEmbedText({ statement: sentence, observation: null })),
      theme_codes: ['CHANNEL'],
      theme_synonyms: ['phân phối'],
    };
    repo.listEmbeddings.mockResolvedValue([priced, other]);

    const out = await service.searchInsights(
      { restricted: false, allowedClientIds: [] },
      { q: sentence, theme_code: 'PRICE' },
    );

    expect(out.hits.map((h) => h.insight_id)).toEqual([1]);
    expect(out.hits.map((h) => h.insight_id)).not.toContain(2);
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('M4-1d: attach does not call createInsight', async () => {
    stubScopedProject();
    const existing = insightRow({ statement: 'Premium SKU tăng share ở MT HCM' });
    repo.getInsight.mockResolvedValue(existing);
    repo.getTaxonomy.mockResolvedValue({
      id: 11,
      theme_code: 'PRICE',
      label_vi: 'Giá',
      synonyms: ['pricing', 'giá bán'],
      active: true,
    });
    repo.attachInsightTheme.mockResolvedValue({ insight_id: 7, taxonomy_id: 11 });

    await service.attachInsightTheme(
      7,
      { restricted: true, allowedClientIds: ['acme'] },
      { taxonomy_id: 11 },
      'analyst@ptt',
    );

    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('POST taxonomy invalid theme_code is 400 taxonomy_code_invalid', async () => {
    try {
      await service.createTaxonomy({ theme_code: 'price', label_vi: 'Giá' });
      throw new Error('expected taxonomy_code_invalid');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'taxonomy_code_invalid' });
    }
    expect(repo.createTaxonomy).not.toHaveBeenCalled();
  });

  it('POST taxonomy theme_code=PRICE when PRICE exists is 409 taxonomy_code_exists', async () => {
    const pgErr = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    repo.createTaxonomy.mockRejectedValue(pgErr);

    try {
      await service.createTaxonomy({ theme_code: 'PRICE', label_vi: 'Giá' });
      throw new Error('expected taxonomy_code_exists');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getStatus()).toBe(409);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'taxonomy_code_exists' });
    }
  });

  it('inactive theme attach is 400 taxonomy_inactive', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(insightRow({ statement: 'Premium SKU tăng share ở MT HCM' }));
    repo.getTaxonomy.mockResolvedValue({
      id: 11,
      theme_code: 'PRICE',
      label_vi: 'Giá',
      synonyms: ['pricing'],
      active: false,
    });

    try {
      await service.attachInsightTheme(
        7,
        { restricted: true, allowedClientIds: ['acme'] },
        { taxonomy_id: 11 },
        'analyst@ptt',
      );
      throw new Error('expected taxonomy_inactive');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'taxonomy_inactive' });
    }
    expect(repo.attachInsightTheme).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('attach outside scope is 403 without statement', async () => {
    repo.getInsight.mockResolvedValue(
      insightRow({ statement: 'Secret statement must not leak', project_id: 9 }),
    );
    repo.getProjectClientId.mockResolvedValue('other');
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    try {
      await service.attachInsightTheme(
        7,
        { restricted: true, allowedClientIds: ['acme'] },
        { taxonomy_id: 11 },
        'analyst@ptt',
      );
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('statement');
      expect(JSON.stringify(body)).not.toContain('Secret statement');
    }
    expect(repo.attachInsightTheme).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('flag or key off returns qualtrics_disabled without enqueue or insight', async () => {
    stubScopedProject();

    const out = await service.runQualtrics(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { study_id: 5 },
      'am@ptt',
    );

    expect(out).toEqual({ ok: true, note: 'qualtrics_disabled' });
    expect(repo.createInsight).not.toHaveBeenCalled();
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(repo.createSource).not.toHaveBeenCalled();
    expect(repo.createReportDraft).not.toHaveBeenCalled();
    expect(Object.keys(jobQueue).some((k) => /qualtrics/i.test(k))).toBe(true);
    expect(jobQueue.enqueueResearchQualtricsJob).not.toHaveBeenCalled();
  });

  it('flag and key on without datacenter returns qualtrics_disabled without enqueue', async () => {
    stubScopedProject();
    config.researchQualtricsEnabled = true;
    config.qualtricsApiKey = 'qx-secret-never-leak';
    config.qualtricsDatacenter = '';

    const out = await service.runQualtrics(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { study_id: 5 },
      'am@ptt',
    );

    expect(out).toEqual({ ok: true, note: 'qualtrics_disabled' });
    expect(repo.createInsight).not.toHaveBeenCalled();
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchQualtricsJob).not.toHaveBeenCalled();
  });

  it('M3-1: runQualtrics enqueue does not createInsight', async () => {
    stubScopedProject();
    config.researchQualtricsEnabled = true;
    config.qualtricsApiKey = 'qx-test-key';
    config.qualtricsDatacenter = 'iad1';
    repo.getStudy.mockResolvedValue({
      id: 5,
      project_id: 9,
      name: 'Wave 1 survey',
      method: 'survey',
      instrument_version: 'SV_test123',
      weighting_note: JSON.stringify({
        qualtrics_column_map: {
          QID1: { question_code: 'Q1', unit: 'VND', value_base: 'mean' },
        },
      }),
      n: null,
      field_start: null,
      field_end: null,
      mode: null,
    });
    repo.insertAiRun.mockResolvedValue({
      id: 84,
      project_id: 9,
      question_id: null,
      job_type: 'qualtrics',
      provider: 'qualtrics',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchQualtricsJob.mockResolvedValue({ id: 'job-qx' });

    const out = await service.runQualtrics(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { study_id: 5 },
      'am@ptt',
    );

    expect(out).toEqual({ ok: true, run_id: 84, status: 'pending' });
    expect(repo.insertAiRun).toHaveBeenCalledWith(
      expect.objectContaining({ jobType: 'qualtrics', provider: 'qualtrics' }),
    );
    expect(jobQueue.enqueueResearchQualtricsJob).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 9,
        studyId: 5,
        runId: 84,
        idempotencyKey: 'research_qualtrics:9:5:run:84',
      }),
    );
    expect(repo.createInsight).not.toHaveBeenCalled();
    expect(collectQualtrics).not.toHaveBeenCalled();
  });

  it('M3-2: jobs_disabled persistQualtrics evidence without createInsight', async () => {
    stubScopedProject();
    config.researchQualtricsEnabled = true;
    config.qualtricsApiKey = 'qx-test-key';
    config.qualtricsDatacenter = 'iad1';
    repo.getStudy.mockResolvedValue({
      id: 5,
      project_id: 9,
      name: 'Wave 1 survey',
      method: 'survey',
      instrument_version: 'SV_test123',
      weighting_note: JSON.stringify({
        qualtrics_column_map: {
          QID1: { question_code: 'Q1', unit: 'VND', value_base: 'mean' },
        },
      }),
      n: null,
      field_start: null,
      field_end: null,
      mode: null,
    });
    repo.insertAiRun.mockResolvedValue({
      id: 85,
      project_id: 9,
      question_id: null,
      job_type: 'qualtrics',
      provider: 'qualtrics',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchQualtricsJob.mockResolvedValue(null);
    (collectQualtrics as jest.Mock).mockResolvedValue({
      drafts: [
        {
          locator: 'Q-Q1',
          value_num: 42,
          unit: 'VND',
          value_base: 'mean',
          period_note: '2026-Q1',
          geography: 'VN',
          respondent_id: 'RSP_001',
        },
      ],
      progress_id: 'ES_1',
      file_id: 'FILE_1',
    });
    repo.createSource.mockResolvedValue({ id: 501, project_id: 9, title: 'Wave 1 survey' });
    repo.getSource.mockResolvedValue({ id: 501, project_id: 9, title: 'Wave 1 survey' });
    repo.createEvidence.mockResolvedValue(
      evidenceRow({ id: 601, study_id: 5, source_id: 501, value_num: 42 }),
    );
    repo.patchStudy.mockResolvedValue({ id: 5, n: 1 });

    const out = await service.runQualtrics(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { study_id: 5 },
      'am@ptt',
    );

    expect(out).toEqual({ ok: true, run_id: 85, status: 'succeeded', evidence_ids: [601] });
    expect(repo.createSource).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ publisher: 'Qualtrics', ai_generated: true }),
    );
    expect(repo.succeedAiRun).toHaveBeenCalledWith(
      85,
      expect.objectContaining({
        outputJson: expect.objectContaining({
          evidence_ids: [601],
          progress_id: 'ES_1',
          file_id: 'FILE_1',
        }),
      }),
    );
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('M3-3: missing SV_ instrument_version is 400 qualtrics_survey_id_required', async () => {
    stubScopedProject();
    config.researchQualtricsEnabled = true;
    config.qualtricsApiKey = 'qx-test-key';
    config.qualtricsDatacenter = 'iad1';
    repo.getStudy.mockResolvedValue({
      id: 5,
      project_id: 9,
      name: 'Wave 1 survey',
      method: 'survey',
      instrument_version: 'v1',
      weighting_note: null,
      n: null,
      field_start: null,
      field_end: null,
      mode: null,
    });

    try {
      await service.runQualtrics(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { study_id: 5 },
        'am@ptt',
      );
      throw new Error('expected 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({
        error: 'qualtrics_survey_id_required',
        messages: ['qualtrics_survey_id_required'],
      });
    }
    expect(repo.insertAiRun).not.toHaveBeenCalled();
  });

  it('M3-4: PII in export fails run with survey_pii_forbidden', async () => {
    stubScopedProject();
    config.researchQualtricsEnabled = true;
    config.qualtricsApiKey = 'qx-test-key';
    config.qualtricsDatacenter = 'iad1';
    repo.getStudy.mockResolvedValue({
      id: 5,
      project_id: 9,
      name: 'Wave 1 survey',
      method: 'survey',
      instrument_version: 'SV_test123',
      weighting_note: JSON.stringify({
        qualtrics_column_map: {
          QID1: { question_code: 'Q1', unit: 'VND', value_base: 'mean' },
        },
      }),
      n: null,
      field_start: null,
      field_end: null,
      mode: null,
    });
    repo.insertAiRun.mockResolvedValue({
      id: 86,
      project_id: 9,
      question_id: null,
      job_type: 'qualtrics',
      provider: 'qualtrics',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchQualtricsJob.mockResolvedValue(null);
    (collectQualtrics as jest.Mock).mockRejectedValue(
      Object.assign(new Error('survey_pii_forbidden'), { code: 'survey_pii_forbidden' }),
    );

    const out = await service.runQualtrics(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { study_id: 5 },
      'am@ptt',
    );

    expect(out).toEqual({ ok: true, run_id: 86, status: 'failed' });
    expect(repo.failAiRun).toHaveBeenCalledWith(86, 'survey_pii_forbidden');
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('insightCopilot with 0 evidence is 400 and does not call the LLM', async () => {
    stubScopedProject();

    try {
      await service.insightCopilot(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { evidence_ids: [] },
        'am@ptt',
      );
      throw new Error('expected 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
    }
    expect(llm.completeJson).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(repo.listEmbeddings).not.toHaveBeenCalled();
  });

  it('insightCopilot is llm_unconfigured when Anthropic is missing', async () => {
    stubScopedProject();
    llm.isConfigured.mockReturnValue(false);
    repo.getEvidence.mockResolvedValue(evidenceRow({ id: 3, qc_status: 'verified' }));
    repo.insertAiRun.mockResolvedValue({ id: 91, status: 'pending' });

    try {
      await service.insightCopilot(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { evidence_ids: [3] },
        'am@ptt',
      );
      throw new Error('expected unconfigured');
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect((err as ServiceUnavailableException).getResponse()).toEqual({
        error: 'llm_unconfigured',
      });
    }
    expect(llm.completeJson).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
    expect(repo.failAiRun).toHaveBeenCalledWith(91, 'llm_unconfigured');
    expect(repo.listEmbeddings).not.toHaveBeenCalled();
  });

  function stubInsightCopilotSuccess(excerpt = 'Share premium 18%'): void {
    stubScopedProject();
    repo.getEvidence.mockResolvedValue(evidenceRow({ id: 3, qc_status: 'verified', excerpt }));
    repo.insertAiRun.mockResolvedValue({ id: 91, status: 'pending' });
    repo.createInsight.mockResolvedValue(insightRow({ id: 70, status: 'draft', ai_generated: true }));
    repo.getInsight.mockResolvedValue(insightRow({ id: 70, status: 'draft', ai_generated: true }));
    llm.completeJson.mockResolvedValue({
      parsed: {
        statement: 'Draft từ evidence 3',
        observation: '',
        interpretation: '',
        implication: '',
        recommendation: '',
        confidence_rationale: '',
      },
      modelName: 'claude',
    });
  }

  it('M2-1b: flag off returns P0 array prompt, one draft, rag_disabled', async () => {
    stubInsightCopilotSuccess();

    const out = await service.insightCopilot(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { evidence_ids: [3] },
      'am@ptt',
    );

    const userPrompt = llm.completeJson.mock.calls[0][0].userPrompt as string;
    expect(Array.isArray(JSON.parse(userPrompt))).toBe(true);
    expect(repo.createInsight).toHaveBeenCalledTimes(1);
    expect(out.rag_hits).toEqual([]);
    expect(out.rag_note).toBe('rag_disabled');
    expect(repo.listEmbeddings).not.toHaveBeenCalled();
  });

  it('M2-1c: flag on injects approved rag hits and still creates one draft', async () => {
    config.researchRagEnabled = true;
    stubInsightCopilotSuccess();
    const embedding = embedInsightText('Giá premium thắng tại MT HCM');
    repo.listEmbeddings.mockResolvedValue([
      {
        insight_id: 88,
        project_id: 4,
        status: 'approved_client_facing',
        statement: 'Giá premium thắng tại MT HCM',
        observation: null,
        embedding,
        theme_codes: ['PRICE'],
      },
      {
        insight_id: 99,
        project_id: 4,
        status: 'draft',
        statement: 'Giá premium thắng tại MT HCM',
        observation: null,
        embedding,
        theme_codes: [],
      },
    ]);

    const out = await service.insightCopilot(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { evidence_ids: [3] },
      'am@ptt',
    );

    expect(out.insight.id).toBe(70);
    expect(out.rag_hits.map((h) => h.insight_id)).toEqual([88]);
    expect(out.rag_note).toBeUndefined();
    expect(repo.createInsight).toHaveBeenCalledTimes(1);
    expect(repo.replaceInsightEvidence).toHaveBeenCalledWith(70, [3]);
    const userPrompt = llm.completeJson.mock.calls[0][0].userPrompt as string;
    const priorIds = (JSON.parse(userPrompt).prior_approved_insights as { insight_id: number }[]).map(
      (h) => h.insight_id,
    );
    expect(priorIds).toContain(88);
    expect(priorIds).not.toContain(99);
    expect(repo.succeedAiRun.mock.calls[0][1].outputJson.rag_hit_ids).toEqual([88]);
    expect(repo.listEmbeddings).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'acme' }));
  });

  it('M2-1d: flag on + PII excerpt skips RAG and still drafts once', async () => {
    config.researchRagEnabled = true;
    stubInsightCopilotSuccess('SĐT 0901234567');

    const out = await service.insightCopilot(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { evidence_ids: [3] },
      'am@ptt',
    );

    expect(repo.listEmbeddings).not.toHaveBeenCalled();
    expect(out.rag_note).toBe('rag_skipped_pii');
    expect(llm.completeJson).toHaveBeenCalledTimes(1);
    expect(repo.createInsight).toHaveBeenCalledTimes(1);
    const userPrompt = llm.completeJson.mock.calls[0][0].userPrompt as string;
    expect(Array.isArray(JSON.parse(userPrompt))).toBe(true);
    expect(repo.succeedAiRun.mock.calls[0][1].promptVersion).toBe('research-insight-v1');
  });

  it('M2-1e: flag on + empty embeddings uses v2 empty prior and rag_empty', async () => {
    config.researchRagEnabled = true;
    stubInsightCopilotSuccess();
    repo.listEmbeddings.mockResolvedValue([]);

    const out = await service.insightCopilot(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { evidence_ids: [3] },
      'am@ptt',
    );

    expect(out.rag_note).toBe('rag_empty');
    const { userPrompt, systemPrompt } = llm.completeJson.mock.calls[0][0] as {
      userPrompt: string;
      systemPrompt: string;
    };
    expect(JSON.parse(userPrompt).prior_approved_insights).toEqual([]);
    expect(systemPrompt).toMatch(/invent insight_id/i);
  });

  it('insightCopilot: flag on + listEmbeddings reject still drafts with P0 prompt and rag_empty', async () => {
    config.researchRagEnabled = true;
    stubInsightCopilotSuccess();
    repo.listEmbeddings.mockRejectedValue(new Error('embeddings_unavailable'));

    const out = await service.insightCopilot(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { evidence_ids: [3] },
      'am@ptt',
    );

    expect(repo.listEmbeddings).toHaveBeenCalled();
    expect(llm.completeJson).toHaveBeenCalledTimes(1);
    expect(repo.createInsight).toHaveBeenCalledTimes(1);
    expect(out.rag_note).toBe('rag_empty');
    expect(out.rag_hits).toEqual([]);
    const userPrompt = llm.completeJson.mock.calls[0][0].userPrompt as string;
    expect(Array.isArray(JSON.parse(userPrompt))).toBe(true);
  });

  it('M2-1f: copilot does not createReport, publish, or approveInsight', async () => {
    config.researchRagEnabled = true;
    stubInsightCopilotSuccess();
    repo.listEmbeddings.mockResolvedValue([]);
    const createReport = jest.spyOn(service, 'createReport');
    const publishPortal = jest.spyOn(service, 'publishPortal');
    const approveInsight = jest.spyOn(service, 'approveInsight');

    await service.insightCopilot(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { evidence_ids: [3] },
      'am@ptt',
    );

    expect(createReport).not.toHaveBeenCalled();
    expect(publishPortal).not.toHaveBeenCalled();
    expect(approveInsight).not.toHaveBeenCalled();
    expect(repo.createReportDraft).not.toHaveBeenCalled();
    createReport.mockRestore();
    publishPortal.mockRestore();
    approveInsight.mockRestore();
  });

  it('createReport snapshot has evidence_index when insight has EV', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({ status: 'approved_internal', evidence_ids: [3] }),
    );
    repo.listQuestions.mockResolvedValue([
      { id: 21, project_id: 9, sort_order: 1, question_vi: 'Quy mô?', question_en: null, analysis_frame: null, created_at: '2026-08-14' },
    ]);
    repo.listEvidence.mockResolvedValue([
      evidenceRow({ id: 3, locator: 'https://example.com#p3', question_id: 21 }),
    ]);
    repo.listReports.mockResolvedValue([]);
    repo.insertReportVersion.mockImplementation(async (input: { contentSnapshot: Record<string, unknown> }) => ({
      report_id: 1,
      version_id: 10,
      version: 1,
      content_snapshot: input.contentSnapshot,
      content_hash: 'abc',
    }));

    const out = await service.createReport(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { insight_ids: [7] },
      'am@ptt',
    );

    const index = out.content_snapshot.evidence_index as unknown[];
    expect(index.length).toBeGreaterThanOrEqual(1);
    expect(out.version).toBe(1);
    expect(repo.insertReportVersion).toHaveBeenCalled();
  });

  it('createReport TC + methodology stub is 400 methodology_incomplete', async () => {
    stubScopedProject();
    repo.getProject.mockResolvedValue({ ...project, dv12_tier: 'TC' });
    repo.getInsight.mockResolvedValue(insightRow({ status: 'approved_internal', evidence_ids: [3] }));

    try {
      await service.createReport(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        {
          insight_ids: [7],
          methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        },
        'am@ptt',
      );
      throw new Error('expected 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'methodology_incomplete' });
    }
    expect(repo.insertReportVersion).not.toHaveBeenCalled();
  });

  it('exportReportVersion CB + stub still exports (P0 no regress)', async () => {
    stubScopedProject();
    repo.getReport.mockResolvedValue({
      id: 1,
      project_id: 9,
      template: 'std',
      status: 'draft',
      created_at: '2026-08-14',
      versions: [],
    });
    repo.getReportVersion.mockResolvedValue({
      id: 10,
      report_id: 1,
      version: 1,
      content_snapshot: {
        cover: { client: 'Acme', title: 'T', confidential: true, version: 1, as_of: '2026-08-14' },
        exec: 'exec',
        findings: [],
        recs: [],
        methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        evidence_index: [],
        status: 'draft',
        insight_ids: [7],
      },
      generated_by: 'am@ptt',
      content_hash: 'abc',
      created_at: '2026-08-14',
    });

    const out = await service.exportReportVersion(1, 10, {
      restricted: true,
      allowedClientIds: ['acme'],
    });
    expect(out).toBeInstanceOf(StreamableFile);
    const headers = out.getHeaders();
    expect(headers.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(headers.disposition).toContain('.docx');
  });

  it('exportReportVersion format=pdf returns application/pdf and .pdf filename', async () => {
    stubScopedProject();
    repo.getReport.mockResolvedValue({
      id: 1,
      project_id: 9,
      template: 'std',
      status: 'draft',
      created_at: '2026-08-14',
      versions: [],
    });
    repo.getReportVersion.mockResolvedValue({
      id: 10,
      report_id: 1,
      version: 1,
      content_snapshot: {
        cover: { client: 'Acme', title: 'T', confidential: true, version: 1, as_of: '2026-08-14' },
        exec: 'exec',
        findings: [],
        recs: [],
        methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        evidence_index: [],
        status: 'draft',
        insight_ids: [7],
      },
      generated_by: 'am@ptt',
      content_hash: 'abc',
      created_at: '2026-08-14',
    });

    const out = await service.exportReportVersion(
      1,
      10,
      { restricted: true, allowedClientIds: ['acme'] },
      'pdf',
    );
    expect(out).toBeInstanceOf(StreamableFile);
    const headers = out.getHeaders();
    expect(headers.type).toBe('application/pdf');
    expect(headers.disposition).toBe('attachment; filename="research-report-1-v1.pdf"');
  });

  it('P29 exportReportVersion pdf adds stale footer when finding insight expired', async () => {
    stubScopedProject();
    repo.getReport.mockResolvedValue({
      id: 1,
      project_id: 9,
      template: 'std',
      status: 'draft',
      created_at: '2026-08-14',
      versions: [],
    });
    repo.getReportVersion.mockResolvedValue({
      id: 10,
      report_id: 1,
      version: 1,
      content_snapshot: {
        cover: { client: 'Acme', title: 'T', confidential: true, version: 1, as_of: '2026-08-14' },
        exec: 'exec',
        findings: [{ insight_id: 11, text: 'stale finding' }],
        recs: [],
        methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        evidence_index: [],
        status: 'draft',
        insight_ids: [11],
      },
      generated_by: 'am@ptt',
      content_hash: 'abc',
      created_at: '2026-08-14',
    });
    repo.listInsightValidToForProject.mockResolvedValue(new Map([[11, '2020-01-01']]));
    const spy = jest.spyOn(pdfUtil, 'buildResearchReportPdf');

    await service.exportReportVersion(
      1,
      10,
      { restricted: true, allowedClientIds: ['acme'] },
      'pdf',
    );

    expect(repo.listInsightValidToForProject).toHaveBeenCalledWith(9, [11]);
    expect(spy).toHaveBeenCalledWith(expect.anything(), undefined, REPORT_PDF_STALE_FOOTER_STAFF);
    spy.mockRestore();
  });

  it('P29 exportReportVersion pdf no footer when all insights fresh', async () => {
    stubScopedProject();
    repo.getReport.mockResolvedValue({
      id: 1,
      project_id: 9,
      template: 'std',
      status: 'draft',
      created_at: '2026-08-14',
      versions: [],
    });
    repo.getReportVersion.mockResolvedValue({
      id: 10,
      report_id: 1,
      version: 1,
      content_snapshot: {
        cover: { client: 'Acme', title: 'T', confidential: true, version: 1, as_of: '2026-08-14' },
        exec: 'exec',
        findings: [{ insight_id: 11, text: 'ok' }],
        recs: [],
        methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        evidence_index: [],
        status: 'draft',
        insight_ids: [11],
      },
      generated_by: 'am@ptt',
      content_hash: 'abc',
      created_at: '2026-08-14',
    });
    repo.listInsightValidToForProject.mockResolvedValue(new Map([[11, null]]));
    const spy = jest.spyOn(pdfUtil, 'buildResearchReportPdf');

    await service.exportReportVersion(
      1,
      10,
      { restricted: true, allowedClientIds: ['acme'] },
      'pdf',
    );

    expect(spy).toHaveBeenCalledWith(expect.anything(), undefined, undefined);
    spy.mockRestore();
  });

  it('P44 listReports sets has_stale_insights per version (stale vs fresh)', async () => {
    stubScopedProject();
    repo.listReports.mockResolvedValue([
      {
        id: 1,
        project_id: 9,
        template: 'std',
        status: 'draft',
        created_at: '2026-08-14',
        versions: [
          versionRow({
            id: 10,
            version: 1,
            content_snapshot: {
              findings: [{ insight_id: 11, text: 'stale' }],
              recs: [],
              insight_ids: [11],
            },
          }),
          versionRow({
            id: 11,
            version: 2,
            content_snapshot: {
              findings: [{ insight_id: 12, text: 'fresh' }],
              recs: [],
              insight_ids: [12],
            },
          }),
        ],
      },
    ]);
    repo.listInsightValidToForProject.mockResolvedValue(
      new Map([
        [11, '2020-01-01'],
        [12, '2026-12-31'],
      ]),
    );

    const { reports } = await service.listReports(9, {
      restricted: true,
      allowedClientIds: ['acme'],
    });

    expect(repo.listInsightValidToForProject).toHaveBeenCalledWith(9, [11, 12]);
    expect(reports[0].versions[0].has_stale_insights).toBe(true);
    expect(reports[0].versions[1].has_stale_insights).toBe(false);
  });

  it('P44 listReports has_stale_insights false when insight id missing from map', async () => {
    stubScopedProject();
    repo.listReports.mockResolvedValue([
      {
        id: 1,
        project_id: 9,
        template: 'std',
        status: 'draft',
        created_at: '2026-08-14',
        versions: [
          versionRow({
            content_snapshot: {
              findings: [{ insight_id: 99, text: 'unknown' }],
              recs: [],
              insight_ids: [99],
            },
          }),
        ],
      },
    ]);
    repo.listInsightValidToForProject.mockResolvedValue(new Map());

    const { reports } = await service.listReports(9, {
      restricted: true,
      allowedClientIds: ['acme'],
    });

    expect(reports[0].versions[0].has_stale_insights).toBe(false);
    expect(reports[0].versions[0].content_snapshot).not.toHaveProperty('has_stale_insights');
  });

  it('P44 listReports skips listInsightValidToForProject when no insight ids', async () => {
    stubScopedProject();
    repo.listReports.mockResolvedValue([
      {
        id: 1,
        project_id: 9,
        template: 'std',
        status: 'draft',
        created_at: '2026-08-14',
        versions: [
          versionRow({
            content_snapshot: { findings: [], recs: [], insight_ids: [] },
          }),
        ],
      },
    ]);

    const { reports } = await service.listReports(9, {
      restricted: true,
      allowedClientIds: ['acme'],
    });

    expect(repo.listInsightValidToForProject).not.toHaveBeenCalled();
    expect(reports[0].versions[0].has_stale_insights).toBe(false);
  });

  it('P31 exportReportVersion docx adds stale footer when finding expired', async () => {
    stubScopedProject();
    repo.getReport.mockResolvedValue({
      id: 1,
      project_id: 9,
      template: 'std',
      status: 'draft',
      created_at: '2026-08-14',
      versions: [],
    });
    repo.getReportVersion.mockResolvedValue({
      id: 10,
      report_id: 1,
      version: 1,
      content_snapshot: {
        cover: { client: 'Acme', title: 'T', confidential: true, version: 1, as_of: '2026-08-14' },
        exec: 'exec',
        findings: [{ insight_id: 11, text: 'stale finding' }],
        recs: [],
        methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        evidence_index: [],
        status: 'draft',
        insight_ids: [11],
      },
      generated_by: 'am@ptt',
      content_hash: 'abc',
      created_at: '2026-08-14',
    });
    repo.listInsightValidToForProject.mockResolvedValue(new Map([[11, '2020-01-01']]));
    const spy = jest.spyOn(docxUtil, 'buildResearchReportDocx');

    await service.exportReportVersion(1, 10, { restricted: true, allowedClientIds: ['acme'] }, 'docx');

    expect(repo.listInsightValidToForProject).toHaveBeenCalledWith(9, [11]);
    expect(spy).toHaveBeenCalledWith(expect.anything(), REPORT_PDF_STALE_FOOTER_STAFF);
    spy.mockRestore();
  });

  it('P31 exportReportVersion docx no footer when insights fresh', async () => {
    stubScopedProject();
    repo.getReport.mockResolvedValue({
      id: 1,
      project_id: 9,
      template: 'std',
      status: 'draft',
      created_at: '2026-08-14',
      versions: [],
    });
    repo.getReportVersion.mockResolvedValue({
      id: 10,
      report_id: 1,
      version: 1,
      content_snapshot: {
        cover: { client: 'Acme', title: 'T', confidential: true, version: 1, as_of: '2026-08-14' },
        exec: 'exec',
        findings: [{ insight_id: 11, text: 'ok' }],
        recs: [],
        methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        evidence_index: [],
        status: 'draft',
        insight_ids: [11],
      },
      generated_by: 'am@ptt',
      content_hash: 'abc',
      created_at: '2026-08-14',
    });
    repo.listInsightValidToForProject.mockResolvedValue(new Map([[11, null]]));
    const spy = jest.spyOn(docxUtil, 'buildResearchReportDocx');

    await service.exportReportVersion(1, 10, { restricted: true, allowedClientIds: ['acme'] }, 'docx');

    expect(spy).toHaveBeenCalledWith(expect.anything(), undefined);
    spy.mockRestore();
  });

  it('exportReportVersion TC + stub + format=pdf is 400 methodology_incomplete', async () => {
    stubScopedProject();
    repo.getProject.mockResolvedValue({ ...project, dv12_tier: 'TC' });
    repo.getReport.mockResolvedValue({
      id: 1,
      project_id: 9,
      template: 'std',
      status: 'draft',
      created_at: '2026-08-14',
      versions: [],
    });
    repo.getReportVersion.mockResolvedValue({
      id: 10,
      report_id: 1,
      version: 1,
      content_snapshot: {
        cover: { client: 'Acme', title: 'Secret title must not leak', confidential: true, version: 1, as_of: '2026-08-14' },
        exec: 'exec',
        findings: [],
        recs: [],
        methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        evidence_index: [],
        status: 'draft',
        insight_ids: [7],
      },
      generated_by: 'am@ptt',
      content_hash: 'abc',
      created_at: '2026-08-14',
    });

    try {
      await service.exportReportVersion(
        1,
        10,
        { restricted: true, allowedClientIds: ['acme'] },
        'pdf',
      );
      throw new Error('expected 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'methodology_incomplete' });
    }
  });

  it('exportReportVersion outside scope is 403 without title', async () => {
    repo.getReport.mockResolvedValue({
      id: 1,
      project_id: 9,
      template: 'std',
      status: 'draft',
      created_at: '2026-08-14',
      versions: [],
    });
    repo.getProjectClientId.mockResolvedValue('other-client');
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.getReportVersion.mockResolvedValue({
      id: 10,
      report_id: 1,
      version: 1,
      content_snapshot: {
        cover: { client: 'Acme', title: 'Secret title must not leak', confidential: true, version: 1, as_of: '2026-08-14' },
        exec: 'exec',
        findings: [],
        recs: [],
        methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        evidence_index: [],
        status: 'draft',
        insight_ids: [7],
      },
      generated_by: 'am@ptt',
      content_hash: 'abc',
      created_at: '2026-08-14',
    });

    try {
      await service.exportReportVersion(
        1,
        10,
        { restricted: true, allowedClientIds: ['acme'] },
        'pdf',
      );
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('title');
      expect(JSON.stringify(body)).not.toContain('Secret title');
    }
    expect(repo.getReportVersion).not.toHaveBeenCalled();
    expect(repo.getProject).not.toHaveBeenCalled();
  });

  it('approve-exec-en by generated_by is 403 cannot_self_approve', async () => {
    stubScopedProject();
    repo.getReport.mockResolvedValue({ id: 1, project_id: 9, status: 'draft' });
    repo.getReportVersion.mockResolvedValue({
      id: 10,
      report_id: 1,
      version: 1,
      content_snapshot: {
        cover: { client: 'Acme', title: 'T', confidential: true, version: 1, as_of: '2026-08-14' },
        exec: { vi: 'xin chào', en: 'hello', en_status: 'draft' },
        findings: [],
        recs: [],
        methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        evidence_index: [],
        status: 'draft',
        insight_ids: [7],
      },
      generated_by: 'am@ptt',
      content_hash: 'abc',
      created_at: '2026-08-14',
    });

    try {
      await service.approveReportExecEn(
        1,
        10,
        { restricted: true, allowedClientIds: ['acme'] },
        'am@ptt',
      );
      throw new Error('expected cannot_self_approve');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toEqual({ error: 'cannot_self_approve' });
    }
    expect(repo.updateReportVersionSnapshot).not.toHaveBeenCalled();
  });

  it('POST exec-en when approved is 400 exec_en_locked', async () => {
    stubScopedProject();
    repo.getReport.mockResolvedValue({ id: 1, project_id: 9, status: 'draft' });
    repo.getReportVersion.mockResolvedValue({
      id: 10,
      report_id: 1,
      version: 1,
      content_snapshot: {
        cover: { client: 'Acme', title: 'T', confidential: true, version: 1, as_of: '2026-08-14' },
        exec: { vi: 'xin chào', en: 'hello', en_status: 'approved' },
        findings: [],
        recs: [],
        methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        evidence_index: [],
        status: 'draft',
        insight_ids: [7],
      },
      generated_by: 'am@ptt',
      content_hash: 'abc',
      created_at: '2026-08-14',
    });

    try {
      await service.updateReportExecEn(
        1,
        10,
        { restricted: true, allowedClientIds: ['acme'] },
        { en: 'new translation' },
        'lead@ptt',
      );
      throw new Error('expected exec_en_locked');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'exec_en_locked' });
    }
    expect(repo.updateReportVersionSnapshot).not.toHaveBeenCalled();
  });

  it('approve-exec-en with stored en null/empty is 400 validation_error', async () => {
    for (const en of [null, '']) {
      repo.updateReportVersionSnapshot.mockClear();
      stubScopedProject();
      repo.getReport.mockResolvedValue({ id: 1, project_id: 9, status: 'draft' });
      repo.getReportVersion.mockResolvedValue({
        id: 10,
        report_id: 1,
        version: 1,
        content_snapshot: {
          cover: { client: 'Acme', title: 'T', confidential: true, version: 1, as_of: '2026-08-14' },
          exec: { vi: 'xin chào', en, en_status: 'draft' },
          findings: [],
          recs: [],
          methodology: { stub: true, population: '', source_plan: '', limitation: '' },
          evidence_index: [],
          status: 'draft',
          insight_ids: [7],
        },
        generated_by: 'am@ptt',
        content_hash: 'abc',
        created_at: '2026-08-14',
      });
      repo.updateReportVersionSnapshot.mockResolvedValue({
        id: 10,
        report_id: 1,
        version: 1,
        content_snapshot: { exec: { vi: 'xin chào', en, en_status: 'approved' } },
        generated_by: 'am@ptt',
        content_hash: 'abc',
        created_at: '2026-08-14',
      });

      try {
        await service.approveReportExecEn(
          1,
          10,
          { restricted: true, allowedClientIds: ['acme'] },
          'lead@ptt',
        );
        throw new Error('expected validation_error');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).getStatus()).toBe(400);
        expect((err as BadRequestException).getResponse()).toEqual({
          error: 'validation_error',
          messages: ['en is required'],
        });
      }
      expect(repo.updateReportVersionSnapshot).not.toHaveBeenCalled();
    }
  });

  it('approve-exec-en when approved is 400 exec_en_locked', async () => {
    stubScopedProject();
    repo.getReport.mockResolvedValue({ id: 1, project_id: 9, status: 'draft' });
    repo.getReportVersion.mockResolvedValue({
      id: 10,
      report_id: 1,
      version: 1,
      content_snapshot: {
        cover: { client: 'Acme', title: 'T', confidential: true, version: 1, as_of: '2026-08-14' },
        exec: { vi: 'xin chào', en: 'hello', en_status: 'approved' },
        findings: [],
        recs: [],
        methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        evidence_index: [],
        status: 'draft',
        insight_ids: [7],
      },
      generated_by: 'am@ptt',
      content_hash: 'abc',
      created_at: '2026-08-14',
    });
    repo.updateReportVersionSnapshot.mockResolvedValue({
      id: 10,
      report_id: 1,
      version: 1,
      content_snapshot: { exec: { vi: 'xin chào', en: 'hello', en_status: 'approved' } },
      generated_by: 'am@ptt',
      content_hash: 'abc',
      created_at: '2026-08-14',
    });

    try {
      await service.approveReportExecEn(
        1,
        10,
        { restricted: true, allowedClientIds: ['acme'] },
        'lead@ptt',
      );
      throw new Error('expected exec_en_locked');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'exec_en_locked' });
    }
    expect(repo.updateReportVersionSnapshot).not.toHaveBeenCalled();
  });

  it('createReport rejects insights below approved_internal', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(insightRow({ status: 'draft', evidence_ids: [3] }));

    await expect(
      service.createReport(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { insight_ids: [7] },
        'am@ptt',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.insertReportVersion).not.toHaveBeenCalled();
  });

  it('createReport → portal_visible === false', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({ status: 'approved_internal', evidence_ids: [3] }),
    );
    repo.listQuestions.mockResolvedValue([]);
    repo.listEvidence.mockResolvedValue([]);
    repo.listReports.mockResolvedValue([]);
    repo.insertReportVersion.mockImplementation(async (input: { contentSnapshot: Record<string, unknown> }) => ({
      report_id: 1,
      version_id: 10,
      version: 1,
      content_snapshot: input.contentSnapshot,
      content_hash: 'abc',
    }));

    const out = await service.createReport(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { insight_ids: [7] },
      'am@ptt',
    );

    expect(out.portal_visible).toBe(false);
    expect(out.published_by).toBe(null);
    expect(repo.updateReportVersionPortalVisible).not.toHaveBeenCalled();
  });

  it('publish when insight approved_internal is 400 insights_not_client_facing', async () => {
    stubScopedProject();
    repo.getReport.mockResolvedValue({ id: 1, project_id: 9, status: 'draft' });
    repo.getReportVersion.mockResolvedValue(
      versionRow({
        content_snapshot: { insight_ids: [7] },
        generated_by: 'am@ptt',
      }),
    );
    repo.getInsight.mockResolvedValue(insightRow({ status: 'approved_internal' }));

    try {
      await service.publishPortal(
        1,
        10,
        { restricted: true, allowedClientIds: ['acme'] },
        { visible: true },
        'lead@ptt',
      );
      throw new Error('expected insights_not_client_facing');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual({
        error: 'insights_not_client_facing',
      });
    }
    expect(repo.updateReportVersionPortalVisible).not.toHaveBeenCalled();
    expect(repo.createDecision).not.toHaveBeenCalled();
  });

  it('publish by generated_by is 403 cannot_self_approve', async () => {
    stubScopedProject();
    repo.getReport.mockResolvedValue({ id: 1, project_id: 9, status: 'draft' });
    repo.getReportVersion.mockResolvedValue(
      versionRow({
        content_snapshot: { insight_ids: [7] },
        generated_by: 'am@ptt',
      }),
    );
    repo.getInsight.mockResolvedValue(insightRow({ status: 'approved_client_facing' }));

    try {
      await service.publishPortal(
        1,
        10,
        { restricted: true, allowedClientIds: ['acme'] },
        { visible: true },
        'am@ptt',
      );
      throw new Error('expected cannot_self_approve');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toEqual({ error: 'cannot_self_approve' });
    }
    expect(repo.updateReportVersionPortalVisible).not.toHaveBeenCalled();
  });

  it('publish stamps published_by / published_at; unpublish keeps audit', async () => {
    stubScopedProject();
    repo.getReport.mockResolvedValue({ id: 1, project_id: 9, status: 'draft' });
    repo.getReportVersion.mockResolvedValue(
      versionRow({
        content_snapshot: { insight_ids: [7] },
        generated_by: 'am@ptt',
      }),
    );
    repo.getInsight.mockResolvedValue(insightRow({ status: 'approved_client_facing' }));
    repo.updateReportVersionPortalVisible.mockImplementation(
      (...args: unknown[]) => {
        const visible = args[2] as boolean;
        const actor = args[3] as string | undefined;
        return Promise.resolve(
          versionRow({
            portal_visible: visible,
            published_by: visible ? actor ?? null : 'lead@ptt',
            published_at: visible
              ? actor
                ? '2026-08-14T10:00:00.000Z'
                : null
              : '2026-08-14T10:00:00.000Z',
          }),
        );
      },
    );

    const published = await service.publishPortal(
      1,
      10,
      { restricted: true, allowedClientIds: ['acme'] },
      { visible: true },
      'lead@ptt',
    );
    expect(published.published_by).toBeTruthy();
    expect(published.published_at).toBeTruthy();

    const unpublished = await service.publishPortal(
      1,
      10,
      { restricted: true, allowedClientIds: ['acme'] },
      { visible: false },
      'lead@ptt',
    );
    expect(unpublished.portal_visible).toBe(false);
    expect(unpublished.published_by).toBe('lead@ptt');
    expect(unpublished.published_at).toBeTruthy();
  });

  it('P32 publishPortal visible bakes published_valid_to then sets visible', async () => {
    stubScopedProject();
    repo.getReport.mockResolvedValue({ id: 1, project_id: 9, status: 'draft' });
    repo.getReportVersion.mockResolvedValue(
      versionRow({
        content_snapshot: {
          insight_ids: [11],
          findings: [{ insight_id: 11, text: 'x' }],
          recs: [{ insight_id: 11, text: 'r' }],
        },
        generated_by: 'am@ptt',
      }),
    );
    repo.getInsight.mockResolvedValue(insightRow({ id: 11, status: 'approved_client_facing' }));
    repo.listInsightValidToForProject.mockResolvedValue(new Map([[11, '2026-12-31']]));
    repo.updateReportVersionSnapshot.mockResolvedValue(versionRow());
    repo.updateReportVersionPortalVisible.mockResolvedValue(
      versionRow({ portal_visible: true, published_by: 'lead@ptt' }),
    );

    await service.publishPortal(
      1,
      10,
      { restricted: true, allowedClientIds: ['acme'] },
      { visible: true },
      'lead@ptt',
    );

    expect(repo.listInsightValidToForProject).toHaveBeenCalledWith(9, [11]);
    expect(repo.updateReportVersionSnapshot).toHaveBeenCalledWith(
      1,
      10,
      expect.objectContaining({
        findings: [expect.objectContaining({ insight_id: 11, published_valid_to: '2026-12-31' })],
        recs: [expect.objectContaining({ published_valid_to: '2026-12-31' })],
      }),
    );
    expect(repo.updateReportVersionPortalVisible).toHaveBeenCalled();
  });

  it('P32 publishPortal unpublish does not rewrite snapshot', async () => {
    stubScopedProject();
    repo.getReport.mockResolvedValue({ id: 1, project_id: 9, status: 'draft' });
    repo.getReportVersion.mockResolvedValue(
      versionRow({
        content_snapshot: { insight_ids: [11], findings: [{ insight_id: 11, published_valid_to: '2026-12-31' }] },
        generated_by: 'am@ptt',
      }),
    );
    repo.updateReportVersionPortalVisible.mockResolvedValue(
      versionRow({ portal_visible: false, published_by: 'lead@ptt' }),
    );

    await service.publishPortal(
      1,
      10,
      { restricted: true, allowedClientIds: ['acme'] },
      { visible: false },
      'lead@ptt',
    );

    expect(repo.updateReportVersionSnapshot).not.toHaveBeenCalled();
    expect(repo.listInsightValidToForProject).not.toHaveBeenCalled();
  });

  it('reportCopilot with 0 insights is 400', async () => {
    stubScopedProject();

    try {
      await service.reportCopilot(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { insight_ids: [] },
        'am@ptt',
      );
      throw new Error('expected 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
    }
    expect(llm.completeJson).not.toHaveBeenCalled();
    expect(repo.createReportDraft).not.toHaveBeenCalled();
  });

  it('listApprovedInsightsForClient outside scope is 403 without title', async () => {
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.listApprovedInsightsByClient.mockResolvedValue([
      insightRow({ statement: 'Secret title must not leak' }),
    ]);

    try {
      await service.listApprovedInsightsForClient(
        { restricted: true, allowedClientIds: ['acme'] },
        'other-client',
      );
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('title');
      expect(JSON.stringify(body)).not.toContain('Secret title');
    }
    expect(repo.listApprovedInsightsByClient).not.toHaveBeenCalled();
  });

  it('listApprovedInsightsForClient returns approved_internal+ for that client', async () => {
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    const approved = insightRow({
      status: 'approved_internal',
      statement: 'Premium SKU tăng share ở MT HCM',
    });
    repo.listApprovedInsightsByClient.mockResolvedValue([approved]);

    const out = await service.listApprovedInsightsForClient(
      { restricted: true, allowedClientIds: ['acme'] },
      'acme',
    );

    expect(out.insights).toEqual([approved]);
    expect(repo.listApprovedInsightsByClient).toHaveBeenCalledWith('acme');
  });

  it('insertPlanInsights persists ids only and rejects statement in persist payload', async () => {
    stubScopedProject();
    plans.getPlanById.mockReturnValue({
      id: 3,
      name: 'Secret plan title',
      khtn_market_research_json: '{}',
    });
    repo.getInsight.mockResolvedValue(
      insightRow({ status: 'approved_internal', statement: 'Premium SKU tăng share ở MT HCM' }),
    );
    plans.patchPlan.mockImplementation((_id: number, body: { khtn_market_research_json?: string }) => {
      const stored = JSON.parse(String(body.khtn_market_research_json ?? '{}'));
      expect(stored).not.toHaveProperty('statement');
      expect(JSON.stringify(stored)).not.toContain('Premium SKU');
      expect(JSON.stringify(stored)).not.toContain('statement');
      return { id: 3, khtn_market_research_json: JSON.stringify(stored) };
    });

    const { assertNoInsightTextLeak } = await import('./plan-insight-snapshot.util');
    expect(() =>
      assertNoInsightTextLeak({
        client_id: 'acme',
        insight_ids: [7],
        statement: 'Premium SKU tăng share ở MT HCM',
      }),
    ).toThrow('plan_must_not_copy_insight_text');

    const out = await service.insertPlanInsights(
      3,
      { restricted: true, allowedClientIds: ['acme'] },
      { client_id: 'acme', insight_ids: [7] },
      'am@ptt',
    );

    expect(plans.patchPlan).toHaveBeenCalledTimes(1);
    const persisted = JSON.parse(
      String((plans.patchPlan.mock.calls[0][1] as { khtn_market_research_json: string }).khtn_market_research_json),
    );
    expect(Object.keys(persisted).sort()).toEqual(
      ['client_id', 'inserted_at', 'inserted_by', 'insight_ids'].sort(),
    );
    expect(persisted.insight_ids).toEqual([7]);
    expect(persisted.client_id).toBe('acme');
    expect(JSON.stringify(persisted)).not.toContain('statement');
    expect(out.snapshot.insight_ids).toEqual([7]);
  });

  it('insertPlanInsights client mismatch is 400 client_mismatch', async () => {
    stubScopedProject();
    plans.getPlanById.mockReturnValue({ id: 3, name: 'Secret plan title', khtn_market_research_json: '{}' });
    repo.getInsight.mockResolvedValue(insightRow({ status: 'approved_internal' }));
    repo.getProjectClientId.mockResolvedValue('acme');

    try {
      await service.insertPlanInsights(
        3,
        { restricted: false, allowedClientIds: [] },
        { client_id: 'other-client', insight_ids: [7] },
        'am@ptt',
      );
      throw new Error('expected client_mismatch');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'client_mismatch' });
    }
    expect(plans.patchPlan).not.toHaveBeenCalled();
  });

  it('insertPlanInsights unapproved insight is 400 insight_not_approved', async () => {
    stubScopedProject();
    plans.getPlanById.mockReturnValue({ id: 3, name: 'Secret plan title', khtn_market_research_json: '{}' });
    repo.getInsight.mockResolvedValue(insightRow({ status: 'draft' }));

    try {
      await service.insertPlanInsights(
        3,
        { restricted: true, allowedClientIds: ['acme'] },
        { client_id: 'acme', insight_ids: [7] },
        'am@ptt',
      );
      throw new Error('expected insight_not_approved');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'insight_not_approved' });
    }
    expect(plans.patchPlan).not.toHaveBeenCalled();
  });

  it('insertPlanInsights missing plan is 404 not_found without title', async () => {
    plans.getPlanById.mockReturnValue(null);

    try {
      await service.insertPlanInsights(
        99,
        { restricted: true, allowedClientIds: ['acme'] },
        { client_id: 'acme', insight_ids: [7] },
        'am@ptt',
      );
      throw new Error('expected not_found');
    } catch (err) {
      expect((err as { getStatus?: () => number }).getStatus?.()).toBe(404);
      const body = (err as { getResponse: () => unknown }).getResponse();
      expect(body).toEqual({ error: 'not_found' });
      expect(JSON.stringify(body)).not.toContain('title');
      expect(JSON.stringify(body)).not.toContain('Secret');
    }
    expect(plans.patchPlan).not.toHaveBeenCalled();
    expect(repo.getInsight).not.toHaveBeenCalled();
  });

  it('insertContentInsights draft insight is 400 insight_not_approved', async () => {
    stubScopedProject();
    contentItems.findItemById.mockResolvedValue({
      id: 44,
      lifecycle_id: 3,
      title: 'Secret content title',
      brief_json: { hook: 'old' },
      body_json: { markdown: 'keep me' },
    });
    contentMarketing.getContext.mockResolvedValue({ email_client_id: 'acme' });
    contentMarketing.getLifecycleClientId.mockResolvedValue('acme');
    repo.getInsight.mockResolvedValue(insightRow({ status: 'draft' }));

    try {
      await service.insertContentInsights(
        44,
        { restricted: true, allowedClientIds: ['acme'] },
        { client_id: 'acme', insight_ids: [7] },
        'am@ptt',
      );
      throw new Error('expected insight_not_approved');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'insight_not_approved' });
      expect(JSON.stringify((err as BadRequestException).getResponse())).not.toContain('Secret');
    }
    expect(contentItems.patchItem).not.toHaveBeenCalled();
  });

  it('insertContentInsights body client ≠ lifecycle client is 400 content_item_client_mismatch', async () => {
    stubScopedProject();
    clientScope.allowedClientIdsForList.mockReturnValue(['acme', 'other-client']);
    contentItems.findItemById.mockResolvedValue({
      id: 44,
      lifecycle_id: 3,
      title: 'Secret content title',
      brief_json: { hook: 'old' },
    });
    contentMarketing.getContext.mockResolvedValue({ email_client_id: 'acme' });
    contentMarketing.getLifecycleClientId.mockResolvedValue('acme');

    try {
      await service.insertContentInsights(
        44,
        { restricted: true, allowedClientIds: ['acme', 'other-client'] },
        { client_id: 'other-client', insight_ids: [7] },
        'am@ptt',
      );
      throw new Error('expected content_item_client_mismatch');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({
        error: 'content_item_client_mismatch',
      });
      expect(JSON.stringify((err as BadRequestException).getResponse())).not.toContain('Secret');
    }
    expect(contentItems.patchItem).not.toHaveBeenCalled();
  });

  it('insertContentInsights persists ids only and leak assert passes', async () => {
    stubScopedProject();
    contentItems.findItemById.mockResolvedValue({
      id: 44,
      lifecycle_id: 3,
      title: 'Secret content title',
      brief_json: { hook: 'old' },
      body_json: { markdown: 'keep me' },
    });
    contentMarketing.getContext.mockResolvedValue({ email_client_id: 'acme' });
    contentMarketing.getLifecycleClientId.mockResolvedValue('acme');
    repo.getInsight.mockResolvedValue(
      insightRow({ status: 'approved_internal', statement: 'Premium SKU tăng share ở MT HCM' }),
    );
    contentItems.patchItem.mockImplementation(
      (_lifecycleId: number, _itemId: number, patch: { brief_json?: Record<string, unknown> }) => {
        const stored = patch.brief_json ?? {};
        expect(stored).toHaveProperty('hook', 'old');
        expect(stored.market_research).not.toHaveProperty('statement');
        expect(JSON.stringify(stored)).not.toContain('Premium SKU');
        expect(JSON.stringify(stored)).not.toContain('statement');
        return { id: 44, brief_json: stored, body_json: { markdown: 'keep me' } };
      },
    );

    const { assertNoInsightTextLeak } = await import('./plan-insight-snapshot.util');
    expect(() =>
      assertNoInsightTextLeak({
        client_id: 'acme',
        insight_ids: [7],
        statement: 'Premium SKU tăng share ở MT HCM',
      }),
    ).toThrow('plan_must_not_copy_insight_text');

    const out = await service.insertContentInsights(
      44,
      { restricted: true, allowedClientIds: ['acme'] },
      { client_id: 'acme', insight_ids: [7] },
      'am@ptt',
    );

    expect(contentItems.patchItem).toHaveBeenCalledTimes(1);
    expect(contentItems.patchItem.mock.calls[0][0]).toBe(3);
    expect(contentItems.patchItem.mock.calls[0][1]).toBe(44);
    const persisted = contentItems.patchItem.mock.calls[0][2] as {
      brief_json: Record<string, unknown>;
      body_json?: unknown;
      title?: unknown;
    };
    expect(persisted).not.toHaveProperty('body_json');
    expect(persisted).not.toHaveProperty('title');
    const snap = persisted.brief_json.market_research as Record<string, unknown>;
    expect(Object.keys(snap).sort()).toEqual(
      ['client_id', 'inserted_at', 'inserted_by', 'insight_ids'].sort(),
    );
    expect(snap.insight_ids).toEqual([7]);
    expect(snap.client_id).toBe('acme');
    expect(JSON.stringify(snap)).not.toContain('statement');
    assertNoInsightTextLeak(snap);
    expect(out.snapshot.insight_ids).toEqual([7]);
  });

  it('insertContentInsights missing item is 404 without title', async () => {
    contentItems.findItemById.mockResolvedValue(null);

    try {
      await service.insertContentInsights(
        99,
        { restricted: true, allowedClientIds: ['acme'] },
        { client_id: 'acme', insight_ids: [7] },
        'am@ptt',
      );
      throw new Error('expected not_found');
    } catch (err) {
      expect((err as { getStatus?: () => number }).getStatus?.()).toBe(404);
      const body = (err as { getResponse: () => unknown }).getResponse();
      expect(body).toEqual({ error: 'not_found' });
      expect(JSON.stringify(body)).not.toContain('title');
      expect(JSON.stringify(body)).not.toContain('Secret');
    }
    expect(contentItems.patchItem).not.toHaveBeenCalled();
  });

  it('insertContentInsights empty lifecycle client is 400 content_item_no_client', async () => {
    stubScopedProject();
    contentItems.findItemById.mockResolvedValue({
      id: 44,
      lifecycle_id: 3,
      title: 'Secret content title',
      brief_json: {},
    });
    contentMarketing.getContext.mockResolvedValue({ email_client_id: null });
    contentMarketing.getLifecycleClientId.mockResolvedValue('');

    try {
      await service.insertContentInsights(
        44,
        { restricted: true, allowedClientIds: ['acme'] },
        { client_id: 'acme', insight_ids: [7] },
        'am@ptt',
      );
      throw new Error('expected content_item_no_client');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'content_item_no_client' });
    }
    expect(contentItems.patchItem).not.toHaveBeenCalled();
  });

  it('insertContentInsights empty lifecycle + out-of-scope body client is 403 without title', async () => {
    clientScope.allowedClientIdsForList.mockReturnValue(['beta']);
    contentItems.findItemById.mockResolvedValue({
      id: 44,
      lifecycle_id: 3,
      title: 'Secret content title',
      brief_json: {},
    });
    contentMarketing.getContext.mockResolvedValue({ email_client_id: null });
    contentMarketing.getLifecycleClientId.mockResolvedValue('');

    try {
      await service.insertContentInsights(
        44,
        { restricted: true, allowedClientIds: ['beta'] },
        { client_id: 'acme', insight_ids: [7] },
        'am@ptt',
      );
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('title');
      expect(JSON.stringify(body)).not.toContain('Secret');
    }
    expect(contentItems.patchItem).not.toHaveBeenCalled();
    expect(contentMarketing.getContext).not.toHaveBeenCalled();
  });

  it('insertContentInsights published item is 400 item_locked without patch', async () => {
    stubScopedProject();
    contentItems.findItemById.mockResolvedValue({
      id: 44,
      lifecycle_id: 3,
      title: 'Secret content title',
      status: 'published',
      brief_json: { hook: 'old' },
    });
    contentMarketing.getContext.mockResolvedValue({ email_client_id: 'acme' });
    contentMarketing.getLifecycleClientId.mockResolvedValue('acme');
    repo.getInsight.mockResolvedValue(insightRow({ status: 'approved_internal' }));

    try {
      await service.insertContentInsights(
        44,
        { restricted: true, allowedClientIds: ['acme'] },
        { client_id: 'acme', insight_ids: [7] },
        'am@ptt',
      );
      throw new Error('expected item_locked');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({
        error: 'item_locked',
        status: 'published',
      });
      expect(JSON.stringify((err as BadRequestException).getResponse())).not.toContain('Secret');
    }
    expect(contentItems.patchItem).not.toHaveBeenCalled();
  });

  it('insertContentInsights cross-tenant item is 403 without title', async () => {
    clientScope.allowedClientIdsForList.mockReturnValue(['beta']);
    contentItems.findItemById.mockResolvedValue({
      id: 44,
      lifecycle_id: 3,
      title: 'Secret content title',
      brief_json: {},
    });
    contentMarketing.getContext.mockResolvedValue({ email_client_id: 'acme' });
    contentMarketing.getLifecycleClientId.mockResolvedValue('acme');

    try {
      await service.insertContentInsights(
        44,
        { restricted: true, allowedClientIds: ['beta'] },
        { client_id: 'acme', insight_ids: [7] },
        'am@ptt',
      );
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('title');
      expect(JSON.stringify(body)).not.toContain('Secret');
    }
    expect(contentItems.patchItem).not.toHaveBeenCalled();
  });

  it('getOpsAnalytics out-of-scope client_id is 403 without title', async () => {
    clientScope.allowedClientIdsForList.mockReturnValue(['beta']);
    clientScope.assertListClientFilter.mockImplementation((scope, clientId) => {
      if (scope.restricted && clientId && !scope.allowedClientIds.includes(clientId)) {
        throw new ForbiddenException({ error: 'forbidden' });
      }
    });

    try {
      await service.getOpsAnalytics({ restricted: true, allowedClientIds: ['beta'] }, 'acme');
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('title');
      expect(JSON.stringify(body)).not.toContain('Secret title');
    }
    expect(repo.getOpsAnalytics).not.toHaveBeenCalled();
  });

  it('getOpsAnalytics scoped list omits a project outside allowedClientIds', async () => {
    clientScope.allowedClientIdsForList.mockReturnValue(['beta']);
    repo.getOpsAnalytics.mockResolvedValue({
      cycleHours: [10, 20, 30],
      totalProjects: 1,
      withVerified: 1,
      distributedProjects: 0,
      approvedReports: 0,
      projects: [
        { id: 1, client_id: 'beta', status: 'approved', verified_ev: 2 },
        { id: 2, client_id: 'acme', status: 'distributed', verified_ev: 4 },
      ],
    });

    const out = await service.getOpsAnalytics({ restricted: true, allowedClientIds: ['beta'] });

    expect(out.projects.map((p) => p.client_id)).not.toContain('acme');
    expect(out.projects).toEqual([{ id: 1, client_id: 'beta', status: 'approved', verified_ev: 2 }]);
    expect(JSON.stringify(out)).not.toContain('title');
    expect(out.cycle_time_hours.designed_to_approved_p50).toBe(20);
    expect(out.cycle_time_hours.sample).toBe(3);
    expect(out.evidence_completeness).toEqual({ projects: 1, with_verified_pct: 100 });
    expect(repo.getOpsAnalytics).toHaveBeenCalledWith({}, ['beta']);
  });

  it('P14 getThemeQuarterAnalytics out-of-scope client_id is 403', async () => {
    clientScope.allowedClientIdsForList.mockReturnValue(['beta']);
    clientScope.assertListClientFilter.mockImplementation((scope, clientId) => {
      if (scope.restricted && clientId && !scope.allowedClientIds.includes(clientId)) {
        throw new ForbiddenException({ error: 'forbidden' });
      }
    });

    await expect(
      service.getThemeQuarterAnalytics({ restricted: true, allowedClientIds: ['beta'] }, { client_id: 'acme' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.getThemeQuarterAnalytics).not.toHaveBeenCalled();
  });

  it('P14 getThemeQuarterAnalytics invalid year is 400', async () => {
    clientScope.allowedClientIdsForList.mockReturnValue(undefined);

    await expect(
      service.getThemeQuarterAnalytics({ restricted: false, allowedClientIds: [] }, { year: 1999 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.getThemeQuarterAnalytics).not.toHaveBeenCalled();
  });

  it('P14 getThemeQuarterAnalytics returns corpus rows scoped by year', async () => {
    clientScope.allowedClientIdsForList.mockReturnValue(['beta']);
    repo.getThemeQuarterAnalytics
      .mockResolvedValueOnce([
        { quarter: 1, theme_code: 'PRICE', label_vi: 'Giá', insight_count: 3 },
      ])
      .mockResolvedValueOnce([]);

    const out = await service.getThemeQuarterAnalytics(
      { restricted: true, allowedClientIds: ['beta'] },
      { year: 2026 },
    );

    expect(out.ok).toBe(true);
    expect(out.year).toBe(2026);
    expect(out.corpus_statuses).toEqual(['approved_client_facing', 'published']);
    expect(out.rows[0]).toMatchObject({
      quarter: 1,
      theme_code: 'PRICE',
      label_vi: 'Giá',
      insight_count: 3,
      prev_qoq_count: null,
      delta_qoq_pct: null,
      prev_yoy_count: null,
      delta_yoy_pct: null,
    });
    expect(JSON.stringify(out)).not.toContain('title');
    expect(repo.getThemeQuarterAnalytics).toHaveBeenCalledWith({ client_id: undefined, year: 2026 }, ['beta']);
    expect(repo.getThemeQuarterAnalytics).toHaveBeenCalledWith({ client_id: undefined, year: 2025 }, ['beta']);
  });

  it('P16 getThemeQuarterAnalytics enriches QoQ and YoY deltas', async () => {
    clientScope.allowedClientIdsForList.mockReturnValue(undefined);
    repo.getThemeQuarterAnalytics
      .mockResolvedValueOnce([
        { quarter: 1, theme_code: 'PRICE', label_vi: 'Giá', insight_count: 2 },
        { quarter: 2, theme_code: 'PRICE', label_vi: 'Giá', insight_count: 4 },
      ])
      .mockResolvedValueOnce([
        { quarter: 2, theme_code: 'PRICE', label_vi: 'Giá', insight_count: 2 },
      ]);

    const out = await service.getThemeQuarterAnalytics({ restricted: false, allowedClientIds: [] }, { year: 2026 });

    expect(out.rows[1]).toMatchObject({
      quarter: 2,
      insight_count: 4,
      prev_qoq_count: 2,
      delta_qoq_pct: 100,
      prev_yoy_count: 2,
      delta_yoy_pct: 100,
    });
    expect(JSON.stringify(out)).not.toContain('title');
  });

  const codebookCsv = [
    'respondent_id,question_code,value,unit,value_base,period_note,geography',
    'R001,Q1,15000,VND,mean,2026-Q1,VN',
    'R002,Q1,18000,VND,mean,2026-Q1,VN',
  ].join('\n');

  function stubSurveyImportWrites(): void {
    stubScopedProject();
    const study = {
      id: 5,
      project_id: 9,
      name: 'Codebook 2026-08-14',
      method: 'survey',
      n: 2,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    };
    const source = {
      id: 20,
      project_id: 9,
      question_id: null,
      source_type: 'web',
      title: study.name,
      publisher: 'Forms',
      url: null,
      published_at: null,
      accessed_at: null,
      geo: null,
      license_note: null,
      reliability_tier: 'medium',
      limitation_note: CODEBOOK_LIMITATION,
      snapshot_uri: null,
      content_hash: null,
      ai_generated: false,
      keep: null,
      triangulated: false,
      single_source_accepted: false,
      superseded_by: null,
      created_at: '2026-08-14',
      updated_at: '2026-08-14',
    };
    repo.createStudy.mockResolvedValue(study);
    repo.getStudy.mockResolvedValue(study);
    repo.createSource.mockResolvedValue(source);
    repo.getSource.mockResolvedValue(source);
    repo.patchStudy.mockResolvedValue(study);
    repo.createEvidence
      .mockResolvedValueOnce(evidenceRow({ id: 101, study_id: 5, source_id: 20, locator: 'Q-Q1' }))
      .mockResolvedValueOnce(evidenceRow({ id: 102, study_id: 5, source_id: 20, locator: 'Q-Q1' }));
  }

  it('M1-2a: codebook 2 rows → 2 evidence; createInsight is not called', async () => {
    stubSurveyImportWrites();

    const out = await service.importSurvey(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { csvText: codebookCsv, format: 'codebook' },
      'am@ptt',
    );

    expect(out).toEqual({
      ok: true,
      study_id: 5,
      source_id: 20,
      evidence_ids: [101, 102],
      n: 2,
    });
    expect(out).not.toHaveProperty('insight_id');
    expect(out).not.toHaveProperty('statement');
    expect(repo.createStudy).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        method: 'survey',
        name: expect.stringMatching(/^Codebook \d{4}-\d{2}-\d{2}$/),
      }),
      'am@ptt',
    );
    expect(repo.createSource).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        publisher: 'Forms',
        title: 'Codebook 2026-08-14',
        reliability_tier: 'medium',
        limitation_note: CODEBOOK_LIMITATION,
        ai_generated: false,
      }),
    );
    expect(repo.createEvidence).toHaveBeenCalledTimes(2);
    expect(repo.createEvidence).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        study_id: 5,
        source_id: 20,
        locator: 'Q-Q1',
        value_num: 15000,
        unit: 'VND',
        value_base: 'mean',
        period_note: '2026-Q1',
        geography: 'VN',
      }),
      'am@ptt',
    );
    expect(repo.patchStudy).toHaveBeenCalledWith(5, { n: 2 });
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('M1-2b: email in CSV → 400 survey_pii_forbidden; 0 evidence', async () => {
    stubSurveyImportWrites();
    const csv = [
      'respondent_id,question_code,value,unit,value_base,period_note,geography',
      'R001,Q1,15000,VND,mean,2026-Q1,analyst@ptt.vn',
    ].join('\n');

    try {
      await service.importSurvey(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { csvText: csv, format: 'codebook' },
        'am@ptt',
      );
      throw new Error('expected survey_pii_forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'survey_pii_forbidden' }),
      );
    }
    expect(repo.createStudy).not.toHaveBeenCalled();
    expect(repo.createSource).not.toHaveBeenCalled();
    expect(repo.createEvidence).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('M1-2c: GET evidence outside scope is 403 without study name', async () => {
    repo.getEvidence.mockResolvedValue(
      evidenceRow({ id: 1, study_id: 4, excerpt: 'quoted line', locator: 'T-00:00' }),
    );
    repo.getStudy.mockResolvedValue({
      id: 4,
      project_id: 9,
      name: 'SecretStudyName',
      method: 'survey',
      n: 8,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    });
    repo.getProjectClientId.mockResolvedValue('other-client');
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    try {
      await service.getEvidence(1, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('SecretStudyName');
      expect(JSON.stringify(body)).not.toContain('name');
    }
    expect(repo.getStudy).not.toHaveBeenCalled();
  });

  it('M1-2d: missing unit on a codebook row → 400; no inserts', async () => {
    stubSurveyImportWrites();
    const csv = [
      'respondent_id,question_code,value,unit,value_base,period_note,geography',
      'R001,Q1,15000,,mean,2026-Q1,VN',
    ].join('\n');

    try {
      await service.importSurvey(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { csvText: csv, format: 'codebook' },
        'am@ptt',
      );
      throw new Error('expected validation_error');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'validation_error' }),
      );
    }
    expect(repo.createStudy).not.toHaveBeenCalled();
    expect(repo.createSource).not.toHaveBeenCalled();
    expect(repo.createEvidence).not.toHaveBeenCalled();
    expect(repo.patchStudy).not.toHaveBeenCalled();
  });

  it('M1 leftover: format=vw 1 respondent → 4 evidence; createInsight is not called', async () => {
    stubSurveyImportWrites();
    repo.createEvidence
      .mockReset()
      .mockResolvedValueOnce(evidenceRow({ id: 201, study_id: 5, source_id: 20, locator: 'R-R001:too_cheap' }))
      .mockResolvedValueOnce(evidenceRow({ id: 202, study_id: 5, source_id: 20, locator: 'R-R001:cheap' }))
      .mockResolvedValueOnce(evidenceRow({ id: 203, study_id: 5, source_id: 20, locator: 'R-R001:expensive' }))
      .mockResolvedValueOnce(evidenceRow({ id: 204, study_id: 5, source_id: 20, locator: 'R-R001:too_expensive' }));
    const csv = ['respondent_id,too_cheap,cheap,expensive,too_expensive', 'R001,10,20,40,50'].join('\n');

    const out = await service.importSurvey(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { csvText: csv, format: 'vw', periodNote: '2026-Q1', geography: 'VN', unit: 'VND' },
      'am@ptt',
    );

    expect(out.evidence_ids).toEqual([201, 202, 203, 204]);
    expect(out.n).toBe(1);
    expect(repo.createEvidence).toHaveBeenCalledTimes(4);
    expect(repo.createEvidence).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        locator: 'R-R001:too_cheap',
        value_num: 10,
        unit: 'VND',
        value_base: 'too_cheap',
        period_note: '2026-Q1',
        geography: 'VN',
      }),
      'am@ptt',
    );
    expect(out).not.toHaveProperty('insight_id');
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('M3-2a: POST van-westendorp on CAT_REVIEW is 400 vw_not_price_offer', async () => {
    stubScopedProject();

    try {
      await service.createVanWestendorp(9, { restricted: true, allowedClientIds: ['acme'] }, {}, 'am@ptt');
      throw new Error('expected vw_not_price_offer');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'vw_not_price_offer' });
    }
    expect(repo.insertVwSummary).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('M3-2b: PRICE_OFFER + 4 respondent evidence persists summary; createInsight is not called', async () => {
    const priceOffer = { ...project, product_type: 'PRICE_OFFER' as const };
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(priceOffer);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.getStudy.mockResolvedValue({
      id: 5,
      project_id: 9,
      name: 'VW study',
      method: 'survey',
      n: 4,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    });
    repo.listEvidence.mockResolvedValue(vwEvidenceFourRespondents());
    const persisted = {
      id: 1,
      project_id: 9,
      study_id: 5,
      unit: 'VND',
      n: 4,
      bins: [],
      points: { pmc: null, pme: null, opp: null, idp: null },
      limitation_note:
        'Van Westendorp trên mẫu convenience — không phải census. Không ghi MOE / 95% confidence.',
      statistical_inference: false as const,
      created_by: 'am@ptt',
      created_at: '2026-08-14',
    };
    repo.insertVwSummary.mockResolvedValue(persisted);

    const out = await service.createVanWestendorp(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { study_id: 5 },
      'am@ptt',
    );

    expect(out.n).toBe(4);
    expect(out.statistical_inference).toBe(false);
    expect(repo.insertVwSummary).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        study_id: 5,
        n: 4,
        statistical_inference: false,
        limitation_note: persisted.limitation_note,
      }),
      'am@ptt',
    );
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('P21-2a: POST conjoint on CAT_REVIEW is 400 cj_not_price_offer', async () => {
    stubScopedProject();

    try {
      await service.createConjoint(9, { restricted: true, allowedClientIds: ['acme'] }, {}, 'am@ptt');
      throw new Error('expected cj_not_price_offer');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'cj_not_price_offer' });
    }
    expect(repo.insertCjSummary).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('P21-2b: PRICE_OFFER + conjoint evidence persists summary; createInsight is not called', async () => {
    const priceOffer = { ...project, product_type: 'PRICE_OFFER' as const };
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(priceOffer);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.getStudy.mockResolvedValue({
      id: 5,
      project_id: 9,
      name: 'CJ study',
      method: 'survey',
      n: 4,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    });
    repo.listEvidence.mockResolvedValue(cjEvidenceForStudy(5));
    const persisted = {
      id: 1,
      project_id: 9,
      study_id: 5,
      n: 4,
      n_choices: 8,
      attributes: [],
      recommendation: { levels: [] },
      limitation_note:
        'Conjoint lite trên mẫu convenience — đếm mức được chọn theo thuộc tính, không mô hình hoá tương tác. Không market simulator. Không ghi MOE / 95% confidence.',
      statistical_inference: false as const,
      created_by: 'am@ptt',
      created_at: '2026-08-15',
    };
    repo.insertCjSummary.mockResolvedValue(persisted);

    const out = await service.createConjoint(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { study_id: 5 },
      'am@ptt',
    );

    expect(out.n).toBe(4);
    expect(out.n_choices).toBe(8);
    expect(out.statistical_inference).toBe(false);
    expect(repo.insertCjSummary).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        study_id: 5,
        n: 4,
        n_choices: 8,
        statistical_inference: false,
      }),
      'am@ptt',
    );
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('P34 what-if on CAT_REVIEW is 400 cj_not_price_offer', async () => {
    stubScopedProject();

    try {
      await service.simulateConjointWhatIf(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { scenario: { price: '99k' } },
      );
      throw new Error('expected cj_not_price_offer');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'cj_not_price_offer' });
    }
    expect(repo.insertCjSummary).not.toHaveBeenCalled();
    expect(repo.insertCjWhatIfRun).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('P34 what-if on PRICE_OFFER counts fixture matches without persist', async () => {
    const priceOffer = { ...project, product_type: 'PRICE_OFFER' as const };
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(priceOffer);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.getStudy.mockResolvedValue({
      id: 5,
      project_id: 9,
      name: 'CJ study',
      method: 'survey',
      n: 4,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    });
    repo.listEvidence.mockResolvedValue(cjEvidenceForStudy(5));

    const out = await service.simulateConjointWhatIf(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { study_id: 5, scenario: { price: '99k', pack_size: '500ml' } },
    );

    expect(out).toMatchObject({
      n_match: 2,
      n_choices: 8,
      match_pct: 25,
      statistical_inference: false,
    });
    expect(repo.insertCjSummary).not.toHaveBeenCalled();
    expect(repo.insertCjWhatIfRun).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('P38 what-if persist inserts run row with run_id', async () => {
    const priceOffer = { ...project, product_type: 'PRICE_OFFER' as const };
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(priceOffer);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.getStudy.mockResolvedValue({
      id: 5,
      project_id: 9,
      name: 'CJ study',
      method: 'survey',
      n: 4,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    });
    repo.listEvidence.mockResolvedValue(cjEvidenceForStudy(5));
    repo.insertCjWhatIfRun.mockResolvedValue({
      id: 12,
      project_id: 9,
      study_id: 5,
      scenario: { price: '99k', pack_size: '500ml' },
      n_match: 2,
      n_choices: 8,
      match_pct: 25,
      limitation_note: 'note',
      statistical_inference: false,
      created_by: 'an@ptt',
      created_at: '2026-08-16T10:00:00.000Z',
    });

    const out = await service.simulateConjointWhatIf(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { study_id: 5, scenario: { price: '99k', pack_size: '500ml' }, persist: true },
      'an@ptt',
    );

    expect(out).toMatchObject({
      n_match: 2,
      n_choices: 8,
      match_pct: 25,
      run_id: 12,
      persisted_at: '2026-08-16T10:00:00.000Z',
    });
    expect(repo.insertCjWhatIfRun).toHaveBeenCalledWith(
      9,
      5,
      expect.objectContaining({ n_match: 2, n_choices: 8 }),
      'an@ptt',
    );
    expect(repo.insertCjSummary).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('P38 listConjointWhatIfRuns returns scoped runs without title', async () => {
    const priceOffer = { ...project, product_type: 'PRICE_OFFER' as const };
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(priceOffer);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.listCjWhatIfRuns.mockResolvedValue([
      {
        id: 12,
        project_id: 9,
        study_id: 5,
        scenario: { price: '99k', pack_size: '500ml' },
        n_match: 2,
        n_choices: 8,
        match_pct: 25,
        limitation_note: 'note',
        statistical_inference: false,
        created_by: 'an@ptt',
        created_at: '2026-08-16T10:00:00.000Z',
      },
    ]);

    const out = await service.listConjointWhatIfRuns(9, {
      restricted: true,
      allowedClientIds: ['acme'],
    });

    expect(out.runs).toHaveLength(1);
    expect(JSON.stringify(out)).not.toContain('Secret title');
    expect(repo.listCjWhatIfRuns).toHaveBeenCalledWith(9);
  });

  it('M3-2c: GET van-westendorp outside scope is 403 without name', async () => {
    repo.getProjectClientId.mockResolvedValue('other-client');
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.getLatestVwSummary.mockResolvedValue({
      id: 1,
      project_id: 9,
      study_id: 4,
      unit: 'VND',
      n: 4,
      bins: [],
      points: { pmc: null, pme: null, opp: null, idp: null },
      limitation_note: 'note',
      statistical_inference: false,
      created_by: 'am@ptt',
      created_at: '2026-08-14',
    });
    repo.getStudy.mockResolvedValue({
      id: 4,
      project_id: 9,
      name: 'SecretStudyName',
      method: 'survey',
      n: 4,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    });

    try {
      await service.getVanWestendorp(9, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('SecretStudyName');
      expect(JSON.stringify(body)).not.toContain('name');
    }
    expect(repo.getLatestVwSummary).not.toHaveBeenCalled();
    expect(repo.getStudy).not.toHaveBeenCalled();
  });

  it('I1: POST {} with two survey studies and colliding R001–R004 uses newest study only', async () => {
    const priceOffer = { ...project, product_type: 'PRICE_OFFER' as const };
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(priceOffer);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    const older = {
      id: 5,
      project_id: 9,
      name: 'VW wave 1',
      method: 'survey' as const,
      n: 4,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    };
    const newest = {
      ...older,
      id: 8,
      name: 'VW wave 2',
    };
    repo.listStudies.mockResolvedValue([older, newest]);
    const olderRespondents = [
      { id: 'R001', too_cheap: 10, cheap: 20, expensive: 40, too_expensive: 50 },
      { id: 'R002', too_cheap: 12, cheap: 22, expensive: 42, too_expensive: 55 },
      { id: 'R003', too_cheap: 8, cheap: 18, expensive: 38, too_expensive: 48 },
      { id: 'R004', too_cheap: 15, cheap: 25, expensive: 45, too_expensive: 60 },
    ];
    const newestRespondents = [
      { id: 'R001', too_cheap: 100, cheap: 200, expensive: 400, too_expensive: 500 },
      { id: 'R002', too_cheap: 110, cheap: 210, expensive: 410, too_expensive: 510 },
      { id: 'R003', too_cheap: 90, cheap: 190, expensive: 390, too_expensive: 490 },
      { id: 'R004', too_cheap: 120, cheap: 220, expensive: 420, too_expensive: 520 },
    ];
    repo.listEvidence.mockResolvedValue([
      ...vwEvidenceForStudy(8, newestRespondents, 'VND', 400),
      ...vwEvidenceForStudy(5, olderRespondents, 'VND', 300),
    ]);
    const expected = computeVanWestendorp(
      newestRespondents.map(({ too_cheap, cheap, expensive, too_expensive }) => ({
        too_cheap,
        cheap,
        expensive,
        too_expensive,
      })),
    );
    const persisted = {
      id: 2,
      project_id: 9,
      study_id: 8,
      unit: 'VND',
      n: 4,
      bins: expected.bins,
      points: expected.points,
      limitation_note: expected.limitation_note,
      statistical_inference: false as const,
      created_by: 'am@ptt',
      created_at: '2026-08-14',
    };
    repo.insertVwSummary.mockResolvedValue(persisted);

    const out = await service.createVanWestendorp(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      {},
      'am@ptt',
    );

    expect(out.n).toBe(4);
    expect(out.study_id).toBe(8);
    expect(repo.insertVwSummary).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        study_id: 8,
        n: 4,
        bins: expected.bins,
        points: expected.points,
      }),
      'am@ptt',
    );
    const inserted = repo.insertVwSummary.mock.calls[0][1] as { bins: Array<{ price: number }> };
    const prices = inserted.bins.map((bin) => bin.price);
    expect(prices.some((price) => price < 90)).toBe(false);
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('I1: mixed units on the scoped study is 400 vw_mixed_unit', async () => {
    const priceOffer = { ...project, product_type: 'PRICE_OFFER' as const };
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(priceOffer);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.getStudy.mockResolvedValue({
      id: 5,
      project_id: 9,
      name: 'VW study',
      method: 'survey',
      n: 4,
      field_start: null,
      field_end: null,
      mode: null,
      instrument_version: null,
      weighting_note: null,
    });
    const mixed = vwEvidenceFourRespondents();
    mixed[0] = { ...mixed[0], unit: 'USD' };
    repo.listEvidence.mockResolvedValue(mixed);

    try {
      await service.createVanWestendorp(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { study_id: 5 },
        'am@ptt',
      );
      throw new Error('expected vw_mixed_unit');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'vw_mixed_unit' });
    }
    expect(repo.insertVwSummary).not.toHaveBeenCalled();
  });

  describe('P13 RAG re-embed backfill', () => {
    const staleRow = {
      insight_id: 42,
      project_id: 9,
      status: 'approved_client_facing',
      statement: 'Giá sữa học đường tăng tại Hà Nội',
      observation: null,
      client_id: 'acme',
      embed_dims: 64,
      embed_model: 'local-hash',
    };

    it('preview rag_reembed_disabled when OpenAI embed flag off', async () => {
      config.researchRagEnabled = true;
      config.researchRagOpenaiEmbedEnabled = false;
      try {
        await service.previewRagReembed({ restricted: false, allowedClientIds: [] }, {});
        throw new Error('expected disabled');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).getResponse()).toEqual({ error: 'rag_reembed_disabled' });
      }
    });

    it('preview returns stale_count for corpus with local-hash embeddings', async () => {
      config.researchRagEnabled = true;
      config.researchRagOpenaiEmbedEnabled = true;
      process.env.OPENAI_API_KEY = 'sk-test';
      clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
      repo.countReembedStale.mockResolvedValue(3);

      const out = await service.previewRagReembed(
        { restricted: true, allowedClientIds: ['acme'] },
        { client_id: 'acme' },
      );

      expect(out.stale_count).toBe(3);
      expect(out.target_dims).toBe(256);
      expect(out.target_model).toBe(OPENAI_EMBED_MODEL);
      delete process.env.OPENAI_API_KEY;
    });

    it('start noop when no stale candidates', async () => {
      config.researchRagEnabled = true;
      config.researchRagOpenaiEmbedEnabled = true;
      process.env.OPENAI_API_KEY = 'sk-test';
      repo.listReembedCandidates.mockResolvedValue([]);

      const out = await service.startRagReembed(
        { restricted: false, allowedClientIds: [] },
        {},
        'lead@ptt',
      );

      expect(out.status).toBe('noop');
      expect(repo.insertAiRun).not.toHaveBeenCalled();
      delete process.env.OPENAI_API_KEY;
    });

    it('start jobs_disabled sync batch upserts OpenAI 256-d and skips PII', async () => {
      config.researchRagEnabled = true;
      config.researchRagOpenaiEmbedEnabled = true;
      process.env.OPENAI_API_KEY = 'sk-test';
      const clean = staleRow;
      const pii = {
        ...staleRow,
        insight_id: 43,
        statement: 'Liên hệ test@example.com',
      };
      repo.listReembedCandidates
        .mockResolvedValueOnce([clean])
        .mockResolvedValueOnce([clean, pii]);
      repo.insertAiRun.mockResolvedValue({ id: 901, status: 'pending' });
      jobQueue.enqueueResearchRagReembedJob.mockResolvedValue(null);
      const vec = embedInsightText(clean.statement, 256);
      (fetchOpenAIEmbedding as jest.Mock).mockResolvedValue({
        embedding: vec,
        model: OPENAI_EMBED_MODEL,
        dims: 256,
      });
      repo.countReembedStale.mockResolvedValue(1);

      const out = await service.startRagReembed(
        { restricted: false, allowedClientIds: [] },
        { limit: 10 },
        'lead@ptt',
      );

      expect(out.status).toBe('succeeded');
      expect(out.note).toBe('jobs_disabled');
      expect(out.processed).toBe(1);
      expect(out.skipped_pii).toBe(1);
      expect(fetchOpenAIEmbedding).toHaveBeenCalledTimes(1);
      expect(repo.upsertInsightEmbedding).toHaveBeenCalledWith(
        expect.objectContaining({ insight_id: 42, embed_dims: 256, embed_model: OPENAI_EMBED_MODEL }),
      );
      expect(repo.createInsight).not.toHaveBeenCalled();
      delete process.env.OPENAI_API_KEY;
    });

    it('start enqueues research_rag_reembed when jobs enabled', async () => {
      config.researchRagEnabled = true;
      config.researchRagOpenaiEmbedEnabled = true;
      process.env.OPENAI_API_KEY = 'sk-test';
      repo.listReembedCandidates.mockResolvedValue([staleRow]);
      repo.insertAiRun.mockResolvedValue({ id: 902, status: 'pending' });
      jobQueue.enqueueResearchRagReembedJob.mockResolvedValue({ id: 'job-reembed' });

      const out = await service.startRagReembed(
        { restricted: false, allowedClientIds: [] },
        {},
        'lead@ptt',
      );

      expect(out.status).toBe('pending');
      expect(out.run_id).toBe(902);
      expect(jobQueue.enqueueResearchRagReembedJob).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 902,
          limit: 50,
          idempotencyKey: 'research_rag_reembed:all:run:902',
        }),
      );
      delete process.env.OPENAI_API_KEY;
    });
  });
});

function vwEvidenceForStudy(
  studyId: number,
  rows: Array<{
    id: string;
    too_cheap: number;
    cheap: number;
    expensive: number;
    too_expensive: number;
  }>,
  unit = 'VND',
  startId = 300,
): ResearchEvidenceRow[] {
  const bases = ['too_cheap', 'cheap', 'expensive', 'too_expensive'] as const;
  const out: ResearchEvidenceRow[] = [];
  let id = startId;
  for (const row of rows) {
    for (const base of bases) {
      out.push(
        evidenceRow({
          id: id++,
          study_id: studyId,
          locator: `R-${row.id}:${base}`,
          value_num: row[base],
          unit,
          value_base: base,
          period_note: '2026-Q1',
          geography: 'VN',
        }),
      );
    }
  }
  return out;
}

function vwEvidenceFourRespondents(): ResearchEvidenceRow[] {
  return vwEvidenceForStudy(5, [
    { id: 'R1', too_cheap: 10, cheap: 20, expensive: 40, too_expensive: 50 },
    { id: 'R2', too_cheap: 12, cheap: 22, expensive: 42, too_expensive: 55 },
    { id: 'R3', too_cheap: 8, cheap: 18, expensive: 38, too_expensive: 48 },
    { id: 'R4', too_cheap: 15, cheap: 25, expensive: 45, too_expensive: 60 },
  ]);
}

function cjEvidenceForStudy(studyId: number, startId = 400): ResearchEvidenceRow[] {
  const fixture = [
    { respondent_id: 'R001', task_id: '1', price: '99k', pack_size: '500ml' },
    { respondent_id: 'R001', task_id: '2', price: '89k', pack_size: '500ml' },
    { respondent_id: 'R002', task_id: '1', price: '99k', pack_size: '1L' },
    { respondent_id: 'R002', task_id: '2', price: '89k', pack_size: '1L' },
    { respondent_id: 'R003', task_id: '1', price: '99k', pack_size: '500ml' },
    { respondent_id: 'R003', task_id: '2', price: '99k', pack_size: '1L' },
    { respondent_id: 'R004', task_id: '1', price: '89k', pack_size: '500ml' },
    { respondent_id: 'R004', task_id: '2', price: '89k', pack_size: '500ml' },
  ];
  const out: ResearchEvidenceRow[] = [];
  let id = startId;
  for (const row of fixture) {
    for (const attr of ['price', 'pack_size'] as const) {
      out.push(
        evidenceRow({
          id: id++,
          study_id: studyId,
          locator: `C-${row.respondent_id}:task-${row.task_id}:${attr}`,
          value_num: 1,
          unit: row[attr],
          value_base: attr,
          period_note: '2026-Q1',
          geography: 'VN',
        }),
      );
    }
  }
  return out;
}

function competitorRow() {
  return {
    id: 4,
    project_id: 9,
    name: 'Vinamilk',
    aliases: [],
    created_by: 'am@ptt',
    created_at: '2026-08-14',
    updated_at: '2026-08-14',
    snapshots: [],
  };
}

function similarwebSource(overrides: { reliability_tier: string }) {
  return {
    id: 11,
    project_id: 9,
    publisher: 'Similarweb',
    url: 'https://www.similarweb.com/website/example',
    reliability_tier: overrides.reliability_tier,
  };
}

function writeTempAudio(ext = '.wav'): string {
  const tempPath = path.join(
    os.tmpdir(),
    `research-whisper-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`,
  );
  fs.writeFileSync(tempPath, Buffer.from('fake-audio'));
  return tempPath;
}

function evidenceRow(overrides: Partial<ResearchEvidenceRow> = {}): ResearchEvidenceRow {
  return {
    id: 3,
    project_id: 9,
    source_id: 1,
    study_id: null,
    question_id: null,
    locator: 'https://example.com#p3',
    excerpt: 'locked excerpt',
    value_num: null,
    unit: null,
    value_base: null,
    period_note: null,
    geography: null,
    captured_at: '2026-08-14',
    pii_class: 'none',
    qc_status: 'pending',
    checksum: null,
    created_by: 'am@ptt',
    superseded_by: null,
    created_at: '2026-08-14',
    ...overrides,
  };
}

const validRubric = { S: 3, F: 3, T: 3, A: 3, R: 3 };

function versionRow(overrides: Partial<ResearchReportVersionRow> = {}): ResearchReportVersionRow {
  return {
    id: 10,
    report_id: 1,
    version: 1,
    content_snapshot: { insight_ids: [7] },
    generated_by: 'am@ptt',
    content_hash: 'abc',
    embargo_until: null,
    expires_at: null,
    portal_visible: false,
    published_by: null,
    published_at: null,
    created_at: '2026-08-14',
    ...overrides,
  };
}

function insightRow(overrides: Partial<ResearchInsightRow> = {}): ResearchInsightRow {
  return {
    id: 7,
    project_id: 9,
    statement: 'Premium SKU tăng share ở MT HCM',
    observation: null,
    interpretation: null,
    implication: null,
    recommendation: null,
    audience: null,
    status: 'draft',
    confidence_rationale: null,
    confidence_json: null,
    ai_generated: false,
    created_by: 'analyst@ptt',
    valid_from: null,
    valid_to: null,
    is_stale: false,
    created_at: '2026-08-14',
    updated_at: '2026-08-14',
    evidence_ids: [],
    ...overrides,
  };
}

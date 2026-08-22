'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AiAgentPipelinePicker } from '@/components/mkt-ai/AiAgentPipelinePicker';
import { AiPlannerKpiDashboard } from '@/components/mkt-ai/AiPlannerKpiDashboard';
import { AiBrandKbPanel } from '@/components/mkt-ai/AiBrandKbPanel';
import { AiBudgetSimulator } from '@/components/mkt-ai/AiBudgetSimulator';
import { AiApplyStepPanel } from '@/components/mkt-ai/AiApplyStepPanel';
import { AiCampaignBuilder } from '@/components/mkt-ai/AiCampaignBuilder';
import { AiContentCalendar } from '@/components/mkt-ai/AiContentCalendar';
import { AiStrategySections } from '@/components/mkt-ai/AiStrategySections';
import { AiStrategyScenarioCompare } from '@/components/mkt-ai/AiStrategyScenarioCompare';
import { AiKpiTreeEditor } from '@/components/mkt-ai/AiKpiTreeEditor';
import { BriefIntakeForm } from '@/components/mkt-ai/BriefIntakeForm';
import { AiJobProgressPanel } from '@/components/mkt-ai/AiJobProgressPanel';
import { AiTmmtGateBanner } from '@/components/mkt-ai/AiTmmtGateBanner';
import { AiGovernanceBanner } from '@/components/mkt-ai/AiGovernanceBanner';
import styles from '@/components/mkt-ai/mkt-ai-planner.module.css';
import {
  canApproveMktAiPlanner,
  canExportMktAiPlanner,
  canGenerateMktAiPlanner,
  type StoredStaffUser,
} from '@/lib/auth';
import {
  fetchMktAiPlannerContext,
  patchMktAiDraft,
  postMktAiCampaignsJob,
  postMktAiContentJob,
  postMktAiJobRetry,
  postMktAiStrategyJob,
  type MktAiBrief,
  type MktAiBudgetScenarioRow,
  type MktAiCitation,
  type MktAiDraft,
  type MktAiPlannerContext,
  type MktAiSectionCommentRow,
  type MktAiStrategyScenarioRow,
} from '@/lib/mkt-ai-planner-api';
import { ApiError } from '@/lib/api';
import { hasStrategyContent } from '@/lib/mkt-ai-draft-fields';
import { buildMktAiGovernanceBannerProps } from '@/lib/mkt-ai-governance';

const STEPS = [
  { id: 'brief', label: 'Brief' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'campaign', label: 'Campaign' },
  { id: 'content', label: 'Content' },
  { id: 'apply', label: 'Apply' },
  { id: 'agents', label: 'Pipeline AI' },
  { id: 'dashboard', label: 'Dashboard' },
] as const;

type StepId = (typeof STEPS)[number]['id'];
type BriefSubId = 'brief' | 'kb';
type CampaignSubId = 'campaign' | 'budget';

interface Props {
  token: string;
  user: StoredStaffUser;
  lifecycleId: number;
  stage: string;
  serviceSlug?: string;
  clientId?: string;
  onOpenTmmtTab?: () => void;
  onApplied?: () => void;
}

function parseStep(raw: string | null): StepId {
  if (
    raw === 'brief' ||
    raw === 'strategy' ||
    raw === 'campaign' ||
    raw === 'content' ||
    raw === 'apply' ||
    raw === 'agents' ||
    raw === 'dashboard'
  ) {
    return raw;
  }
  const n = Number(raw);
  if (n >= 1 && n <= 7) return STEPS[n - 1].id;
  return 'brief';
}

function parseBriefSub(raw: string | null): BriefSubId {
  return raw === 'kb' ? 'kb' : 'brief';
}

function parseCampaignSub(raw: string | null, step: StepId): CampaignSubId {
  if (step !== 'campaign') return 'campaign';
  return raw === 'budget' ? 'budget' : 'campaign';
}

export function MarketingAiPlannerPanel({
  token,
  user,
  lifecycleId,
  stage,
  serviceSlug,
  clientId,
  onOpenTmmtTab,
  onApplied,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ctx, setCtx] = useState<MktAiPlannerContext | null>(null);
  const [briefDraft, setBriefDraft] = useState<MktAiBrief>({});
  const [step, setStep] = useState<StepId>(() => parseStep(searchParams.get('step')));
  const [briefSub, setBriefSub] = useState<BriefSubId>(() => parseBriefSub(searchParams.get('sub')));
  const [campaignSub, setCampaignSub] = useState<CampaignSubId>(() =>
    parseCampaignSub(searchParams.get('sub'), parseStep(searchParams.get('step'))),
  );
  const [documents, setDocuments] = useState<MktAiPlannerContext['documents']>([]);
  const [budgetScenarios, setBudgetScenarios] = useState<MktAiBudgetScenarioRow[]>([]);
  const [strategyScenarios, setStrategyScenarios] = useState<MktAiStrategyScenarioRow[]>([]);
  const [sectionComments, setSectionComments] = useState<MktAiSectionCommentRow[]>([]);
  const [useRag, setUseRag] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [disabledReason, setDisabledReason] = useState('');
  const [contextVersion, setContextVersion] = useState(0);

  const canGenerate = canGenerateMktAiPlanner(user);
  const canExport = canExportMktAiPlanner(user);
  const canApprove = canApproveMktAiPlanner(user);
  const readOnlyStage = !['onboard', 'deliver'].includes(stage);
  const canEdit = canGenerate && !readOnlyStage;

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchMktAiPlannerContext(token, lifecycleId);
      setCtx(data);
      setBriefDraft(data.brief ?? { service_slug: data.service_slug });
      setDocuments(data.documents ?? []);
      setBudgetScenarios(data.budget_scenarios ?? []);
      setStrategyScenarios(data.strategy_scenarios ?? []);
      setSectionComments(data.section_comments ?? []);
      setUseRag(data.rag?.use_rag ?? data.brief?.use_rag !== false);
      setContextVersion((v) => v + 1);
      setDisabledReason('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDisabledReason('Module AI Planner chưa bật cho môi trường này.');
        setCtx(null);
      } else if (err instanceof ApiError && err.status === 403) {
        setDisabledReason('Dịch vụ này chưa nằm trong pilot AI Planner.');
        setCtx(null);
      } else {
        setError(err instanceof Error ? err.message : 'Tải AI Planner thất bại');
      }
    } finally {
      setLoading(false);
    }
  }, [token, lifecycleId]);

  const pollContext = useCallback(async () => {
    try {
      const data = await fetchMktAiPlannerContext(token, lifecycleId);
      setCtx(data);
      setBriefDraft(data.brief ?? { service_slug: data.service_slug });
      setDocuments(data.documents ?? []);
      setBudgetScenarios(data.budget_scenarios ?? []);
      setStrategyScenarios(data.strategy_scenarios ?? []);
      setSectionComments(data.section_comments ?? []);
      setUseRag(data.rag?.use_rag ?? data.brief?.use_rag !== false);
    } catch {
      /* silent poll — avoid VQ-09 flash */
    }
  }, [token, lifecycleId]);

  const hasActiveJobs = useMemo(
    () =>
      (ctx?.jobs ?? []).some((j) => j.status === 'pending' || j.status === 'running'),
    [ctx?.jobs],
  );

  useEffect(() => {
    if (!hasActiveJobs) return;
    const id = window.setInterval(() => {
      void pollContext();
    }, 2000);
    return () => window.clearInterval(id);
  }, [hasActiveJobs, pollContext]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const nextStep = parseStep(searchParams.get('step'));
    setStep(nextStep);
    setBriefSub(parseBriefSub(searchParams.get('sub')));
    setCampaignSub(parseCampaignSub(searchParams.get('sub'), nextStep));
  }, [searchParams]);

  function goToStep(next: StepId) {
    setStep(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'ai-planner');
    params.set('step', next);
    if (next !== 'brief' && next !== 'campaign' && next !== 'dashboard' && next !== 'agents') {
      params.delete('sub');
    }
    if (next === 'dashboard') params.set('sub', 'dashboard');
    if (next === 'agents') params.set('sub', 'agents');
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function goToBriefSub(next: BriefSubId) {
    setBriefSub(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'ai-planner');
    params.set('step', 'brief');
    if (next === 'kb') params.set('sub', 'kb');
    else params.delete('sub');
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function goToCampaignSub(next: CampaignSubId) {
    setCampaignSub(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'ai-planner');
    params.set('step', 'campaign');
    if (next === 'budget') params.set('sub', 'budget');
    else params.delete('sub');
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  async function runJob(
    runner: () => Promise<unknown>,
    successMsg: string,
    nextStep?: StepId,
  ) {
    if (!canEdit) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await runner();
      await reload();
      setMessage(successMsg);
      if (nextStep) goToStep(nextStep);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Job AI thất bại');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const briefValidation = ctx?.brief_validation;
  const quality = ctx?.quality_score;
  const draft = ctx?.draft;
  const hasStrategy = hasStrategyContent(draft?.strategy_framework, draft?.target_market_prof);
  const campaigns = draft?.campaigns_json ?? [];
  const calendar = (draft?.content_json?.calendar as Array<Record<string, string>>) ?? [];
  const ragCitations =
    (draft?.quality_score_json?.rag_citations as Record<string, MktAiCitation[]> | undefined) ??
    {};
  const governanceBanner = useMemo(
    () => buildMktAiGovernanceBannerProps(ctx, { lifecycleId, includeLinks: true }),
    [ctx, lifecycleId],
  );

  function handleDraftPersisted(persisted: MktAiDraft) {
    setCtx((prev) => (prev ? { ...prev, draft: persisted } : prev));
  }

  if (disabledReason) {
    return (
      <div className="card" style={{ padding: '1rem' }}>
        <p className="muted" style={{ margin: 0 }}>{disabledReason}</p>
      </div>
    );
  }

  return (
    <div className={styles.plannerRoot}>
      <p className={styles.mobileWarn}>
        Vui lòng dùng desktop (≥768px) để sinh và apply kế hoạch AI — mobile chỉ xem/review.
      </p>

      {readOnlyStage ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          {['lead', 'consult', 'proposal'].includes(stage)
            ? 'Chưa onboard — chỉ xem. Wizard chỉnh sửa khi stage onboard hoặc deliver.'
            : `Stage ${stage} — chỉ xem. Chỉnh sửa khi onboard hoặc deliver.`}
        </p>
      ) : null}

      {ctx?.flags.stub_mode ? (
        <p
          className="muted"
          style={{
            margin: 0,
            fontSize: '0.85rem',
            padding: '0.5rem 0.75rem',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'rgba(255, 200, 0, 0.06)',
          }}
        >
          Chế độ stub — chưa cấu hình LLM API key. Output rule-based; kiểm tra lại trước khi apply TMMT.
        </p>
      ) : null}

      <AiTmmtGateBanner
        ok={Boolean(ctx?.tmmt_validation.ok)}
        filledCount={ctx?.tmmt_validation.filled_count}
        messages={ctx?.tmmt_validation.messages ?? []}
        onOpenTmmt={onOpenTmmtTab}
      />

      {governanceBanner ? <AiGovernanceBanner {...governanceBanner} sticky /> : null}

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {STEPS.map((s, idx) => {
          const active = step === s.id;
          const done =
            (s.id === 'brief' && briefValidation?.ok) ||
            (s.id === 'strategy' && hasStrategy) ||
            (s.id === 'campaign' && campaigns.length > 0) ||
            (s.id === 'content' && calendar.length > 0) ||
            (s.id === 'apply' && Boolean(ctx?.tmmt_validation.ok)) ||
            (s.id === 'agents' &&
              (ctx?.multi_agent?.rollup_status === 'succeeded' ||
                ctx?.multi_agent?.rollup_status === 'partial')) ||
            (s.id === 'dashboard' && (stage === 'deliver' || stage === 'retain'));
          return (
            <button
              key={s.id}
              type="button"
              className={active ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
              onClick={() => goToStep(s.id)}
            >
              {idx + 1}. {s.label}
              {done ? ' ✓' : ''}
            </button>
          );
        })}
      </div>

      {loading && !ctx ? (
        <div className={styles.skeleton} aria-busy="true" aria-label="Đang tải AI Planner">
          <div className={styles.skeletonBar} style={{ width: '72%' }} />
          <div className={styles.skeletonBar} style={{ width: '55%' }} />
          <div className={styles.skeletonBar} style={{ width: '88%' }} />
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p style={{ color: 'var(--accent)' }}>{message}</p> : null}

      {!loading || ctx ? (
      <div className={styles.layout}>
        <div className={styles.mainCol}>
          {step === 'brief' ? (
            <>
              <div className={styles.kbSubTabs}>
                <button
                  type="button"
                  className={briefSub === 'brief' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                  onClick={() => goToBriefSub('brief')}
                >
                  Brief
                </button>
                <button
                  type="button"
                  className={briefSub === 'kb' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                  onClick={() => goToBriefSub('kb')}
                >
                  Brand KB
                  {(documents ?? []).some((d) => d.status === 'indexed') ? ' ✓' : ''}
                </button>
              </div>
              {briefSub === 'kb' ? (
                <AiBrandKbPanel
                  token={token}
                  lifecycleId={lifecycleId}
                  canEdit={canEdit}
                  ragEnabled={Boolean(ctx?.flags.rag_enabled)}
                  useRag={useRag}
                  documents={documents ?? []}
                  onDocumentsChange={setDocuments}
                  onUseRagChange={(next) => {
                    setUseRag(next);
                    setBriefDraft((prev) => ({ ...prev, use_rag: next }));
                    setCtx((prev) =>
                      prev
                        ? {
                            ...prev,
                            brief: { ...(prev.brief ?? {}), use_rag: next },
                            rag: { ...(prev.rag ?? { indexed_count: 0 }), use_rag: next },
                          }
                        : prev,
                    );
                  }}
                  onError={setError}
                  onMessage={setMessage}
                />
              ) : (
                <BriefIntakeForm
                  token={token}
                  lifecycleId={lifecycleId}
                  brief={briefDraft}
                  onBriefChange={setBriefDraft}
                  briefValidation={briefValidation}
                  prefillSources={ctx?.prefill_sources}
                  serviceSlug={serviceSlug ?? ctx?.service_slug}
                  canEdit={canEdit}
                  paused={busy}
                  resetAutosaveKey={contextVersion}
                  playbooksEnabled={Boolean(ctx?.flags.playbooks_enabled)}
                  playbookContext={ctx?.playbook}
                  briefUploadEnabled={Boolean(ctx?.flags.brief_upload_enabled)}
                  briefReadiness={ctx?.brief_readiness}
                  onPersisted={(out) => {
                    setBriefDraft(out.brief);
                    setCtx((prev) =>
                      prev
                        ? {
                            ...prev,
                            brief: out.brief,
                            brief_validation: out.brief_validation,
                            ...(out.brief_readiness ? { brief_readiness: out.brief_readiness } : {}),
                          }
                        : prev,
                    );
                    setMessage(
                      out.brief_validation.ok
                        ? 'Brief hợp lệ — có thể sinh chiến lược'
                        : 'Đã lưu brief',
                    );
                  }}
                  onSaveError={(msg) => setError(msg)}
                  onContinue={() => goToStep('strategy')}
                />
              )}
            </>
          ) : null}

          {step === 'strategy' && draft ? (
            <>
              <AiStrategySections
                token={token}
                lifecycleId={lifecycleId}
                strategyFramework={draft.strategy_framework ?? {}}
                targetMarketProf={draft.target_market_prof ?? {}}
                swotJson={draft.swot_json ?? {}}
                ragCitations={ragCitations}
                canEdit={canEdit}
                paused={busy}
                resetAutosaveKey={contextVersion}
                briefReady={Boolean(briefValidation?.ok)}
                qualityScore={quality?.score}
                onGenerate={() =>
                  void runJob(
                    () => postMktAiStrategyJob(token, lifecycleId),
                    'Đã sinh chiến lược',
                    'campaign',
                  )
                }
                onRetry={() =>
                  void runJob(() => postMktAiJobRetry(token, lifecycleId, 'strategy'), 'Đã sinh lại chiến lược')
                }
                onDraftPersisted={handleDraftPersisted}
                onSaveError={(msg) => setError(msg)}
                onContinue={() => goToStep('campaign')}
                sectionCommentsEnabled={Boolean(ctx?.flags.section_comments_enabled)}
                sectionComments={sectionComments}
                onSectionCommentAdded={(row) => setSectionComments((prev) => [...prev, row])}
                competitorSnapshotEnabled={Boolean(ctx?.flags.kpi_closed_loop_enabled)}
                competitorSnapshot={draft.competitor_snapshot_json ?? null}
                onCompetitorSnapshotUpdated={(snap) => {
                  void patchMktAiDraft(token, lifecycleId, { competitor_snapshot_json: snap })
                    .then(handleDraftPersisted)
                    .catch((err) =>
                      setError(err instanceof Error ? err.message : 'Lưu competitor snapshot thất bại'),
                    );
                }}
              />
              {ctx?.flags.scenario_compare_enabled ? (
                <AiStrategyScenarioCompare
                  token={token}
                  lifecycleId={lifecycleId}
                  canEdit={canEdit}
                  paused={busy}
                  scenarios={strategyScenarios}
                  onScenariosChange={setStrategyScenarios}
                  onSelected={() => void reload()}
                  onError={(msg) => setError(msg)}
                  onMessage={(msg) => setMessage(msg)}
                />
              ) : null}
              {ctx?.flags.plan_depth_enabled ? (
                <AiKpiTreeEditor
                  token={token}
                  lifecycleId={lifecycleId}
                  kpiTree={draft.kpi_tree_json ?? []}
                  canEdit={canEdit}
                  paused={busy}
                  resetAutosaveKey={contextVersion}
                  onDraftPersisted={handleDraftPersisted}
                  onSaveError={(msg) => setError(msg)}
                />
              ) : null}
            </>
          ) : null}

          {step === 'campaign' && draft ? (
            <>
              <div className={styles.kbSubTabs}>
                <button
                  type="button"
                  className={campaignSub === 'campaign' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                  onClick={() => goToCampaignSub('campaign')}
                >
                  Campaign
                  {campaigns.length > 0 ? ' ✓' : ''}
                </button>
                <button
                  type="button"
                  className={campaignSub === 'budget' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                  onClick={() => goToCampaignSub('budget')}
                >
                  Budget sim
                  {budgetScenarios.some((s) => s.is_selected) ? ' ✓' : ''}
                </button>
              </div>
              {campaignSub === 'budget' ? (
                <AiBudgetSimulator
                  token={token}
                  lifecycleId={lifecycleId}
                  canEdit={canEdit}
                  paused={busy}
                  budgetMonthlyVnd={briefDraft.budget_monthly_vnd ?? ctx?.brief?.budget_monthly_vnd}
                  objective={briefDraft.objective ?? ctx?.brief?.objective ?? 'lead'}
                  scenarios={budgetScenarios}
                  hasCampaigns={campaigns.length > 0}
                  clientId={clientId}
                  onScenariosChange={setBudgetScenarios}
                  onRefresh={reload}
                  onError={setError}
                  onMessage={setMessage}
                />
              ) : (
                <AiCampaignBuilder
                  token={token}
                  lifecycleId={lifecycleId}
                  campaigns={campaigns}
                  canEdit={canEdit}
                  paused={busy}
                  resetAutosaveKey={contextVersion}
                  hasStrategy={hasStrategy}
                  defaultObjective={briefDraft.objective ?? 'lead'}
                  onGenerate={() =>
                    void runJob(
                      () => postMktAiCampaignsJob(token, lifecycleId),
                      'Đã sinh campaign',
                      'content',
                    )
                  }
                  onDraftPersisted={handleDraftPersisted}
                  onSaveError={(msg) => setError(msg)}
                  onContinue={() => goToStep('content')}
                />
              )}
            </>
          ) : null}

          {step === 'content' && draft ? (
            <AiContentCalendar
              token={token}
              lifecycleId={lifecycleId}
              contentJson={draft.content_json ?? {}}
              canEdit={canEdit}
              paused={busy}
              resetAutosaveKey={contextVersion}
              hasCampaigns={campaigns.length > 0}
              onGenerate={() =>
                void runJob(
                  () => postMktAiContentJob(token, lifecycleId),
                  'Đã sinh content',
                  'apply',
                )
              }
              onDraftPersisted={handleDraftPersisted}
              onSaveError={(msg) => setError(msg)}
              onContinue={() => goToStep('apply')}
            />
          ) : null}

          {step === 'apply' && draft ? (
            <AiApplyStepPanel
              token={token}
              lifecycleId={lifecycleId}
              draft={draft}
              quality={quality}
              canEdit={canEdit}
              canExport={canExport}
              canApprove={canApprove}
              exportPptxEnabled={Boolean(ctx?.flags.export_pptx_enabled)}
              approval={ctx?.approval}
              comments={ctx?.comments}
              planVersions={ctx?.plan_versions}
              approvalRequired={ctx?.flags.approval_required}
              paused={busy}
              onOpenTmmtTab={onOpenTmmtTab}
              onApplied={onApplied}
              onQualityUpdated={reload}
              onMessage={setMessage}
              onError={setError}
            />
          ) : null}

          {step === 'agents' ? (
            <AiAgentPipelinePicker
              token={token}
              lifecycleId={lifecycleId}
              serviceSlug={serviceSlug ?? ctx?.service_slug}
              canEdit={canEdit}
              paused={busy}
              briefReady={Boolean(briefValidation?.ok)}
              playbooksEnabled={Boolean(ctx?.flags.playbooks_enabled)}
              playbookContext={ctx?.playbook}
              multiAgent={ctx?.multi_agent}
              onAppliedPlaybook={(out) => {
                setBriefDraft(out.brief);
                setCtx((prev) =>
                  prev
                    ? { ...prev, brief: out.brief, brief_validation: out.brief_validation }
                    : prev,
                );
                setMessage(out.messages.join(' · ') || 'Đã áp dụng playbook');
              }}
              onPipelineFinished={() => void reload()}
              onError={setError}
              onMessage={setMessage}
            />
          ) : null}

          {step === 'dashboard' ? (
            <AiPlannerKpiDashboard
              token={token}
              lifecycleId={lifecycleId}
              stage={stage}
              clientId={clientId}
              canEdit={canEdit}
              closedLoopEnabled={Boolean(ctx?.flags.kpi_closed_loop_enabled)}
            />
          ) : null}
        </div>

        <div className={`${styles.jobCol} ${styles.jobColSticky}`}>
        <AiJobProgressPanel
          jobs={ctx?.jobs ?? []}
          multiAgentStatus={ctx?.multi_agent}
          stubMode={ctx?.flags.stub_mode}
          retrying={busy}
          onRetry={
            canEdit
              ? (type) => void runJob(() => postMktAiJobRetry(token, lifecycleId, type), 'Đã thử lại job')
              : undefined
          }
        />
        </div>
      </div>
      ) : null}
    </div>
  );
}

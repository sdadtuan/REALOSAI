'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
import { EvidenceFormDrawer } from '@/components/research/EvidenceFormDrawer';
import { EvidenceIdChip } from '@/components/research/EvidenceIdChip';
import { InsightCard } from '@/components/research/InsightCard';
import { InsightDrawer } from '@/components/research/InsightDrawer';
import { insightIsStale } from '@/components/research/insight-stale.util';
import { InsightGateDialog } from '@/components/research/InsightGateDialog';
import { DeepResearchModal } from '@/components/research/DeepResearchModal';
import { ResearchJobChip } from '@/components/research/ResearchJobChip';
import { ResearchStatusChip } from '@/components/research/ResearchStatusChip';
import { CompetitorPane } from '@/components/research/CompetitorPane';
import { StudiesPane } from '@/components/research/StudiesPane';
import { DecisionLogPane } from '@/components/research/DecisionLogPane';
import { WavesPane } from '@/components/research/WavesPane';
import { VwPane } from '@/components/research/VwPane';
import { ConjointPane } from '@/components/research/ConjointPane';
import { ResearchIsoGapPanel } from '@/components/research/ResearchIsoGapPanel';
import { shouldShowVwTab } from '@/components/research/vw-pane.util';
import { shouldShowConjointTab } from '@/components/research/conjoint-pane.util';
import { SourceKeepTable } from '@/components/research/SourceKeepTable';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import {
  addResearchQuestion,
  approveResearchInsight,
  approveResearchReportExecEn,
  attachResearchInsightEvidence,
  attachResearchInsightTheme,
  copilotResearchInsight,
  copilotResearchReport,
  createResearchEvidence,
  createResearchReport,
  exportResearchReportVersion,
  fetchResearchReports,
  createResearchInsight,
  createResearchSource,
  deleteResearchQuestion,
  fetchResearchHealth,
  fetchResearchProject,
  fetchResearchStudies,
  runResearchDeep,
  runResearchDesk,
  runResearchPulse,
  runResearchQualtrics,
  runResearchSparktoro,
  runResearchTalkwalker,
  runResearchTriangulate,
  patchResearchEvidence,
  patchResearchInsight,
  patchResearchProject,
  patchResearchQuestion,
  patchResearchSourceKeep,
  PRODUCT_TYPE_CARDS,
  ResearchApiError,
  STATUS_LABELS,
  submitResearchInsightReview,
  supersedeResearchEvidence,
  TRANSITION_REASON_VI,
  verifyResearchEvidence,
  METHODOLOGY_EXPORT_BANNER,
  isMethodologyComplete,
  isMethodologyExportable,
  normalizeReportExec,
  publishResearchReportPortal,
  updateResearchReportEmbargo,
  updateResearchReportExecEn,
  type CreateEvidenceBody,
  type CreateInsightBody,
  type InsightStatus,
  type MethodologyBlock,
  type ProjectStatus,
  type ResearchAiRun,
  type ResearchStudy,
  type ResearchEvidence,
  type ResearchInsight,
  type ResearchProject,
  type ResearchQuestion,
  type ResearchReport,
  type ResearchReportSnapshot,
  type InsightCopilotRagHit,
  type ResearchSource,
} from '@/lib/market-research-api';
import { isMarketResearchFeEnabled } from '@/lib/market-research-flags';
import {
  STAFF_REPORT_STALE_ONLY_EMPTY,
  STAFF_REPORT_STALE_ONLY_LABEL,
  countStaffReportVersionsWithStaleInsights,
  filterStaffReportVersionsByStale,
} from '@/lib/staff-report-list.util';
import { staffReportVersionHasStaleInsights } from '@/lib/staff-report-stale.util';
import {
  SPARKTORO_SOURCES_BANNER,
  shouldShowSparktoroButton,
} from '@/components/research/sources-sparktoro.util';
import {
  TALKWALKER_DISABLED_TITLE,
  TALKWALKER_SOURCES_BANNER,
  shouldShowTalkwalkerButton,
} from '@/components/research/sources-talkwalker.util';
import { shouldShowQualtricsButton } from '@/components/research/qualtrics-stub.util';
import {
  qualtricsRunDisabled,
  qualtricsRunnableStudies,
} from '@/components/research/qualtrics-run.util';
import { InsightsRagSearch } from '@/components/research/InsightsRagSearch';
import { ReportPublishedValidToList } from '@/components/research/ReportPublishedValidToList';
import { ReportStaleInsightList } from '@/components/research/ReportStaleInsightList';
import { StaffReportVersionStaleBadge } from '@/components/research/StaffReportVersionStaleBadge';
import {
  RAG_COPILOT_BANNER,
  shouldShowRagCopilotBanner,
} from '@/components/research/insight-copilot-rag.util';

const TABS = [
  { id: 'brief', label: 'Brief' },
  { id: 'sources', label: 'Nguồn' },
  { id: 'competitors', label: 'Đối thủ' },
  { id: 'studies', label: 'Studies' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'insights', label: 'Insight' },
  { id: 'report', label: 'Báo cáo' },
  { id: 'decisions', label: 'Quyết định' },
  { id: 'governance', label: 'ISO gap' },
  { id: 'activity', label: 'Nhật ký' },
] as const;

export default function CrmResearchWorkspacePage() {
  return (
    <Suspense fallback={<p className="muted">Đang tải…</p>}>
      <CrmResearchWorkspaceContent />
    </Suspense>
  );
}

function CrmResearchWorkspaceContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = Number(params.id);
  const tab = searchParams.get('tab') || 'brief';
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [project, setProject] = useState<ResearchProject | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [newRq, setNewRq] = useState('');
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'supersede'>('create');
  const [drawerSource, setDrawerSource] = useState<ResearchSource | null>(null);
  const [drawerEvidence, setDrawerEvidence] = useState<ResearchEvidence | null>(null);
  const [piiWarning, setPiiWarning] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);
  const [activeInsight, setActiveInsight] = useState<ResearchInsight | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateMessages, setGateMessages] = useState<string[]>([]);
  const [deskQuestionId, setDeskQuestionId] = useState<number | null>(null);
  const [deskRunId, setDeskRunId] = useState<number | null>(null);
  const [deskBanner, setDeskBanner] = useState('');
  const [deepProvider, setDeepProvider] = useState<string>('off');
  const [deepOpen, setDeepOpen] = useState(false);
  const [deepRunId, setDeepRunId] = useState<number | null>(null);
  const [deepBanner, setDeepBanner] = useState('');
  const [triRunId, setTriRunId] = useState<number | null>(null);
  const [triBanner, setTriBanner] = useState('');
  const [pulseRunId, setPulseRunId] = useState<number | null>(null);
  const [pulseBanner, setPulseBanner] = useState('');
  const [sparktoroEnabled, setSparktoroEnabled] = useState(false);
  const [talkwalkerEnabled, setTalkwalkerEnabled] = useState(false);
  const [qualtricsEnabled, setQualtricsEnabled] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [copilotRagHits, setCopilotRagHits] = useState<InsightCopilotRagHit[]>([]);
  const [sparktoroRunId, setSparktoroRunId] = useState<number | null>(null);
  const [sparktoroBanner, setSparktoroBanner] = useState('');
  const [talkwalkerRunId, setTalkwalkerRunId] = useState<number | null>(null);
  const [talkwalkerBanner, setTalkwalkerBanner] = useState('');
  const [qualtricsStudies, setQualtricsStudies] = useState<ResearchStudy[]>([]);
  const [qualtricsStudyId, setQualtricsStudyId] = useState<number | null>(null);
  const [qualtricsRunId, setQualtricsRunId] = useState<number | null>(null);
  const [qualtricsBanner, setQualtricsBanner] = useState('');
  const [reportSnapshot, setReportSnapshot] = useState<ResearchReportSnapshot | null>(null);
  const [reports, setReports] = useState<ResearchReport[]>([]);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_research', 'view')) {
        setError('Không có quyền xem nghiên cứu thị trường');
        return null;
      }
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  const load = useCallback(
    async (access: string) => {
      const data = await fetchResearchProject(access, id);
      setProject(data);
      try {
        const listed = await fetchResearchReports(access, id);
        setReports(listed.reports);
      } catch {
        setReports([]);
      }
      if (data.deep_research_provider) {
        setDeepProvider(data.deep_research_provider);
      }
      try {
        const health = await fetchResearchHealth(access);
        setSparktoroEnabled(health.sparktoro_enabled === true);
        setTalkwalkerEnabled(health.talkwalker_enabled === true);
        setQualtricsEnabled(health.qualtrics_enabled === true);
        setRagEnabled(health.rag_enabled === true);
        if (!data.deep_research_provider) {
          setDeepProvider(health.deep_provider);
        }
      } catch {
        setSparktoroEnabled(false);
        setTalkwalkerEnabled(false);
        setQualtricsEnabled(false);
        setRagEnabled(false);
        if (!data.deep_research_provider) {
          setDeepProvider('off');
        }
      }
    },
    [id],
  );

  useEffect(() => {
    setCopilotRagHits([]);
  }, [id]);

  useEffect(() => {
    const access = getAccessToken();
    if (!access || !qualtricsEnabled || !project) {
      setQualtricsStudies([]);
      setQualtricsStudyId(null);
      return;
    }
    void fetchResearchStudies(access, project.id)
      .then((out) => {
        const runnable = qualtricsRunnableStudies(out.studies);
        setQualtricsStudies(runnable);
        setQualtricsStudyId((prev) =>
          prev != null && runnable.some((row) => row.id === prev) ? prev : (runnable[0]?.id ?? null),
        );
      })
      .catch(() => {
        setQualtricsStudies([]);
        setQualtricsStudyId(null);
      });
  }, [id, project, qualtricsEnabled]);

  useEffect(() => {
    void (async () => {
      if (!isMarketResearchFeEnabled()) {
        setUser(getStoredUser());
        return;
      }
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      setError('');
      try {
        await load(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải dự án thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, load]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  async function onStatus(next: ProjectStatus) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      const updated = await patchResearchProject(access, project.id, { status: next });
      setProject(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đổi trạng thái thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onAddRq() {
    const access = getAccessToken();
    if (!access || !project || !newRq.trim()) return;
    setSaving(true);
    setError('');
    try {
      await addResearchQuestion(access, project.id, { question_vi: newRq.trim() });
      setNewRq('');
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm câu hỏi thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onPatchRq(q: ResearchQuestion, question_vi: string) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      await patchResearchQuestion(access, q.id, { question_vi });
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sửa câu hỏi thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteRq(q: ResearchQuestion) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      await deleteResearchQuestion(access, q.id);
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xoá câu hỏi thất bại');
    } finally {
      setSaving(false);
    }
  }

  function openCreateEvidence(source?: ResearchSource | null) {
    setDrawerMode('create');
    setDrawerSource(source ?? null);
    setDrawerEvidence(null);
    setPiiWarning(false);
    setDrawerOpen(true);
  }

  function openEditEvidence(ev: ResearchEvidence) {
    const src = (project?.sources ?? []).find((s) => s.id === ev.source_id) ?? null;
    setDrawerMode('edit');
    setDrawerSource(src);
    setDrawerEvidence(ev);
    setPiiWarning(Boolean(ev.pii_warning));
    setDrawerOpen(true);
  }

  function openSupersede(ev: ResearchEvidence) {
    const src = (project?.sources ?? []).find((s) => s.id === ev.source_id) ?? null;
    setDrawerMode('supersede');
    setDrawerSource(src);
    setDrawerEvidence(ev);
    setPiiWarning(false);
    setDrawerOpen(true);
  }

  async function onKeepSource(source: ResearchSource, keep: boolean) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      await patchResearchSourceKeep(access, source.id, keep);
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật keep thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onCreateManual(input: {
    title: string;
    url?: string;
    publisher?: string;
    question_id?: number | null;
  }) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      await createResearchSource(access, project.id, input);
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm nguồn thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveEvidence(body: CreateEvidenceBody) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      if (drawerMode === 'supersede' && drawerEvidence) {
        const out = await supersedeResearchEvidence(access, drawerEvidence.id, body);
        setPiiWarning(Boolean(out.evidence.pii_warning));
      } else if (drawerMode === 'edit' && drawerEvidence) {
        const out = await patchResearchEvidence(access, drawerEvidence.id, body);
        setPiiWarning(Boolean(out.pii_warning));
      } else {
        const out = await createResearchEvidence(access, project.id, body);
        setPiiWarning(Boolean(out.pii_warning));
      }
      await load(access);
      setDrawerOpen(false);
    } catch (err) {
      const api = err instanceof ResearchApiError ? err : null;
      if (api?.code === 'raw_transcript_forbidden') {
        setError('Không lưu transcript thô — excerpt tối đa 500 ký tự.');
      } else if (api?.code === 'invalid_transcript_locator') {
        setError('Locator study phải dạng T-12:03 hoặc URL#t=.');
      } else {
        setError(err instanceof Error ? err.message : 'Lưu evidence thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  function openGate(err: unknown): boolean {
    if (!(err instanceof ResearchApiError)) return false;
    if (err.code === 'insight_gate') {
      setGateMessages(err.messages?.length ? err.messages : ['insight_gate']);
      setGateOpen(true);
      return true;
    }
    if (err.code === 'cannot_self_approve') {
      setGateMessages(['cannot_self_approve']);
      setGateOpen(true);
      return true;
    }
    return false;
  }

  function isInsightCreator(insight: ResearchInsight | null): boolean {
    const email = user?.email?.trim().toLowerCase();
    if (!email) return false;
    if (!insight?.created_by) return true;
    return insight.created_by.trim().toLowerCase() === email;
  }

  async function persistInsight(body: CreateInsightBody, evidenceIds: number[]): Promise<ResearchInsight | null> {
    const access = getAccessToken();
    if (!access || !project) return null;
    const saved = activeInsight
      ? await patchResearchInsight(access, activeInsight.id, body)
      : await createResearchInsight(access, project.id, body);
    const attached = await attachResearchInsightEvidence(access, saved.id, evidenceIds);
    setActiveInsight(attached);
    await load(access);
    return attached;
  }

  async function onSaveInsight(body: CreateInsightBody, evidenceIds: number[]) {
    setSaving(true);
    setError('');
    try {
      await persistInsight(body, evidenceIds);
    } catch (err) {
      if (!openGate(err)) setError(err instanceof Error ? err.message : 'Lưu insight thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onAttachInsightTheme(taxonomyId: number) {
    const access = getAccessToken();
    if (!access || !activeInsight) return;
    setSaving(true);
    setError('');
    try {
      const updated = await attachResearchInsightTheme(access, activeInsight.id, taxonomyId);
      setActiveInsight({ ...activeInsight, statement: updated.statement });
      await load(access);
    } catch (err) {
      if (!openGate(err)) setError(err instanceof Error ? err.message : 'Gắn theme thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitInsight(insight: ResearchInsight, body?: CreateInsightBody, evidenceIds?: number[]) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      let target = insight;
      if (body) {
        const saved = await persistInsight(body, evidenceIds ?? insight.evidence_ids);
        if (!saved) return;
        target = saved;
      }
      await submitResearchInsightReview(
        access,
        target.id,
        body
          ? {
              confidence_json: body.confidence_json,
              confidence_rationale: body.confidence_rationale,
            }
          : undefined,
      );
      await load(access);
      setInsightOpen(false);
    } catch (err) {
      if (!openGate(err)) setError(err instanceof Error ? err.message : 'Gửi duyệt thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onApproveInsight(target: Extract<InsightStatus, 'approved_internal' | 'approved_client_facing'>) {
    const access = getAccessToken();
    if (!access || !activeInsight) return;
    setSaving(true);
    setError('');
    try {
      await approveResearchInsight(access, activeInsight.id, { target_status: target });
      await load(access);
      setInsightOpen(false);
    } catch (err) {
      if (!openGate(err)) setError(err instanceof Error ? err.message : 'Duyệt insight thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onInsightCopilot(evidenceIds: number[]) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      const out = await copilotResearchInsight(access, project.id, evidenceIds);
      setCopilotRagHits(out.rag_hits ?? []);
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gợi ý insight thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onCreateReport(insightIds: number[], methodology?: MethodologyBlock) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      const out = await createResearchReport(access, project.id, insightIds, methodology);
      setReportSnapshot(out.content_snapshot);
      await load(access);
    } catch (err) {
      if (err instanceof ResearchApiError && err.code === 'methodology_incomplete') {
        setError(TRANSITION_REASON_VI.methodology_incomplete);
      } else {
        setError(err instanceof Error ? err.message : 'Tạo phiên bản báo cáo thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onExportReport(reportId: number, versionId: number, format: 'docx' | 'pdf' = 'docx') {
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    try {
      const { blob, filename } = await exportResearchReportVersion(access, reportId, versionId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof ResearchApiError && err.code === 'methodology_incomplete') {
        setError(TRANSITION_REASON_VI.methodology_incomplete);
      } else {
        setError(err instanceof Error ? err.message : format === 'pdf' ? 'Xuất PDF thất bại' : 'Xuất DOCX thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onReportCopilot(insightIds: number[]) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      const out = await copilotResearchReport(access, project.id, insightIds);
      setReportSnapshot(out.content_snapshot);
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gợi ý dàn báo cáo thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveExecEn(reportId: number, versionId: number, en: string) {
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    try {
      const out = await updateResearchReportExecEn(access, reportId, versionId, en);
      setReportSnapshot(out.content_snapshot);
      await load(access);
    } catch (err) {
      if (err instanceof ResearchApiError && err.code && TRANSITION_REASON_VI[err.code]) {
        setError(TRANSITION_REASON_VI[err.code]);
      } else {
        setError(err instanceof Error ? err.message : 'Lưu bản dịch thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onApproveExecEn(reportId: number, versionId: number) {
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    try {
      const out = await approveResearchReportExecEn(access, reportId, versionId);
      setReportSnapshot(out.content_snapshot);
      await load(access);
    } catch (err) {
      if (err instanceof ResearchApiError && err.code && TRANSITION_REASON_VI[err.code]) {
        setError(TRANSITION_REASON_VI[err.code]);
      } else {
        setError(err instanceof Error ? err.message : 'Duyệt bản dịch thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onSaveEmbargo(
    reportId: number,
    versionId: number,
    body: { embargo_until?: string | null; expires_at?: string | null },
  ) {
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    try {
      await updateResearchReportEmbargo(access, reportId, versionId, body);
      await load(access);
    } catch (err) {
      if (err instanceof ResearchApiError && err.code && TRANSITION_REASON_VI[err.code]) {
        setError(TRANSITION_REASON_VI[err.code]);
      } else {
        setError(err instanceof Error ? err.message : 'Lưu hạn công bố thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onPublishPortal(reportId: number, versionId: number, visible: boolean) {
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    try {
      await publishResearchReportPortal(access, reportId, versionId, visible);
      await load(access);
    } catch (err) {
      if (err instanceof ResearchApiError && err.code === 'cannot_self_approve') {
        setGateMessages(['cannot_self_approve']);
        setGateOpen(true);
      } else if (err instanceof ResearchApiError && err.code && TRANSITION_REASON_VI[err.code]) {
        setError(TRANSITION_REASON_VI[err.code]);
      } else {
        setError(err instanceof Error ? err.message : 'Công bố portal thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onVerifyEvidence(ev: ResearchEvidence) {
    const access = getAccessToken();
    if (!access || !project) return;
    setSaving(true);
    setError('');
    try {
      await verifyResearchEvidence(access, ev.id);
      await load(access);
      setDrawerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verify thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onRunDesk(questionId?: number | null) {
    const access = getAccessToken();
    const qid = questionId ?? deskQuestionId ?? project?.questions?.[0]?.id;
    if (!access || !project || !qid) return;
    setSaving(true);
    setError('');
    setDeskBanner('');
    try {
      const out = await runResearchDesk(access, project.id, qid);
      setDeskQuestionId(qid);
      setDeskRunId(out.run_id);
      if (out.status === 'failed') {
        const note = out.note ?? 'jobs_disabled';
        setDeskBanner(TRANSITION_REASON_VI[note] ?? note);
      }
    } catch (err) {
      if (err instanceof ResearchApiError && err.code === 'job_in_flight') {
        setError(TRANSITION_REASON_VI.job_in_flight);
      } else {
        setError(err instanceof Error ? err.message : 'Chạy Desk thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onRunDeep() {
    const access = getAccessToken();
    const qid = deskQuestionId ?? project?.questions?.[0]?.id;
    if (!access || !project || !qid) return;
    setSaving(true);
    setError('');
    setDeepBanner('');
    try {
      const out = await runResearchDeep(access, project.id, qid);
      setDeskQuestionId(qid);
      setDeepRunId(out.run_id);
      setDeepOpen(false);
      if (out.status === 'failed') {
        const note = out.note ?? 'jobs_disabled';
        setDeepBanner(TRANSITION_REASON_VI[note] ?? note);
      }
    } catch (err) {
      if (err instanceof ResearchApiError && err.code === 'job_in_flight') {
        setError(TRANSITION_REASON_VI.job_in_flight);
      } else if (err instanceof ResearchApiError && err.code === 'deep_research_disabled') {
        setError(TRANSITION_REASON_VI.deep_research_disabled);
        setDeepOpen(false);
      } else {
        setError(err instanceof Error ? err.message : 'Chạy Deep Research thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onRunPulse() {
    const access = getAccessToken();
    const qid = deskQuestionId ?? project?.questions?.[0]?.id;
    if (!access || !project) return;
    setSaving(true);
    setError('');
    setPulseBanner('');
    try {
      const out = await runResearchPulse(access, project.id, qid);
      if (qid) setDeskQuestionId(qid);
      setPulseRunId(out.run_id);
      if (out.status === 'failed') {
        const note = out.note ?? 'jobs_disabled';
        setPulseBanner(TRANSITION_REASON_VI[note] ?? note);
      }
    } catch (err) {
      if (err instanceof ResearchApiError && err.code === 'job_in_flight') {
        setError(TRANSITION_REASON_VI.job_in_flight);
      } else {
        setError(err instanceof Error ? err.message : 'Chạy pulse thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onRunTriangulate() {
    const access = getAccessToken();
    const qid = deskQuestionId ?? project?.questions?.[0]?.id;
    if (!access || !project || !qid) return;
    setSaving(true);
    setError('');
    setTriBanner('');
    try {
      const out = await runResearchTriangulate(access, project.id, qid);
      setDeskQuestionId(qid);
      setTriRunId(out.run_id);
      if (out.status === 'failed') {
        const note = out.note ?? 'jobs_disabled';
        setTriBanner(TRANSITION_REASON_VI[note] ?? note);
      }
    } catch (err) {
      if (err instanceof ResearchApiError && err.code === 'job_in_flight') {
        setError(TRANSITION_REASON_VI.job_in_flight);
      } else {
        setError(err instanceof Error ? err.message : 'Chạy Tam giác nguồn thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onPulseSettled(run: ResearchAiRun) {
    const access = getAccessToken();
    if (run.status === 'failed') {
      const code = run.error_message ?? 'failed';
      setPulseBanner(TRANSITION_REASON_VI[code] ?? code);
    } else {
      setPulseBanner('');
      setPulseRunId(null);
    }
    if (access) {
      try {
        await load(access);
      } catch {
        /* keep chip state */
      }
    }
  }

  async function onRunSparktoro() {
    const access = getAccessToken();
    const qid = deskQuestionId ?? project?.questions?.[0]?.id;
    if (!access || !project || !qid) return;
    setSaving(true);
    setError('');
    setSparktoroBanner('');
    try {
      const out = await runResearchSparktoro(access, project.id, qid);
      setDeskQuestionId(qid);
      if (out.note === 'sparktoro_disabled') {
        setSparktoroBanner(TRANSITION_REASON_VI.sparktoro_disabled);
        return;
      }
      if (out.run_id) setSparktoroRunId(out.run_id);
      if (out.status === 'failed') {
        const note = out.note ?? 'jobs_disabled';
        setSparktoroBanner(TRANSITION_REASON_VI[note] ?? note);
      }
    } catch (err) {
      if (err instanceof ResearchApiError && err.code === 'job_in_flight') {
        setError(TRANSITION_REASON_VI.job_in_flight);
      } else {
        setError(err instanceof Error ? err.message : 'Chạy SparkToro thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onRunTalkwalker() {
    const access = getAccessToken();
    const qid = deskQuestionId ?? project?.questions?.[0]?.id;
    if (!access || !project || !qid) return;
    setSaving(true);
    setError('');
    setTalkwalkerBanner('');
    try {
      const out = await runResearchTalkwalker(access, project.id, qid);
      setDeskQuestionId(qid);
      if (out.note === 'talkwalker_disabled') {
        setTalkwalkerBanner(TRANSITION_REASON_VI.talkwalker_disabled);
        return;
      }
      if (out.run_id) setTalkwalkerRunId(out.run_id);
      if (out.status === 'failed') {
        const note = out.note ?? 'jobs_disabled';
        setTalkwalkerBanner(TRANSITION_REASON_VI[note] ?? note);
      }
    } catch (err) {
      if (err instanceof ResearchApiError && err.code === 'job_in_flight') {
        setError(TRANSITION_REASON_VI.job_in_flight);
      } else {
        setError(err instanceof Error ? err.message : 'Chạy Talkwalker thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onRunQualtrics() {
    const access = getAccessToken();
    if (!access || !project || qualtricsStudyId == null) return;
    setSaving(true);
    setError('');
    setQualtricsBanner('');
    try {
      const out = await runResearchQualtrics(access, project.id, { study_id: qualtricsStudyId });
      if (out.note === 'qualtrics_disabled') {
        setQualtricsBanner(TRANSITION_REASON_VI.qualtrics_disabled);
        return;
      }
      if (out.run_id) setQualtricsRunId(out.run_id);
      if (out.status === 'failed') {
        const note = out.note ?? 'jobs_disabled';
        setQualtricsBanner(TRANSITION_REASON_VI[note] ?? note);
      }
    } catch (err) {
      if (err instanceof ResearchApiError && err.code === 'job_in_flight') {
        setError(TRANSITION_REASON_VI.job_in_flight);
      } else {
        setError(err instanceof Error ? err.message : 'Chạy Qualtrics thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onQualtricsSettled(run: ResearchAiRun) {
    const access = getAccessToken();
    if (run.status === 'failed') {
      const code = run.error_message ?? 'failed';
      setQualtricsBanner(TRANSITION_REASON_VI[code] ?? code);
    } else {
      setQualtricsBanner('');
      setQualtricsRunId(null);
    }
    if (access) {
      try {
        await load(access);
      } catch {
        /* keep chip state */
      }
    }
  }

  async function onSparktoroSettled(run: ResearchAiRun) {
    const access = getAccessToken();
    if (run.status === 'failed') {
      const code = run.error_message ?? 'failed';
      setSparktoroBanner(TRANSITION_REASON_VI[code] ?? code);
    } else {
      setSparktoroBanner('');
      setSparktoroRunId(null);
    }
    if (access) {
      try {
        await load(access);
      } catch {
        /* keep chip state */
      }
    }
  }

  async function onTalkwalkerSettled(run: ResearchAiRun) {
    const access = getAccessToken();
    if (run.status === 'failed') {
      const code = run.error_message ?? 'failed';
      setTalkwalkerBanner(TRANSITION_REASON_VI[code] ?? code);
    } else {
      setTalkwalkerBanner('');
      setTalkwalkerRunId(null);
    }
    if (access) {
      try {
        await load(access);
      } catch {
        /* keep chip state */
      }
    }
  }

  async function onTriSettled(run: ResearchAiRun) {
    const access = getAccessToken();
    if (run.status === 'failed') {
      const code = run.error_message ?? 'failed';
      setTriBanner(TRANSITION_REASON_VI[code] ?? code);
    } else {
      setTriBanner('');
      setTriRunId(null);
    }
    if (access) {
      try {
        await load(access);
      } catch {
        /* keep chip state */
      }
    }
  }

  async function onDeepSettled(run: ResearchAiRun) {
    const access = getAccessToken();
    if (run.status === 'failed') {
      const code = run.error_message ?? 'failed';
      setDeepBanner(TRANSITION_REASON_VI[code] ?? code);
    } else {
      setDeepBanner('');
      setDeepRunId(null);
    }
    if (access) {
      try {
        await load(access);
      } catch {
        /* keep chip state */
      }
    }
  }

  async function onDeskSettled(run: ResearchAiRun) {
    const access = getAccessToken();
    if (run.status === 'failed') {
      const code = run.error_message ?? 'failed';
      setDeskBanner(TRANSITION_REASON_VI[code] ?? code);
    } else {
      setDeskBanner('');
      setDeskRunId(null);
    }
    if (access) {
      try {
        await load(access);
      } catch {
        /* keep chip state */
      }
    }
  }

  if (!isMarketResearchFeEnabled()) {
    const body = (
      <div className="page-card">
        <p>Module nghiên cứu thị trường chưa bật.</p>
      </div>
    );
    if (!user) return body;
    return (
      <StaffPageShell user={user} onLogout={logout}>
        {body}
      </StaffPageShell>
    );
  }

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  const typeLabel = PRODUCT_TYPE_CARDS.find((c) => c.type === project?.product_type)?.label;
  const canEdit = hasCap(user, 'crm_research', 'edit');
  const canApprove = hasCap(user, 'crm_research', 'approve');
  const canRun = hasCap(user, 'crm_research', 'run');
  const canExport = hasCap(user, 'crm_research', 'export');

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { href: '/crm/research', label: 'Nghiên cứu thị trường' },
        { href: `/crm/research/${id}`, label: project?.title ?? `#${id}` },
      ]}
    >
      <div className="page-card stack-gap">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {project ? (
          <>
            <header>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.25rem' }}>
                  {project.client_name || project.client_id} · {project.title}
                </h1>
                {canEdit ? (
                  <label>
                    Đổi trạng thái
                    <select
                      className="kpi-input"
                      value={project.status}
                      disabled={saving}
                      onChange={(e) => void onStatus(e.target.value as ProjectStatus)}
                      style={{ display: 'block', marginTop: 4 }}
                    >
                      <option value={project.status}>{STATUS_LABELS[project.status]}</option>
                      {(project.valid_transitions ?? []).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <ResearchStatusChip status={project.status} />
                )}
              </div>
              <p className="muted" style={{ margin: '0.35rem 0 0' }}>
                {typeLabel ?? project.product_type} · DV12 {project.dv12_tier} · {project.geo.join(', ')} · Rủi
                ro: {project.risk_class}
              </p>
              <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                Trạng thái: {STATUS_LABELS[project.status]} · Owner: {project.created_by ?? '—'}
              </p>
            </header>
            <nav style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', borderBottom: '1px solid #d8e0d8' }}>
              {[
                ...TABS,
                ...(project.product_type === 'TRACKER' ? ([{ id: 'waves', label: 'Waves' }] as const) : []),
                ...(shouldShowVwTab(project.product_type) ? ([{ id: 'vw', label: 'Giá VW' }] as const) : []),
                ...(shouldShowConjointTab(project.product_type)
                  ? ([{ id: 'conjoint', label: 'Conjoint' }] as const)
                  : []),
              ].map((t) => (
                <Link
                  key={t.id}
                  href={`/crm/research/${id}?tab=${t.id}`}
                  className="nav-link"
                  style={{
                    paddingBottom: 8,
                    borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                    fontWeight: tab === t.id ? 700 : 400,
                  }}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
            {tab === 'brief' ? (
              <BriefTab
                project={project}
                canEdit={canEdit}
                newRq={newRq}
                setNewRq={setNewRq}
                saving={saving}
                onAddRq={() => void onAddRq()}
                onPatchRq={onPatchRq}
                onDeleteRq={onDeleteRq}
              />
            ) : tab === 'sources' ? (
              <section className="card" style={{ padding: '0.9rem' }}>
                <SourcesDeskBar
                  project={project}
                  canRun={canRun}
                  saving={saving}
                  questionId={deskQuestionId ?? project.questions?.[0]?.id ?? null}
                  runId={deskRunId}
                  banner={deskBanner}
                  deepProvider={deepProvider}
                  deepRunId={deepRunId}
                  deepBanner={deepBanner}
                  triRunId={triRunId}
                  triBanner={triBanner}
                  pulseRunId={pulseRunId}
                  pulseBanner={pulseBanner}
                  sparktoroEnabled={sparktoroEnabled}
                  sparktoroRunId={sparktoroRunId}
                  sparktoroBanner={sparktoroBanner}
                  talkwalkerEnabled={talkwalkerEnabled}
                  talkwalkerRunId={talkwalkerRunId}
                  talkwalkerBanner={talkwalkerBanner}
                  qualtricsEnabled={qualtricsEnabled}
                  qualtricsStudies={qualtricsStudies}
                  qualtricsStudyId={qualtricsStudyId}
                  qualtricsRunId={qualtricsRunId}
                  qualtricsBanner={qualtricsBanner}
                  onQuestionChange={setDeskQuestionId}
                  onRun={() => void onRunDesk()}
                  onRetry={() => void onRunDesk(deskQuestionId ?? project.questions?.[0]?.id)}
                  onSettled={onDeskSettled}
                  onOpenDeep={() => setDeepOpen(true)}
                  onDeepSettled={onDeepSettled}
                  onRunTriangulate={() => void onRunTriangulate()}
                  onTriSettled={onTriSettled}
                  onRunPulse={() => void onRunPulse()}
                  onPulseSettled={onPulseSettled}
                  onRunSparktoro={() => void onRunSparktoro()}
                  onSparktoroSettled={onSparktoroSettled}
                  onRunTalkwalker={() => void onRunTalkwalker()}
                  onTalkwalkerSettled={onTalkwalkerSettled}
                  onRunQualtrics={() => void onRunQualtrics()}
                  onQualtricsSettled={onQualtricsSettled}
                  onQualtricsStudyChange={setQualtricsStudyId}
                />
                <SourceKeepTable
                  sources={project.sources ?? []}
                  questions={project.questions ?? []}
                  canEdit={canEdit}
                  saving={saving}
                  onKeep={onKeepSource}
                  onCreateManual={onCreateManual}
                  onCreateEvidence={openCreateEvidence}
                />
              </section>
            ) : tab === 'competitors' ? (
              <CompetitorPane
                projectId={project.id}
                sources={project.sources ?? []}
                canEdit={canEdit}
              />
            ) : tab === 'studies' ? (
              <StudiesPane
                projectId={project.id}
                productType={project.product_type}
                canEdit={canEdit}
                canRun={canRun}
                onIngested={() => {
                  const access = getAccessToken();
                  if (access) void load(access);
                }}
              />
            ) : tab === 'evidence' ? (
              <EvidenceTab
                project={project}
                canEdit={canEdit}
                saving={saving}
                onCreate={() => openCreateEvidence(null)}
                onOpen={openEditEvidence}
                onSupersede={openSupersede}
              />
            ) : tab === 'insights' ? (
              <InsightsTab
                project={project}
                ragEnabled={ragEnabled}
                copilotRagHits={copilotRagHits}
                canEdit={canEdit}
                canRun={canRun}
                saving={saving}
                onCreate={() => {
                  setActiveInsight(null);
                  setInsightOpen(true);
                }}
                onOpen={(insight) => {
                  setActiveInsight(insight);
                  setInsightOpen(true);
                }}
                onSubmitReview={(insight) => void onSubmitInsight(insight)}
                onCopilot={(ids) => void onInsightCopilot(ids)}
              />
            ) : tab === 'report' ? (
              <ReportTab
                project={project}
                canEdit={canEdit}
                canRun={canRun}
                canExport={canExport}
                canApprove={canApprove}
                saving={saving}
                snapshot={reportSnapshot}
                reports={reports}
                onCopilot={(ids) => void onReportCopilot(ids)}
                onCreate={(ids, methodology) => void onCreateReport(ids, methodology)}
                onExport={(reportId, versionId, format) => void onExportReport(reportId, versionId, format)}
                onSaveExecEn={(reportId, versionId, en) => void onSaveExecEn(reportId, versionId, en)}
                onApproveExecEn={(reportId, versionId) => void onApproveExecEn(reportId, versionId)}
                onSaveEmbargo={(reportId, versionId, body) => void onSaveEmbargo(reportId, versionId, body)}
                onPublishPortal={(reportId, versionId, visible) =>
                  void onPublishPortal(reportId, versionId, visible)
                }
              />
            ) : tab === 'waves' && project.product_type === 'TRACKER' ? (
              <WavesPane projectId={project.id} canEdit={canEdit} />
            ) : tab === 'vw' && shouldShowVwTab(project.product_type) ? (
              <VwPane projectId={project.id} canEdit={canEdit} />
            ) : tab === 'conjoint' && shouldShowConjointTab(project.product_type) ? (
              <ConjointPane projectId={project.id} canEdit={canEdit} />
            ) : tab === 'decisions' ? (
              <DecisionLogPane
                projectId={project.id}
                insights={project.insights ?? []}
                canEdit={canEdit}
              />
            ) : tab === 'governance' ? (
              <ResearchIsoGapPanel projectId={project.id} />
            ) : (
              <p className="muted">P0: dùng tab Brief / Nguồn / Evidence / Insight. Tab {TABS.find((t) => t.id === tab)?.label} sẽ có ở milestone sau.</p>
            )}
            <EvidenceFormDrawer
              open={drawerOpen}
              mode={drawerMode}
              canEdit={canEdit}
              saving={saving}
              projectId={project.id}
              sources={project.sources ?? []}
              questions={project.questions ?? []}
              source={drawerSource}
              evidence={drawerEvidence}
              piiWarning={piiWarning}
              onClose={() => setDrawerOpen(false)}
              onSave={onSaveEvidence}
              onVerify={onVerifyEvidence}
            />
            <InsightDrawer
              open={insightOpen}
              insight={activeInsight}
              evidence={project.evidence ?? []}
              canEdit={canEdit}
              canApprove={canApprove}
              isCreator={isInsightCreator(activeInsight)}
              saving={saving}
              onClose={() => setInsightOpen(false)}
              onSave={onSaveInsight}
              onSubmitReview={(body, evidenceIds) =>
                onSubmitInsight(
                  activeInsight ?? { id: 0, evidence_ids: evidenceIds } as ResearchInsight,
                  body,
                  evidenceIds,
                )
              }
              onApprove={onApproveInsight}
              onAttachTheme={onAttachInsightTheme}
            />
            <InsightGateDialog open={gateOpen} messages={gateMessages} onClose={() => setGateOpen(false)} />
            <DeepResearchModal
              open={deepOpen}
              provider={deepProvider}
              questionLabel={
                project.questions?.find((q) => q.id === (deskQuestionId ?? project.questions?.[0]?.id))
                  ?.question_vi ?? '—'
              }
              saving={saving}
              onClose={() => setDeepOpen(false)}
              onConfirm={() => void onRunDeep()}
            />
          </>
        ) : null}
      </div>
    </StaffPageShell>
  );
}

function SourcesDeskBar({
  project,
  canRun,
  saving,
  questionId,
  runId,
  banner,
  deepProvider,
  deepRunId,
  deepBanner,
  triRunId,
  triBanner,
  pulseRunId,
  pulseBanner,
  sparktoroEnabled,
  sparktoroRunId,
  sparktoroBanner,
  talkwalkerEnabled,
  talkwalkerRunId,
  talkwalkerBanner,
  qualtricsEnabled,
  qualtricsStudies,
  qualtricsStudyId,
  qualtricsRunId,
  qualtricsBanner,
  onQuestionChange,
  onRun,
  onRetry,
  onSettled,
  onOpenDeep,
  onDeepSettled,
  onRunTriangulate,
  onTriSettled,
  onRunPulse,
  onPulseSettled,
  onRunSparktoro,
  onSparktoroSettled,
  onRunTalkwalker,
  onTalkwalkerSettled,
  onRunQualtrics,
  onQualtricsSettled,
  onQualtricsStudyChange,
}: {
  project: ResearchProject;
  canRun: boolean;
  saving: boolean;
  questionId: number | null;
  runId: number | null;
  banner: string;
  deepProvider: string;
  deepRunId: number | null;
  deepBanner: string;
  triRunId: number | null;
  triBanner: string;
  pulseRunId: number | null;
  pulseBanner: string;
  sparktoroEnabled: boolean;
  sparktoroRunId: number | null;
  sparktoroBanner: string;
  talkwalkerEnabled: boolean;
  talkwalkerRunId: number | null;
  talkwalkerBanner: string;
  qualtricsEnabled: boolean;
  qualtricsStudies: ResearchStudy[];
  qualtricsStudyId: number | null;
  qualtricsRunId: number | null;
  qualtricsBanner: string;
  onQuestionChange: (id: number) => void;
  onRun: () => void;
  onRetry: () => void;
  onSettled: (run: ResearchAiRun) => void;
  onOpenDeep: () => void;
  onDeepSettled: (run: ResearchAiRun) => void;
  onRunTriangulate: () => void;
  onTriSettled: (run: ResearchAiRun) => void;
  onRunPulse: () => void;
  onPulseSettled: (run: ResearchAiRun) => void;
  onRunSparktoro: () => void;
  onSparktoroSettled: (run: ResearchAiRun) => void;
  onRunTalkwalker: () => void;
  onTalkwalkerSettled: (run: ResearchAiRun) => void;
  onRunQualtrics: () => void;
  onQualtricsSettled: (run: ResearchAiRun) => void;
  onQualtricsStudyChange: (id: number) => void;
}) {
  const questions = project.questions ?? [];
  const used = project.tavily_credits_used ?? 0;
  const limit = project.tavily_credits_limit ?? 12;
  const inFlight = Boolean(runId) && !banner;
  const failed = Boolean(banner);
  const deepEnabled = deepProvider && deepProvider !== 'off';
  const deepInFlight = Boolean(deepRunId) && !deepBanner;
  const triInFlight = Boolean(triRunId) && !triBanner;
  const triFailed = Boolean(triBanner);
  const pulseInFlight = Boolean(pulseRunId) && !pulseBanner;
  const pulseFailed = Boolean(pulseBanner);
  const showSparktoro = shouldShowSparktoroButton(sparktoroEnabled, canRun);
  const showTalkwalker = shouldShowTalkwalkerButton(talkwalkerEnabled, canRun);
  const showQualtrics = shouldShowQualtricsButton(qualtricsEnabled, canRun);
  const sparktoroInFlight = Boolean(sparktoroRunId) && !sparktoroBanner;
  const sparktoroFailed = Boolean(sparktoroBanner);
  const talkwalkerInFlight = Boolean(talkwalkerRunId) && !talkwalkerBanner;
  const qualtricsInFlight = Boolean(qualtricsRunId) && !qualtricsBanner;
  const qualtricsFailed = Boolean(qualtricsBanner);
  const hasPulseSignals = (project.trend_signals ?? []).length > 0;
  return (
    <div className="stack-gap" style={{ marginBottom: '0.85rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          Câu hỏi
          <select
            className="kpi-input"
            value={questionId ?? ''}
            disabled={!canRun || saving || questions.length === 0}
            onChange={(e) => onQuestionChange(Number(e.target.value))}
            style={{ display: 'block', marginTop: 4 }}
          >
            {questions.length === 0 ? <option value="">Chưa có RQ</option> : null}
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                Q{q.sort_order}: {q.question_vi}
              </option>
            ))}
          </select>
        </label>
        {canRun ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={saving || !questionId || inFlight}
            title={inFlight ? TRANSITION_REASON_VI.job_in_flight : undefined}
            onClick={failed ? onRetry : onRun}
          >
            {failed ? 'Thử lại Desk' : 'Chạy Desk Tavily'}
          </button>
        ) : null}
        {canRun && deepEnabled ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={saving || !questionId || deepInFlight}
            title={deepInFlight ? TRANSITION_REASON_VI.job_in_flight : undefined}
            onClick={onOpenDeep}
          >
            Chạy Deep Research
          </button>
        ) : null}
        {canRun ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={saving || !questionId || triInFlight}
            title={triInFlight ? TRANSITION_REASON_VI.job_in_flight : undefined}
            onClick={onRunTriangulate}
          >
            {triFailed ? 'Thử lại Tam giác nguồn' : 'Tam giác nguồn'}
          </button>
        ) : null}
        {canRun ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={saving || pulseInFlight}
            title={pulseInFlight ? TRANSITION_REASON_VI.job_in_flight : undefined}
            onClick={onRunPulse}
          >
            {pulseFailed ? 'Thử lại pulse' : 'Chạy pulse'}
          </button>
        ) : null}
        {showSparktoro ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={saving || !questionId || sparktoroInFlight}
            title={sparktoroInFlight ? TRANSITION_REASON_VI.job_in_flight : undefined}
            onClick={onRunSparktoro}
          >
            {sparktoroFailed ? 'Thử lại SparkToro' : 'Chạy SparkToro'}
          </button>
        ) : null}
        {showTalkwalker ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={saving || !questionId || talkwalkerInFlight}
            title={TALKWALKER_DISABLED_TITLE}
            onClick={onRunTalkwalker}
          >
            Chạy Talkwalker
          </button>
        ) : null}
        {showQualtrics ? (
          <>
            <label>
              Study Qualtrics
              <select
                className="kpi-input"
                value={qualtricsStudyId ?? ''}
                disabled={!canRun || saving || qualtricsStudies.length === 0}
                onChange={(e) => onQualtricsStudyChange(Number(e.target.value))}
                style={{ display: 'block', marginTop: 4 }}
              >
                {qualtricsStudies.length === 0 ? (
                  <option value="">Chưa có study SV_…</option>
                ) : null}
                {qualtricsStudies.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} ({row.instrument_version})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-sm"
              disabled={qualtricsRunDisabled({
                saving,
                studyId: qualtricsStudyId,
                inFlight: qualtricsInFlight,
              })}
              title={qualtricsInFlight ? TRANSITION_REASON_VI.job_in_flight : undefined}
              onClick={onRunQualtrics}
            >
              {qualtricsFailed ? 'Thử lại Qualtrics' : 'Chạy Qualtrics'}
            </button>
          </>
        ) : null}
        <ResearchJobChip
          token={getAccessToken()}
          projectId={project.id}
          runId={runId}
          onSettled={onSettled}
        />
        <ResearchJobChip
          token={getAccessToken()}
          projectId={project.id}
          runId={deepRunId}
          kind="deep"
          onSettled={onDeepSettled}
        />
        <ResearchJobChip
          token={getAccessToken()}
          projectId={project.id}
          runId={triRunId}
          kind="triangulate"
          onSettled={onTriSettled}
        />
        <ResearchJobChip
          token={getAccessToken()}
          projectId={project.id}
          runId={pulseRunId}
          kind="pulse"
          onSettled={onPulseSettled}
        />
        <ResearchJobChip
          token={getAccessToken()}
          projectId={project.id}
          runId={sparktoroRunId}
          kind="sparktoro"
          onSettled={onSparktoroSettled}
        />
        <ResearchJobChip
          token={getAccessToken()}
          projectId={project.id}
          runId={talkwalkerRunId}
          kind="talkwalker"
          onSettled={onTalkwalkerSettled}
        />
        <ResearchJobChip
          token={getAccessToken()}
          projectId={project.id}
          runId={qualtricsRunId}
          kind="qualtrics"
          onSettled={onQualtricsSettled}
        />
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          Tavily {used}/{limit} credit dự án
        </span>
      </div>
      {banner ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: '0.55rem 0.75rem',
            borderRadius: 8,
            border: '1px solid rgba(234, 179, 8, 0.45)',
            background: 'rgba(234, 179, 8, 0.12)',
          }}
        >
          {banner}
        </p>
      ) : null}
      {deepBanner ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: '0.55rem 0.75rem',
            borderRadius: 8,
            border: '1px solid rgba(234, 179, 8, 0.45)',
            background: 'rgba(234, 179, 8, 0.12)',
          }}
        >
          {deepBanner}
        </p>
      ) : null}
      {triBanner ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: '0.55rem 0.75rem',
            borderRadius: 8,
            border: '1px solid rgba(234, 179, 8, 0.45)',
            background: 'rgba(234, 179, 8, 0.12)',
          }}
        >
          {triBanner}
        </p>
      ) : null}
      {pulseBanner ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: '0.55rem 0.75rem',
            borderRadius: 8,
            border: '1px solid rgba(234, 179, 8, 0.45)',
            background: 'rgba(234, 179, 8, 0.12)',
          }}
        >
          {pulseBanner}
        </p>
      ) : null}
      {sparktoroBanner ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: '0.55rem 0.75rem',
            borderRadius: 8,
            border: '1px solid rgba(234, 179, 8, 0.45)',
            background: 'rgba(234, 179, 8, 0.12)',
          }}
        >
          {sparktoroBanner}
        </p>
      ) : null}
      {talkwalkerBanner ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: '0.55rem 0.75rem',
            borderRadius: 8,
            border: '1px solid rgba(234, 179, 8, 0.45)',
            background: 'rgba(234, 179, 8, 0.12)',
          }}
        >
          {talkwalkerBanner}
        </p>
      ) : null}
      {qualtricsBanner ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: '0.55rem 0.75rem',
            borderRadius: 8,
            border: '1px solid rgba(234, 179, 8, 0.45)',
            background: 'rgba(234, 179, 8, 0.12)',
          }}
        >
          {qualtricsBanner}
        </p>
      ) : null}
      <p
        role="status"
        style={{
          margin: 0,
          padding: '0.55rem 0.75rem',
          borderRadius: 8,
          border: '1px solid rgba(234, 179, 8, 0.45)',
          background: 'rgba(234, 179, 8, 0.12)',
        }}
      >
        {SPARKTORO_SOURCES_BANNER}
      </p>
      {showTalkwalker ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: '0.55rem 0.75rem',
            borderRadius: 8,
            border: '1px solid rgba(234, 179, 8, 0.45)',
            background: 'rgba(234, 179, 8, 0.12)',
          }}
        >
          {TALKWALKER_SOURCES_BANNER}
        </p>
      ) : null}
      {hasPulseSignals ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: '0.55rem 0.75rem',
            borderRadius: 8,
            border: '1px solid rgba(234, 179, 8, 0.45)',
            background: 'rgba(234, 179, 8, 0.12)',
          }}
        >
          <Link href="/crm/ops/alerts">«Cảnh báo pulse»</Link>
        </p>
      ) : null}
    </div>
  );
}

function BriefTab({
  project,
  canEdit,
  newRq,
  setNewRq,
  saving,
  onAddRq,
  onPatchRq,
  onDeleteRq,
}: {
  project: ResearchProject;
  canEdit: boolean;
  newRq: string;
  setNewRq: (v: string) => void;
  saving: boolean;
  onAddRq: () => void;
  onPatchRq: (q: ResearchQuestion, question_vi: string) => Promise<void>;
  onDeleteRq: (q: ResearchQuestion) => Promise<void>;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
      <div className="stack-gap">
        <section className="card" style={{ padding: '0.9rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Quyết định</h2>
          <p style={{ margin: 0 }}>{project.decision_statement}</p>
        </section>
        <section className="card" style={{ padding: '0.9rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Câu hỏi nghiên cứu</h2>
          {(project.questions ?? []).length === 0 ? (
            <p className="muted" title={TRANSITION_REASON_VI.need_rq}>
              Cần ≥1 câu hỏi nghiên cứu để chuyển Thiết kế.
            </p>
          ) : null}
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {(project.questions ?? []).map((q) => (
              <li key={q.id} style={{ marginBottom: '0.6rem' }}>
                {canEdit ? (
                  <RqInline q={q} disabled={saving} onSave={onPatchRq} onDelete={onDeleteRq} />
                ) : (
                  q.question_vi
                )}
              </li>
            ))}
          </ul>
          {canEdit ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAddRq();
              }}
              style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}
            >
              <input
                className="kpi-input"
                value={newRq}
                onChange={(e) => setNewRq(e.target.value)}
                placeholder="Thêm câu hỏi…"
                disabled={saving}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-sm btn-secondary" disabled={saving || !newRq.trim()}>
                + Thêm
              </button>
            </form>
          ) : null}
        </section>
      </div>
      <aside className="card" style={{ padding: '0.9rem' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>SOP G0–G10</h2>
        <ol className="muted" style={{ margin: 0, paddingLeft: '1.1rem' }}>
          <li style={{ fontWeight: 700 }}>G0 Intake — brief + RQ</li>
          <li>G1 Design</li>
          <li>G2 Collect</li>
          <li>G3 QC</li>
          <li>G4 Analyze</li>
          <li>G5 Synthesize</li>
          <li>G6 Draft</li>
          <li>G7 Review</li>
          <li>G8 Approve</li>
          <li>G9 Distribute</li>
          <li>G10 Archive</li>
        </ol>
      </aside>
    </div>
  );
}

function InsightsTab({
  project,
  ragEnabled,
  copilotRagHits,
  canEdit,
  canRun,
  saving,
  onCreate,
  onOpen,
  onSubmitReview,
  onCopilot,
}: {
  project: ResearchProject;
  ragEnabled: boolean;
  copilotRagHits: InsightCopilotRagHit[];
  canEdit: boolean;
  canRun: boolean;
  saving: boolean;
  onCreate: () => void;
  onOpen: (insight: ResearchInsight) => void;
  onSubmitReview: (insight: ResearchInsight) => void;
  onCopilot: (evidenceIds: number[]) => void;
}) {
  const rows = project.insights ?? [];
  const verified = (project.evidence ?? []).filter((ev) => ev.qc_status === 'verified');
  const [selected, setSelected] = useState<number[]>([]);
  const [staleOnly, setStaleOnly] = useState(false);
  const staleCount = rows.filter((row) => insightIsStale(row)).length;
  const visibleRows = staleOnly ? rows.filter((row) => insightIsStale(row)) : rows;
  return (
    <section className="card" style={{ padding: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Insight</h2>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {canRun ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={saving || selected.length === 0}
              title={selected.length === 0 ? 'Chọn ≥1 evidence đã verify' : undefined}
              onClick={() => onCopilot(selected)}
            >
              Gợi ý insight (Claude)
            </button>
          ) : null}
          {canEdit ? (
            <button type="button" className="btn btn-sm btn-secondary" disabled={saving} onClick={onCreate}>
              + Insight
            </button>
          ) : null}
        </div>
      </div>
      {shouldShowRagCopilotBanner(ragEnabled, canRun) ? (
        <p className="muted" data-testid="rag-copilot-banner" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
          {RAG_COPILOT_BANNER}
        </p>
      ) : null}
      {rows.length > 0 && staleCount > 0 ? (
        <label
          style={{
            display: 'inline-flex',
            gap: 6,
            alignItems: 'center',
            marginTop: '0.65rem',
            fontSize: '0.85rem',
          }}
        >
          <input
            type="checkbox"
            checked={staleOnly}
            onChange={(e) => setStaleOnly(e.target.checked)}
          />
          Chỉ hết hạn ({staleCount})
        </label>
      ) : null}
      <InsightsRagSearch ragEnabled={ragEnabled} clientId={project.client_id} />
      {canRun ? (
        <div style={{ marginTop: '0.75rem' }}>
          <p className="muted" style={{ margin: '0 0 0.4rem', fontSize: '0.85rem' }}>
            Chọn evidence đã verify — Claude chỉ được dùng các ID này.
          </p>
          {verified.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Chưa có evidence verified — nút gợi ý tắt.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {verified.map((ev) => {
                const checked = selected.includes(ev.id);
                return (
                  <label
                    key={ev.id}
                    style={{
                      display: 'inline-flex',
                      gap: 6,
                      alignItems: 'center',
                      fontSize: '0.85rem',
                      border: '1px solid #d8e0d8',
                      borderRadius: 8,
                      padding: '0.25rem 0.5rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={saving}
                      onChange={() =>
                        setSelected((prev) =>
                          checked ? prev.filter((id) => id !== ev.id) : [...prev, ev.id],
                        )
                      }
                    />
                    EV-{ev.id}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
      {shouldShowRagCopilotBanner(ragEnabled, canRun) && copilotRagHits.length > 0 ? (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          {copilotRagHits.map((hit) => (
            <span
              key={hit.insight_id}
              className="muted"
              style={{
                display: 'inline-block',
                padding: '0.1rem 0.45rem',
                borderRadius: 999,
                background: 'color-mix(in srgb, var(--primary) 12%, white)',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              {`Tham chiếu #${hit.insight_id}`}
            </span>
          ))}
        </div>
      ) : null}
      {visibleRows.length === 0 ? (
        <p className="muted">
          {staleOnly
            ? 'Không có insight hết hạn trong project này.'
            : 'Gắn evidence rồi soạn insight — không viết từ AI suông.'}
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '0.75rem',
            marginTop: '0.75rem',
          }}
        >
          {visibleRows.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              evidence={project.evidence ?? []}
              canEdit={canEdit}
              saving={saving}
              onOpen={onOpen}
              onSubmitReview={onSubmitReview}
            />
          ))}
        </div>
      )}
    </section>
  );
}

const APPROVED_INTERNAL_PLUS: InsightStatus[] = [
  'approved_internal',
  'approved_client_facing',
  'published',
];

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(local: string): string | null {
  const text = local.trim();
  if (!text) return null;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function ReportTab({
  project,
  canEdit,
  canRun,
  canExport,
  canApprove,
  saving,
  snapshot,
  reports,
  onCopilot,
  onCreate,
  onExport,
  onSaveExecEn,
  onApproveExecEn,
  onSaveEmbargo,
  onPublishPortal,
}: {
  project: ResearchProject;
  canEdit: boolean;
  canRun: boolean;
  canExport: boolean;
  canApprove: boolean;
  saving: boolean;
  snapshot: ResearchReportSnapshot | null;
  reports: ResearchReport[];
  onCopilot: (insightIds: number[]) => void;
  onCreate: (insightIds: number[], methodology?: MethodologyBlock) => void;
  onExport: (reportId: number, versionId: number, format?: 'docx' | 'pdf') => void;
  onSaveExecEn: (reportId: number, versionId: number, en: string) => void;
  onApproveExecEn: (reportId: number, versionId: number) => void;
  onSaveEmbargo: (
    reportId: number,
    versionId: number,
    body: { embargo_until?: string | null; expires_at?: string | null },
  ) => void;
  onPublishPortal: (reportId: number, versionId: number, visible: boolean) => void;
}) {
  const approved = (project.insights ?? []).filter((row) => APPROVED_INTERNAL_PLUS.includes(row.status));
  const [selected, setSelected] = useState<number[]>(() => approved.map((row) => row.id));
  const [population, setPopulation] = useState('');
  const [sourcePlan, setSourcePlan] = useState('');
  const [limitation, setLimitation] = useState('');
  const [enDrafts, setEnDrafts] = useState<Record<number, string>>({});
  const [embargoDrafts, setEmbargoDrafts] = useState<Record<number, { embargo: string; expires: string }>>(
    {},
  );
  const [staleOnly, setStaleOnly] = useState(false);
  const snapshotExec = normalizeReportExec(snapshot?.exec);
  const insights = project.insights ?? [];
  const allVersions = reports.flatMap((report) =>
    report.versions.map((version) => ({ report, version })),
  );
  const staleCount = countStaffReportVersionsWithStaleInsights(allVersions, insights);
  const visibleVersions = filterStaffReportVersionsByStale(allVersions, insights, staleOnly);
  const formMethodology: MethodologyBlock = {
    population,
    source_plan: sourcePlan,
    limitation,
    stub: project.dv12_tier === 'CB' && !isMethodologyComplete({ population, source_plan: sourcePlan, limitation }),
  };
  const formComplete = isMethodologyExportable(project.dv12_tier, formMethodology);
  return (
    <section className="card" style={{ padding: '0.9rem' }}>
      <div
        role="status"
        style={{
          marginBottom: '0.75rem',
          padding: '0.55rem 0.7rem',
          borderRadius: 8,
          background: '#fff7ed',
          border: '1px solid #fdba74',
          fontSize: '0.85rem',
        }}
      >
        BR-RES-05: Báo cáo đã duyệt không sửa tại chỗ — tạo phiên bản mới (version++).
      </div>
      <div
        role="status"
        style={{
          marginBottom: '0.75rem',
          padding: '0.55rem 0.7rem',
          borderRadius: 8,
          background: 'color-mix(in srgb, var(--primary) 10%, var(--bg))',
          border: '1px solid var(--border)',
          fontSize: '0.85rem',
        }}
      >
        {METHODOLOGY_EXPORT_BANNER}
      </div>
      <div
        role="status"
        style={{
          marginBottom: '0.75rem',
          padding: '0.55rem 0.7rem',
          borderRadius: 8,
          background: 'color-mix(in srgb, var(--primary) 10%, var(--bg))',
          border: '1px solid var(--border)',
          fontSize: '0.85rem',
        }}
      >
        Lead duyệt bản dịch trước khi gửi khách.
      </div>
      <div
        role="status"
        style={{
          marginBottom: '0.75rem',
          padding: '0.55rem 0.7rem',
          borderRadius: 8,
          background: 'color-mix(in srgb, var(--primary) 10%, var(--bg))',
          border: '1px solid var(--border)',
          fontSize: '0.85rem',
        }}
      >
        Chỉ công bố khi insight đã duyệt bản khách. Không tự đăng.
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Báo cáo</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canEdit ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={saving || selected.length === 0 || !formComplete}
              title={
                selected.length === 0
                  ? 'Chọn ≥1 insight đã duyệt nội bộ'
                  : !formComplete
                    ? METHODOLOGY_EXPORT_BANNER
                    : undefined
              }
              onClick={() => onCreate(selected, formMethodology)}
            >
              Tạo phiên bản
            </button>
          ) : null}
          {canRun ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={saving || selected.length === 0}
              title={selected.length === 0 ? 'Chọn ≥1 insight đã duyệt nội bộ' : undefined}
              onClick={() => onCopilot(selected)}
            >
              Gợi ý dàn báo cáo
            </button>
          ) : null}
        </div>
      </div>
      <p className="muted" style={{ margin: '0.5rem 0 0.75rem' }}>
        Snapshot từ insight approved_internal+. Xuất DOCX có appendix Evidence index.
      </p>
      <div style={{ display: 'grid', gap: '0.55rem', marginBottom: '0.75rem' }}>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Dân số
          <textarea
            rows={2}
            disabled={saving}
            value={population}
            onChange={(e) => setPopulation(e.target.value)}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Kế hoạch nguồn
          <textarea
            rows={2}
            disabled={saving}
            value={sourcePlan}
            onChange={(e) => setSourcePlan(e.target.value)}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Hạn chế
          <textarea
            rows={2}
            disabled={saving}
            value={limitation}
            onChange={(e) => setLimitation(e.target.value)}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </label>
      </div>
      {approved.length === 0 ? (
        <p className="muted">Chưa có insight approved_internal+.</p>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {approved.map((insight) => {
            const checked = selected.includes(insight.id);
            return (
              <label
                key={insight.id}
                style={{
                  display: 'inline-flex',
                  gap: 6,
                  alignItems: 'center',
                  fontSize: '0.85rem',
                  border: '1px solid #d8e0d8',
                  borderRadius: 8,
                  padding: '0.25rem 0.5rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={saving}
                  onChange={() =>
                    setSelected((prev) =>
                      checked ? prev.filter((id) => id !== insight.id) : [...prev, insight.id],
                    )
                  }
                />
                #{insight.id}
                {insight.ai_generated ? ' · AI' : ''}
              </label>
            );
          })}
        </div>
      )}
      {allVersions.length === 0 ? (
        <p className="muted">Chưa có phiên bản báo cáo.</p>
      ) : (
        <>
          {(staleCount > 0 || staleOnly) && allVersions.length > 0 ? (
            <label
              data-testid="staff-report-stale-only-filter"
              style={{
                display: 'inline-flex',
                gap: 6,
                alignItems: 'center',
                marginBottom: '0.65rem',
                fontSize: '0.85rem',
              }}
            >
              <input
                type="checkbox"
                checked={staleOnly}
                onChange={(e) => setStaleOnly(e.target.checked)}
              />
              {STAFF_REPORT_STALE_ONLY_LABEL} ({staleOnly ? visibleVersions.length : staleCount})
            </label>
          ) : null}
          {staleOnly && visibleVersions.length === 0 && allVersions.length > 0 ? (
            <p className="muted" data-testid="staff-report-stale-only-empty">
              {STAFF_REPORT_STALE_ONLY_EMPTY}
            </p>
          ) : null}
          {visibleVersions.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.75rem' }}>
          {visibleVersions.map(({ report, version }) => {
            const exec = normalizeReportExec(version.content_snapshot?.exec);
            const enValue = enDrafts[version.id] ?? exec.en ?? '';
            const enLocked = exec.en_status === 'approved';
            const methodologyOk = isMethodologyExportable(
              project.dv12_tier,
              version.content_snapshot?.methodology,
            );
            const exportDisabled = saving || !methodologyOk;
            const exportTitle = methodologyOk ? undefined : METHODOLOGY_EXPORT_BANNER;
            const versionHasStaleInsights = staffReportVersionHasStaleInsights(
              version,
              project.insights ?? [],
            );
            return (
            <li
              key={version.id}
              data-testid={`staff-report-version-row-${version.id}`}
              style={{
                display: 'grid',
                gap: '0.45rem',
                padding: '0.45rem 0',
                borderBottom: '1px solid #e6ebe6',
                fontSize: '0.85rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  alignItems: 'center',
                }}
              >
                <span>
                  v{version.version} · {version.created_at.slice(0, 10)} · {version.generated_by ?? '—'}
                  <span className="muted"> · {version.content_hash.slice(0, 8)}</span>
                  {enLocked ? <span className="muted"> · EN đã duyệt</span> : null}
                  <StaffReportVersionStaleBadge hasStaleInsights={versionHasStaleInsights} />
                </span>
                {canExport ? (
                  <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={exportDisabled}
                      title={exportTitle}
                      onClick={() => onExport(report.id, version.id)}
                    >
                      Xuất DOCX
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={exportDisabled}
                      title={exportTitle}
                      onClick={() => onExport(report.id, version.id, 'pdf')}
                    >
                      Xuất PDF
                    </button>
                  </span>
                ) : null}
              </div>
              <ReportPublishedValidToList
                findings={version.content_snapshot?.findings}
                recs={version.content_snapshot?.recs}
              />
              <ReportStaleInsightList
                findings={version.content_snapshot?.findings}
                recs={version.content_snapshot?.recs}
                insights={project.insights ?? []}
              />
              <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
                Executive (VI)
                <textarea
                  rows={3}
                  readOnly
                  value={exec.vi}
                  style={{ width: '100%', resize: 'vertical', background: '#f6f7f6' }}
                />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
                Executive (EN)
                <textarea
                  rows={3}
                  disabled={saving || enLocked || !canEdit}
                  value={enValue}
                  onChange={(e) =>
                    setEnDrafts((prev) => ({ ...prev, [version.id]: e.target.value }))
                  }
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={saving || enLocked || !enValue.trim()}
                    onClick={() => onSaveExecEn(report.id, version.id, enValue)}
                  >
                    Lưu bản dịch
                  </button>
                ) : null}
                {canApprove ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={saving || enLocked || !String(exec.en ?? '').trim()}
                    onClick={() => onApproveExecEn(report.id, version.id)}
                  >
                    Duyệt bản dịch
                  </button>
                ) : null}
              </div>
              <div
                style={{
                  display: 'grid',
                  gap: '0.45rem',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                }}
              >
                <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
                  Cấm công bố đến
                  <input
                    type="datetime-local"
                    disabled={saving || !canEdit}
                    value={
                      embargoDrafts[version.id]?.embargo ?? toDatetimeLocal(version.embargo_until)
                    }
                    onChange={(e) =>
                      setEmbargoDrafts((prev) => ({
                        ...prev,
                        [version.id]: {
                          embargo: e.target.value,
                          expires:
                            prev[version.id]?.expires ?? toDatetimeLocal(version.expires_at),
                        },
                      }))
                    }
                  />
                </label>
                <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
                  Hết hạn
                  <input
                    type="datetime-local"
                    disabled={saving || !canEdit}
                    value={
                      embargoDrafts[version.id]?.expires ?? toDatetimeLocal(version.expires_at)
                    }
                    onChange={(e) =>
                      setEmbargoDrafts((prev) => ({
                        ...prev,
                        [version.id]: {
                          embargo:
                            prev[version.id]?.embargo ?? toDatetimeLocal(version.embargo_until),
                          expires: e.target.value,
                        },
                      }))
                    }
                  />
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={saving}
                    onClick={() =>
                      onSaveEmbargo(report.id, version.id, {
                        embargo_until: fromDatetimeLocal(
                          embargoDrafts[version.id]?.embargo ?? toDatetimeLocal(version.embargo_until),
                        ),
                        expires_at: fromDatetimeLocal(
                          embargoDrafts[version.id]?.expires ?? toDatetimeLocal(version.expires_at),
                        ),
                      })
                    }
                  >
                    Lưu hạn
                  </button>
                ) : null}
                {canApprove ? (
                  version.portal_visible ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={saving}
                      onClick={() => onPublishPortal(report.id, version.id, false)}
                    >
                      Gỡ khỏi portal
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={saving}
                      onClick={() => onPublishPortal(report.id, version.id, true)}
                    >
                      Công bố portal
                    </button>
                  )
                ) : null}
                <span className="muted">
                  {version.portal_visible ? 'Đã công bố portal' : 'Chưa công bố portal'}
                </span>
                {version.published_by || version.published_at ? (
                  <span className="muted">
                    Công bố bởi {version.published_by} lúc {version.published_at}
                  </span>
                ) : null}
              </div>
            </li>
            );
          })}
        </ul>
          ) : null}
        </>
      )}
      {snapshot ? (
        <div style={{ display: 'grid', gap: '0.55rem' }}>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
            Executive (VI)
            <textarea
              rows={3}
              readOnly
              value={snapshotExec.vi}
              style={{ width: '100%', resize: 'vertical', background: '#f6f7f6' }}
            />
          </label>
          <pre
            style={{
              margin: 0,
              padding: '0.75rem',
              background: '#f6f7f6',
              borderRadius: 8,
              overflow: 'auto',
              fontSize: '0.8rem',
            }}
          >
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}

function EvidenceTab({
  project,
  canEdit,
  saving,
  onCreate,
  onOpen,
  onSupersede,
}: {
  project: ResearchProject;
  canEdit: boolean;
  saving: boolean;
  onCreate: () => void;
  onOpen: (ev: ResearchEvidence) => void;
  onSupersede: (ev: ResearchEvidence) => void;
}) {
  const rows = project.evidence ?? [];
  return (
    <section className="card" style={{ padding: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Evidence</h2>
        {canEdit ? (
          <button type="button" className="btn btn-sm" disabled={saving} onClick={onCreate}>
            + Evidence
          </button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="muted">Chưa có evidence. Tạo từ nguồn đã keep hoặc nút + Evidence.</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>ID</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>RQ</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Locator</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Excerpt / Value</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Unit</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Period</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Geo</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>QC</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((ev) => {
                const rq = (project.questions ?? []).find((q) => q.id === ev.question_id);
                const verified = ev.qc_status === 'verified';
                const locked = verified || ev.qc_status === 'superseded' || ev.qc_status === 'rejected';
                return (
                  <tr key={ev.id}>
                    <td style={{ padding: '0.4rem' }}>
                      <EvidenceIdChip id={ev.id} locator={ev.locator} />
                    </td>
                    <td style={{ padding: '0.4rem' }}>{rq ? `Q${rq.sort_order}` : '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{ev.locator}</td>
                    <td style={{ padding: '0.4rem' }}>
                      {locked ? '🔒 ' : ''}
                      {ev.excerpt || (ev.value_num != null ? String(ev.value_num) : '—')}
                    </td>
                    <td style={{ padding: '0.4rem' }}>{ev.unit || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{ev.period_note || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{ev.geography || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{ev.qc_status}</td>
                    <td style={{ padding: '0.4rem' }}>
                      {canEdit && !locked ? (
                        <button type="button" className="btn btn-sm btn-secondary" disabled={saving} onClick={() => onOpen(ev)}>
                          Mở
                        </button>
                      ) : null}
                      {canEdit && verified ? (
                        <button type="button" className="btn btn-sm btn-secondary" disabled={saving} onClick={() => onSupersede(ev)}>
                          Thay thế (supersede)
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RqInline({
  q,
  disabled,
  onSave,
  onDelete,
}: {
  q: ResearchQuestion;
  disabled: boolean;
  onSave: (q: ResearchQuestion, question_vi: string) => Promise<void>;
  onDelete: (q: ResearchQuestion) => Promise<void>;
}) {
  const [value, setValue] = useState(q.question_vi);
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
      <input
        className="kpi-input"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        style={{ flex: 1, minWidth: 180 }}
      />
      <button
        type="button"
        className="btn btn-sm"
        disabled={disabled || !value.trim() || value === q.question_vi}
        onClick={() => void onSave(q, value.trim())}
      >
        Lưu
      </button>
      <button type="button" className="btn btn-sm btn-secondary" disabled={disabled} onClick={() => void onDelete(q)}>
        Xoá
      </button>
    </div>
  );
}

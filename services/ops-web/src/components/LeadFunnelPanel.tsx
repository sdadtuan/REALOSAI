'use client';

import { PresalesTaskFormCard } from '@/components/PresalesTaskFormCard';
import { PresalesR5PlanForm } from '@/components/PresalesR5PlanForm';
import { PresalesSolutionHandoffBanner } from '@/components/PresalesSolutionHandoffBanner';
import { PresalesPolicyBanner } from '@/components/presales/PresalesPolicyBanner';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  completeLeadCareStage,
  ensureLeadPresales,
  fetchLeadFunnel,
  fetchLeadPresalesMarketingPlan,
  patchLeadPresalesMarketingPlan,
  patchLeadPresalesTask,
  postLeadPresalesMarketingPlanAiDraft,
  postLeadPresalesTaskAiAssist,
  releaseLeadReviewQueue,
  submitLeadCareReport,
  type LeadFunnelSnapshot,
} from '@/lib/api';
import { showPresalesForFlow } from '@/lib/crm/lead-flow-kind';
import {
  B2_NEGATIVE_CARE_OPTIONS,
  CRM_CARE_CONTACT_OPTIONS,
  b2NegativeCareHint,
  b2NegativeCareSuggestLost,
  type B2NegativeCareStatus,
} from '@/lib/crm/care-status';
import { hasCap, canGenerateMktAiPlanner, canViewLmp, type StoredStaffUser } from '@/lib/auth';
import { leadMeetingPrepEnabled } from '@/lib/crm/lmp-flags';
import { fetchLeadMeetingPrep, prepStatusChipLabel } from '@/lib/lead-meeting-prep-api';
import { M1FirstCallCard } from '@/app/crm/leads/meeting-prep/M1FirstCallCard';
import { M2QualifyHandoffCard } from '@/app/crm/leads/meeting-prep/M2QualifyHandoffCard';
import type { LeadMeetingPrepStatus } from '@/app/crm/leads/meeting-prep/lead-meeting-prep.types';

interface Props {
  token: string;
  leadId: number;
  user: StoredStaffUser | null;
  serviceSlug?: string;
  serviceOptions?: Array<{ slug: string; name: string }>;
  syncFunnel?: LeadFunnelSnapshot | null;
  fetchOnMount?: boolean;
  onOpenConsultTab?: () => void;
  onOpenMeetingPrepTab?: () => void;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
  onFunnelChange?: (funnel: LeadFunnelSnapshot) => void;
  onFunnelUpdated?: () => void;
  /** Hero SLA+SCI panel đã gộp — ẩn thẻ M1 trùng trong funnel */
  hideM1Card?: boolean;
}

const DEFAULT_PRESALES_SERVICES: Array<{ slug: string; name: string }> = [
  { slug: 'dich-vu-seo-tong-the', name: 'SEO tổng thể' },
  { slug: 'dich-vu-seo-local', name: 'SEO Local' },
  { slug: 'dich-vu-seo-audit', name: 'SEO Audit' },
  { slug: 'dich-vu-aeo', name: 'AEO' },
];

export function mergePresalesServiceOptions(
  catalog?: Array<{ slug: string; name: string }>,
): Array<{ slug: string; name: string }> {
  const bySlug = new Map<string, { slug: string; name: string }>();
  for (const item of DEFAULT_PRESALES_SERVICES) {
    bySlug.set(item.slug, item);
  }
  for (const item of catalog ?? []) {
    const slug = String(item.slug ?? '').trim();
    if (!slug) continue;
    bySlug.set(slug, { slug, name: String(item.name ?? slug).trim() || slug });
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

const DEFAULT_PRESALES_SLUG = 'dich-vu-seo-tong-the';

export function LeadFunnelPanel({
  token,
  leadId,
  user,
  serviceSlug,
  serviceOptions,
  syncFunnel,
  fetchOnMount = true,
  onOpenConsultTab,
  onOpenMeetingPrepTab,
  onMessage,
  onError,
  onFunnelChange,
  onFunnelUpdated,
  hideM1Card = false,
}: Props) {
  const [funnel, setFunnel] = useState<LeadFunnelSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [careNote, setCareNote] = useState('');
  const [careReport, setCareReport] = useState('Đã liên hệ KH — xác nhận nhu cầu');
  const [negativeCareStatus, setNegativeCareStatus] = useState<B2NegativeCareStatus>('khong_nghe_may');
  const [negativeCareReport, setNegativeCareReport] = useState('');
  const [negativeContactType, setNegativeContactType] = useState('goi_dien');
  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [panelMessage, setPanelMessage] = useState('');
  const [planName, setPlanName] = useState('');
  const [planNorthStar, setPlanNorthStar] = useState('');
  const [planObjectives, setPlanObjectives] = useState('');
  const [planStrategy, setPlanStrategy] = useState<Record<string, string>>({});
  const [planValidation, setPlanValidation] = useState<string[]>([]);
  const [taskDrafts, setTaskDrafts] = useState<Record<number, Record<string, string>>>({});
  const [aiBusyTaskId, setAiBusyTaskId] = useState<number | null>(null);
  const [aiPlanDraftBusy, setAiPlanDraftBusy] = useState(false);
  const [showAiDraftBadge, setShowAiDraftBadge] = useState(false);
  const [prepStatus, setPrepStatus] = useState<LeadMeetingPrepStatus | null>(null);
  const presalesServiceOptions = useMemo(
    () => mergePresalesServiceOptions(serviceOptions),
    [serviceOptions],
  );
  const [selectedServiceSlug, setSelectedServiceSlug] = useState(
    () => serviceSlug?.trim() || DEFAULT_PRESALES_SLUG,
  );

  useEffect(() => {
    if (serviceSlug?.trim()) {
      setSelectedServiceSlug(serviceSlug.trim());
    }
  }, [serviceSlug]);

  useEffect(() => {
    if (serviceSlug?.trim()) return;
    if (presalesServiceOptions.some((item) => item.slug === selectedServiceSlug)) return;
    setSelectedServiceSlug(presalesServiceOptions[0]?.slug ?? DEFAULT_PRESALES_SLUG);
  }, [presalesServiceOptions, selectedServiceSlug, serviceSlug]);

  const reload = useCallback(async () => {
    setLoading(true);
    setPanelError('');
    try {
      const snap = await fetchLeadFunnel(token, leadId);
      setFunnel(snap);
      onFunnelChange?.(snap);
      if (snap.presales) {
        if (
          snap.presales.presales.stage === 'consult' ||
          snap.presales.presales.stage === 'proposal'
        ) {
          try {
            const mp = await fetchLeadPresalesMarketingPlan(token, leadId);
            setPlanName(String(mp.plan.name ?? ''));
            setPlanNorthStar(String(mp.plan.north_star ?? ''));
            setPlanObjectives(String(mp.plan.objectives ?? ''));
            let sf: Record<string, string> = {};
            try {
              sf = JSON.parse(String(mp.plan.strategy_framework_json ?? '{}')) as Record<string, string>;
            } catch {
              sf = {};
            }
            setPlanStrategy(sf);
            setPlanValidation(mp.validation.messages ?? []);
            setShowAiDraftBadge(Boolean((mp as { ai_draft?: { is_ai_draft?: boolean } }).ai_draft?.is_ai_draft));
          } catch {
            setPlanValidation([]);
            setShowAiDraftBadge(false);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Tải funnel thất bại';
      setPanelError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, leadId, onError, onFunnelChange]);

  useEffect(() => {
    if (!fetchOnMount && syncFunnel) {
      setFunnel(syncFunnel);
      setLoading(false);
      return;
    }
    void reload();
  }, [fetchOnMount, reload, syncFunnel]);

  useEffect(() => {
    if (syncFunnel) {
      setFunnel(syncFunnel);
    }
  }, [syncFunnel]);

  useEffect(() => {
    if (!leadMeetingPrepEnabled() || !canViewLmp(user)) return;
    void fetchLeadMeetingPrep(token, leadId)
      .then((row) => setPrepStatus(row.status))
      .catch(() => setPrepStatus(null));
  }, [token, leadId, user]);

  const canEdit = Boolean(user && hasCap(user, 'crm_leads', 'edit'));
  const canAssign = Boolean(user && hasCap(user, 'crm_leads', 'assign'));
  const canAiDraft = Boolean(user && canGenerateMktAiPlanner(user));
  const prepChip = prepStatus ? prepStatusChipLabel(prepStatus) : null;

  async function run(action: () => Promise<void>, refreshContract = false) {
    setBusy(true);
    setPanelError('');
    try {
      await action();
      if (refreshContract) onFunnelUpdated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thao tác thất bại';
      setPanelError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function finishB2Stage() {
    const note = careNote.trim();
    if (note.length < 3) {
      setPanelError('Ghi chú hoàn thành B2 cần ≥ 3 ký tự.');
      return;
    }
    await run(async () => {
      const reportContent = careReport.trim() || 'Đã liên hệ KH — xác nhận nhu cầu';
      await submitLeadCareReport(token, leadId, { content: reportContent });
      const out = await completeLeadCareStage(token, leadId, note);
      setFunnel(out.funnel);
      onFunnelChange?.(out.funnel);
      setCareNote('');
      const spaDone = out.funnel.lead_flow_kind === 'spa_operational';
      setPanelMessage(spaDone ? 'Đã hoàn thành B2' : 'Đã hoàn thành B2 — pre-sales đã mở.');
      onMessage?.('Đã hoàn thành B2');
      await reload();
    }, true);
  }

  const intakeHref = `/crm/intake?lead_id=${leadId}${
    funnel?.presales?.presales.service_slug
      ? `&service_slug=${encodeURIComponent(funnel.presales.presales.service_slug)}`
      : selectedServiceSlug
        ? `&service_slug=${encodeURIComponent(selectedServiceSlug)}`
        : ''
  }`;

  const presalesStage = funnel?.presales?.presales.stage;
  const useConsultWorkspaceTab =
    presalesStage === 'consult' || presalesStage === 'proposal';

  async function applyMarketingPlanResponse(plan: Record<string, unknown>, validationMessages: string[]) {
    setPlanName(String(plan.name ?? ''));
    setPlanNorthStar(String(plan.north_star ?? ''));
    setPlanObjectives(String(plan.objectives ?? ''));
    let sf: Record<string, string> = {};
    try {
      sf = JSON.parse(String(plan.strategy_framework_json ?? '{}')) as Record<string, string>;
    } catch {
      sf = {};
    }
    setPlanStrategy(sf);
    setPlanValidation(validationMessages);
  }

  async function saveMarketingPlan() {
    const out = await patchLeadPresalesMarketingPlan(token, leadId, {
      name: planName,
      north_star: planNorthStar,
      objectives: planObjectives,
      strategy_framework: planStrategy,
    });
    setFunnel(out.funnel);
    onFunnelChange?.(out.funnel);
    setPlanValidation(out.validation.messages ?? []);
    setShowAiDraftBadge(false);
    onMessage?.('Đã lưu KH MKT sơ bộ');
  }

  async function runMarketingPlanAiDraft() {
    setAiPlanDraftBusy(true);
    try {
      const out = await postLeadPresalesMarketingPlanAiDraft(token, leadId);
      setFunnel(out.funnel);
      onFunnelChange?.(out.funnel);
      await applyMarketingPlanResponse(out.plan, out.validation.messages ?? []);
      setShowAiDraftBadge(Boolean(out.ai_draft?.is_ai_draft ?? out.requires_sp_review));
      onMessage?.(out.validation.ok ? 'Đã tạo AI draft KH MKT sơ bộ' : 'AI draft — cần bổ sung thêm trường');
    } finally {
      setAiPlanDraftBusy(false);
    }
  }

  function renderPresalesTasks() {
    if (!funnel?.presales) return null;
    return (funnel.presales?.tasks[funnel.presales.presales.stage] ?? []).map((task) => (
      <PresalesTaskFormCard
        key={task.id}
        stage={funnel.presales!.presales.stage}
        task={task}
        draft={taskDrafts[task.id] ?? {}}
        disabled={busy || !canEdit}
        showAiAssist={
          funnel.presales!.presales.stage === 'consult' && task.ai_prompt_key === 'consult_analysis'
        }
        aiBusy={aiBusyTaskId === task.id}
        onAiAssist={(taskId, formData) =>
          void run(async () => {
            setAiBusyTaskId(taskId);
            try {
              const out = await postLeadPresalesTaskAiAssist(token, leadId, taskId, {
                form_context: formData,
              });
              setFunnel(out.funnel);
              onFunnelChange?.(out.funnel);
              onMessage?.('AI phân tích xong');
            } finally {
              setAiBusyTaskId(null);
            }
          })
        }
        onDraftChange={(taskId, key, value) =>
          setTaskDrafts((prev) => ({
            ...prev,
            [taskId]: { ...(prev[taskId] ?? {}), [key]: value },
          }))
        }
        onValidationError={(msg) => setPanelError(msg)}
        onSaveForm={(taskId, formData) =>
          void run(async () => {
            const out = await patchLeadPresalesTask(token, leadId, taskId, { form_data: formData });
            setFunnel(out.funnel);
            onFunnelChange?.(out.funnel);
          })
        }
        onToggleDone={(taskId, nextDone, formData) =>
          void run(async () => {
            const out = await patchLeadPresalesTask(token, leadId, taskId, {
              is_done: nextDone,
              form_data: formData,
            });
            setFunnel(out.funnel);
            onFunnelChange?.(out.funnel);
            setTaskDrafts((prev) => {
              const next = { ...prev };
              delete next[taskId];
              return next;
            });
            onMessage?.(nextDone ? 'Đã hoàn thành task pre-sales' : 'Đã bỏ hoàn thành task');
          })
        }
      />
    ));
  }

  const r5Form = (
    <PresalesR5PlanForm
      planName={planName}
      planNorthStar={planNorthStar}
      planObjectives={planObjectives}
      planStrategy={planStrategy}
      planValidation={planValidation}
      disabled={busy || aiPlanDraftBusy}
      canEdit={canEdit}
      showAiDraftBadge={showAiDraftBadge}
      canAiDraft={canAiDraft}
      onPlanNameChange={setPlanName}
      onNorthStarChange={setPlanNorthStar}
      onObjectivesChange={setPlanObjectives}
      onStrategyChange={(key, value) => setPlanStrategy((prev) => ({ ...prev, [key]: value }))}
      onSave={() => void run(() => saveMarketingPlan(), true)}
      onAiDraft={() => void run(() => runMarketingPlanAiDraft(), true)}
      aiBusy={aiPlanDraftBusy}
    />
  );

  if (loading && !funnel) {
    return <p className="muted">Đang tải funnel B2 / pre-sales…</p>;
  }
  if (!funnel) return null;

  const flowKind = funnel.lead_flow_kind ?? 'b2b_prospect';
  const isOperationalFlow = flowKind === 'spa_operational';
  const showPresales = showPresalesForFlow(flowKind);
  const panelTitle = isOperationalFlow
    ? 'Funnel CSKH vận hành — B2 Liên hệ'
    : 'Funnel B2 → Pre-sales';

  const b2Stage = funnel.care_pipeline.stages[0];
  const b2Done = Boolean(b2Stage?.done);
  const showM1Card =
    showPresales && !b2Done && leadMeetingPrepEnabled() && canViewLmp(user);
  const showM2Card =
    showPresales &&
    b2Done &&
    Boolean(funnel.presales) &&
    (presalesStage === 'lead' || presalesStage === 'consult') &&
    leadMeetingPrepEnabled() &&
    canViewLmp(user);
  const inReview = funnel.review_queue.active;
  const b2ContactOkReported = Boolean(funnel.care_pipeline.contact_ok_reported);
  const canCompleteB2 = b2ContactOkReported && careNote.trim().length >= 3;
  const negativeReportCount = funnel.care_pipeline.b2_negative_report_count ?? 0;
  const negativeStatusHint = b2NegativeCareHint(negativeCareStatus);
  const negativeSuggestLost = b2NegativeCareSuggestLost(negativeCareStatus);
  const canSubmitNegativeReport = negativeCareReport.trim().length >= 3;

  return (
    <section className="card stack-gap lead-funnel-panel" id="lead-funnel-panel" style={{ marginTop: '1rem' }}>
      <div className="lead-funnel-panel__head">
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{panelTitle}</h2>
        {prepChip && onOpenMeetingPrepTab ? (
          <button type="button" className="lmp-funnel-chip" onClick={() => onOpenMeetingPrepTab()}>
            {prepChip}
          </button>
        ) : null}
      </div>

      {panelError ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {panelError}
        </div>
      ) : null}
      {panelMessage ? (
        <div className="lead-alert lead-alert--success" role="status">
          {panelMessage}
        </div>
      ) : null}

      {showM1Card && !hideM1Card ? (
        <M1FirstCallCard
          token={token}
          leadId={leadId}
          user={user}
          show={showM1Card}
          onOpenTalkTrack={onOpenMeetingPrepTab}
          onMessage={onMessage}
          onError={onError}
        />
      ) : null}

      {showM2Card ? (
        <M2QualifyHandoffCard
          token={token}
          leadId={leadId}
          user={user}
          show={showM2Card}
          intakeHref={intakeHref}
          onOpenMeetingPrep={onOpenMeetingPrepTab}
          onOpenConsultTab={onOpenConsultTab}
          onMessage={onMessage}
          onError={onError}
        />
      ) : null}

      {inReview && (
        <div className="banner banner-warn">
          <strong>Phải tra soát (GDKD)</strong>
          <p style={{ margin: '0.35rem 0 0' }}>
            {funnel.review_queue.message}
            {funnel.review_queue.hours_waiting != null
              ? ` · đã chờ ${funnel.review_queue.hours_waiting}h`
              : ''}
          </p>
          {canAssign ? (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
              <Link href="/crm/leads/review-queue" className="nav-link">
                Mở inbox Phải tra soát →
              </Link>
            </p>
          ) : null}
          {canAssign && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              style={{ marginTop: '0.5rem' }}
              onClick={() =>
                void run(async () => {
                  await releaseLeadReviewQueue(token, leadId, { mode: 'auto', note: 'Release từ ops-web' });
                  onMessage?.('Đã release lead khỏi review queue');
                  await reload();
                })
              }
            >
              Release (auto gán lại AM)
            </button>
          )}
        </div>
      )}

      <PresalesSolutionHandoffBanner funnel={funnel} user={user} />
      <PresalesPolicyBanner funnel={funnel} user={user} token={token} action="release" />
      <PresalesPolicyBanner funnel={funnel} user={user} token={token} action="claim" />

      <div className="card-inner" id="funnel-b2">
        <h3 style={{ marginTop: 0 }}>B2 — {b2Stage?.label ?? 'Liên hệ lần đầu'}</h3>
        <p className="muted" style={{ fontSize: '0.9rem' }}>{b2Stage?.hint}</p>
        <p>
          {showPresales ? (
            <>
              Gate pre-sales:{' '}
              <strong>{funnel.presales_care_gate.complete ? '✓ Mở' : '🔒 Chưa hoàn thành B2'}</strong>
            </>
          ) : (
            <>
              Luồng CSKH vận hành: hoàn thành B2 rồi chốt trạng thái lead (không Pre-sales).
            </>
          )}
          {!funnel.care_pipeline.all_complete && canEdit && !inReview ? (
            <span className="muted" style={{ display: 'block', fontSize: '0.85rem', marginTop: '0.35rem' }}>
              Bước 1 — Liên hệ OK:{' '}
              <strong style={{ color: b2ContactOkReported ? '#15803d' : '#b45309' }}>
                {b2ContactOkReported ? '✓ Đã gửi báo cáo' : 'Chưa gửi'}
              </strong>
            </span>
          ) : null}
        </p>
        {!funnel.care_pipeline.all_complete && canEdit && !inReview && (
          <div className="stack-gap lead-b2-workflow" style={{ marginTop: '0.75rem' }}>
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
              <strong>Bước 1:</strong> Gửi báo cáo 「Liên hệ OK」 · <strong>Bước 2:</strong> Hoàn thành B2 (ghi chú ≥ 3 ký tự).
              Nút bên dưới thực hiện cả hai bước tự động.
            </p>
            <label>
              Báo cáo chăm sóc (Liên hệ OK)
              <textarea
                rows={2}
                value={careReport}
                onChange={(e) => setCareReport(e.target.value)}
                style={{ width: '100%', marginTop: '0.25rem' }}
              />
            </label>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const out = await submitLeadCareReport(token, leadId, { content: careReport });
                  setFunnel(out.funnel);
                  onFunnelChange?.(out.funnel);
                  setPanelMessage('Đã gửi báo cáo Liên hệ OK');
                  onMessage?.('Đã gửi báo cáo Liên hệ OK');
                  await reload();
                })
              }
            >
              Chỉ gửi báo cáo (bước 1)
            </button>
            <label>
              Ghi chú hoàn thành B2 (≥ 3 ký tự)
              <input
                type="text"
                value={careNote}
                onChange={(e) => setCareNote(e.target.value)}
                style={{ width: '100%', marginTop: '0.25rem' }}
              />
            </label>
            {!b2ContactOkReported ? (
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                Cần gửi báo cáo 「Liên hệ OK」(bước 1) trước khi bấm hoàn thành B2.
              </p>
            ) : null}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || !canCompleteB2}
              title={
                !b2ContactOkReported
                  ? 'Gửi báo cáo Liên hệ OK (bước 1) trước'
                  : careNote.trim().length < 3
                    ? 'Ghi chú hoàn thành B2 cần ≥ 3 ký tự'
                    : undefined
              }
              onClick={() => void finishB2Stage()}
            >
              Hoàn thành B2 (bước 1 + 2)
            </button>

            <div
              className="lead-b2-workflow lead-b2-workflow--negative stack-gap"
              style={{
                marginTop: '1rem',
                padding: '0.85rem',
                borderRadius: 8,
                border: '1px solid #fcd34d',
                background: '#fffbeb',
              }}
            >
              <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Liên hệ không OK</h4>
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                Dùng khi chưa nói chuyện được với KH. Báo cáo này <strong>không</strong> hoàn thành B2 — tiếp
                tục gọi lại hoặc chuyển trạng thái <code>lost</code> khi đủ điều kiện.
              </p>
              {negativeReportCount > 0 ? (
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  Đã gửi <strong>{negativeReportCount}</strong> báo cáo không OK
                  {funnel.care_pipeline.last_b2_care_status_label
                    ? ` · gần nhất: ${funnel.care_pipeline.last_b2_care_status_label}`
                    : ''}
                  .
                </p>
              ) : null}
              <label>
                Trạng thái chăm sóc
                <select
                  value={negativeCareStatus}
                  disabled={busy}
                  onChange={(e) => setNegativeCareStatus(e.target.value as B2NegativeCareStatus)}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                >
                  {B2_NEGATIVE_CARE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kênh liên hệ
                <select
                  value={negativeContactType}
                  disabled={busy}
                  onChange={(e) => setNegativeContactType(e.target.value)}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                >
                  {CRM_CARE_CONTACT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Báo cáo chăm sóc (≥ 3 ký tự)
                <textarea
                  rows={2}
                  value={negativeCareReport}
                  onChange={(e) => setNegativeCareReport(e.target.value)}
                  placeholder="VD: Gọi 2 lần — không nghe máy, để lại Zalo"
                  style={{ width: '100%', marginTop: '0.25rem' }}
                />
              </label>
              {negativeStatusHint ? (
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  <strong>Gợi ý:</strong> {negativeStatusHint}
                </p>
              ) : null}
              {negativeSuggestLost ? (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#b45309' }}>
                  Cân nhắc cập nhật form <strong>Trạng thái → lost</strong> + audit note lý do.
                </p>
              ) : null}
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy || !canSubmitNegativeReport}
                title={
                  !canSubmitNegativeReport ? 'Báo cáo cần ≥ 3 ký tự' : undefined
                }
                onClick={() =>
                  void run(async () => {
                    const content = negativeCareReport.trim();
                    const out = await submitLeadCareReport(token, leadId, {
                      content,
                      care_status: negativeCareStatus,
                      care_contact_type: negativeContactType,
                    });
                    setFunnel(out.funnel);
                    onFunnelChange?.(out.funnel);
                    setNegativeCareReport('');
                    const label =
                      B2_NEGATIVE_CARE_OPTIONS.find((o) => o.value === negativeCareStatus)?.label ??
                      negativeCareStatus;
                    setPanelMessage(`Đã gửi báo cáo không OK: ${label}`);
                    onMessage?.(`Đã gửi báo cáo không OK: ${label}`);
                    await reload();
                  })
                }
              >
                Gửi báo cáo không OK
              </button>
            </div>
          </div>
        )}
        {funnel.care_pipeline.all_complete && (
          <p style={{ color: '#15803d', marginBottom: 0 }}>✓ B2 đã hoàn thành</p>
        )}
      </div>

      {showPresales && funnel.presales_on_lead_enabled && funnel.presales_care_gate.complete && !inReview && (
        <div className="card-inner" id="funnel-presales">
          <h3 style={{ marginTop: 0 }}>Pre-sales</h3>
          {!funnel.presales && canEdit && (
            <div className="stack-gap" style={{ marginTop: '0.5rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span className="muted">Dịch vụ marketing (HĐ)</span>
                <select
                  value={selectedServiceSlug}
                  disabled={busy}
                  onChange={(e) => setSelectedServiceSlug(e.target.value)}
                  style={{ width: '100%', maxWidth: '28rem' }}
                >
                  {presalesServiceOptions.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name} ({item.slug})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy || !selectedServiceSlug}
                onClick={() =>
                  void run(async () => {
                    const slug = selectedServiceSlug.trim() || DEFAULT_PRESALES_SLUG;
                    const out = await ensureLeadPresales(token, leadId, slug);
                    setFunnel(out.funnel);
                    onFunnelChange?.(out.funnel);
                    onMessage?.('Đã bắt đầu pre-sales');
                  }, true)
                }
              >
                Bắt đầu pre-sales
              </button>
            </div>
          )}
          {funnel.presales && (
            <>
              <p>
                Giai đoạn: <strong>{funnel.presales.presales.stage}</strong> · Dịch vụ:{' '}
                {funnel.presales.presales.service_slug || '—'}
              </p>
              {useConsultWorkspaceTab ? (
                <div className="banner banner-info stack-gap" style={{ marginTop: '0.5rem' }}>
                  <p style={{ margin: 0 }}>
                    Workspace <strong>Tư vấn / Báo giá</strong> nằm trên tab{' '}
                    <strong>Tư vấn</strong>. Chỉnh sửa R5 (gate G4) tại form bên dưới.
                  </p>
                  {onOpenConsultTab ? (
                    <button type="button" className="btn btn-sm btn-primary" onClick={onOpenConsultTab}>
                      Mở tab Tư vấn →
                    </button>
                  ) : null}
                  {(presalesStage === 'consult' || presalesStage === 'proposal') && r5Form}
                </div>
              ) : (
                <>
                  {renderPresalesTasks()}
                  {funnel.presales.presales.stage === 'lead' && (
                    <p style={{ margin: '0.5rem 0' }}>
                      <Link href={intakeHref} className="nav-link">
                        Mở Lead Intake (BANT) →
                      </Link>
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PresalesConsultBriefPanel } from '@/components/PresalesConsultBriefPanel';
import { PresalesConsultSlaBanner } from '@/components/PresalesConsultSlaBanner';
import { PresalesL2DocsChecklist } from '@/components/PresalesL2DocsChecklist';
import { PresalesR5PreviewPanel } from '@/components/PresalesR5PreviewPanel';
import { PresalesTaskFormCard } from '@/components/PresalesTaskFormCard';
import { WinFieldMask } from '@/components/rbac/WinFieldMask';
import {
  fetchLeadFunnel,
  fetchLeadPresalesMarketingPlan,
  fetchLeadPresalesProposalHandoff,
  patchLeadPresalesL2Docs,
  patchLeadPresalesTask,
  postLeadPresalesConsultPrefill,
  postLeadPresalesTaskAiAssist,
  postPresalesConsultSlaReminder,
  type LeadFunnelSnapshot,
} from '@/lib/api';
import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { presalesStageLabel } from '@/lib/crm/lead-consult-tab.util';
import {
  isConsultWorkspaceReadOnly,
  resolvePresalesSolutionCaps,
} from '@/lib/crm/presales-solution-caps';

interface Props {
  token: string;
  leadId: number;
  user: StoredStaffUser | null;
  funnelSnap: LeadFunnelSnapshot;
  expectedValue?: number | null;
  marginPct?: number | null;
  onFunnelChange: (funnel: LeadFunnelSnapshot) => void;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
  onEditR5?: () => void;
}

export function LeadConsultWorkspace({
  token,
  leadId,
  user,
  funnelSnap,
  expectedValue,
  marginPct,
  onFunnelChange,
  onMessage,
  onError,
  onEditR5,
}: Props) {
  const [funnel, setFunnel] = useState(funnelSnap);
  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [taskDrafts, setTaskDrafts] = useState<Record<number, Record<string, string>>>({});
  const [aiBusyTaskId, setAiBusyTaskId] = useState<number | null>(null);
  const [planName, setPlanName] = useState('');
  const [planNorthStar, setPlanNorthStar] = useState('');
  const [planObjectives, setPlanObjectives] = useState('');
  const [planStrategy, setPlanStrategy] = useState<Record<string, string>>({});
  const [planValidation, setPlanValidation] = useState<string[]>([]);
  const [handoffBlocked, setHandoffBlocked] = useState<string | null>(null);
  const [prefillBusy, setPrefillBusy] = useState(false);

  useEffect(() => {
    setFunnel(funnelSnap);
  }, [funnelSnap]);

  const presalesStage = funnel.presales?.presales.stage;
  const workspaceStage = presalesStage === 'proposal' ? 'proposal' : 'consult';
  const solutionCaps = resolvePresalesSolutionCaps(user);
  const consultReadOnly = isConsultWorkspaceReadOnly(funnel, solutionCaps);
  const canEdit = Boolean(user && hasCap(user, 'crm_leads', 'edit') && solutionCaps.canEditConsult && !consultReadOnly);
  const canPrefill = Boolean(user && hasCap(user, 'crm_board', 'edit') && solutionCaps.canEditConsult);

  const intakeHref = `/crm/intake?lead_id=${leadId}${
    funnel.presales?.presales.service_slug
      ? `&service_slug=${encodeURIComponent(funnel.presales.presales.service_slug)}`
      : ''
  }`;

  const consultTask = useMemo(() => {
    return (funnel.presales?.tasks.consult ?? [])[0] ?? null;
  }, [funnel.presales?.tasks.consult]);

  const loadMarketingPlan = useCallback(async () => {
    if (!funnel.presales) return;
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
    } catch {
      setPlanValidation([]);
    }
  }, [funnel.presales, leadId, token]);

  useEffect(() => {
    void loadMarketingPlan();
  }, [loadMarketingPlan, presalesStage]);

  useEffect(() => {
    if (presalesStage !== 'consult' && presalesStage !== 'proposal') return;
    void fetchLeadPresalesProposalHandoff(token, leadId)
      .then((out) => {
        setHandoffBlocked(out.handoff.can_open ? null : out.handoff.block_reason || 'Chưa thể mở Proposal');
      })
      .catch(() => setHandoffBlocked(null));
  }, [leadId, presalesStage, token, funnel]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setPanelError('');
    try {
      await action();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thao tác thất bại';
      setPanelError(msg);
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  }

  function applyFunnel(next: LeadFunnelSnapshot) {
    setFunnel(next);
    onFunnelChange(next);
  }

  async function onPrefill() {
    if (!canPrefill) return;
    setPrefillBusy(true);
    try {
      const out = await postLeadPresalesConsultPrefill(token, leadId, { overwrite: false });
      onMessage?.(`Prefill: ${Number(out.filled ?? 0)} field`);
      if (out.funnel) {
        applyFunnel(out.funnel as LeadFunnelSnapshot);
      } else {
        applyFunnel(await fetchLeadFunnel(token, leadId));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Prefill thất bại';
      setPanelError(msg);
    } finally {
      setPrefillBusy(false);
    }
  }

  async function onProposalHandoff() {
    const out = await fetchLeadPresalesProposalHandoff(token, leadId);
    if (!out.handoff.can_open) {
      throw new Error(out.handoff.block_reason || 'Chưa thể mở Proposal');
    }
    window.location.href = out.handoff.proposals_href;
  }

  async function onAiAssist() {
    if (!consultTask) return;
    const formData = { ...(consultTask.form_data ?? {}), ...(taskDrafts[consultTask.id] ?? {}) };
    setAiBusyTaskId(consultTask.id);
    try {
      const out = await postLeadPresalesTaskAiAssist(token, leadId, consultTask.id, {
        form_context: formData,
      });
      applyFunnel(out.funnel);
      onMessage?.('AI phân tích xong');
    } finally {
      setAiBusyTaskId(null);
    }
  }

  function renderStageTasks() {
    if (!funnel.presales || !presalesStage) return null;
    return (funnel.presales.tasks[presalesStage] ?? []).map((task) => (
      <PresalesTaskFormCard
        key={task.id}
        stage={presalesStage}
        task={task}
        draft={taskDrafts[task.id] ?? {}}
        disabled={busy || !canEdit}
        showAiAssist={
          presalesStage === 'consult' && task.ai_prompt_key === 'consult_analysis'
        }
        aiBusy={aiBusyTaskId === task.id}
        onAiAssist={(taskId, formData) =>
          void run(async () => {
            setAiBusyTaskId(taskId);
            try {
              const out = await postLeadPresalesTaskAiAssist(token, leadId, taskId, {
                form_context: formData,
              });
              applyFunnel(out.funnel);
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
            applyFunnel(out.funnel);
          })
        }
        onToggleDone={(taskId, nextDone, formData) =>
          void run(async () => {
            const out = await patchLeadPresalesTask(token, leadId, taskId, {
              is_done: nextDone,
              form_data: formData,
            });
            applyFunnel(out.funnel);
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

  const aiDisabled =
    busy ||
    !canEdit ||
    !consultTask ||
    presalesStage !== 'consult' ||
    consultTask.ai_prompt_key !== 'consult_analysis';

  return (
    <section
      className="lead-consult-workspace card stack-gap"
      id="funnel-presales"
      data-testid="lead-consult-workspace"
      aria-label="Workspace Tư vấn pre-sales"
    >
      <header className="lead-consult-workspace__header">
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
          Workspace · {presalesStageLabel(presalesStage)}
        </h2>
        <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
          Dịch vụ: <strong>{funnel.presales?.presales.service_slug || '—'}</strong>
        </p>
      </header>

      {panelError ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {panelError}
        </div>
      ) : null}

      {consultReadOnly ? (
        <div className="banner banner-info" data-testid="consult-solution-readonly-banner">
          <strong>Giai đoạn Solution — bạn theo dõi, không chỉnh sửa</strong>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
            Consult, L2, AI và KHMKT sơ bộ do Solution/MKT phụ trách. AM tiếp tục sau khi Solution Trả Sales — Báo giá.
          </p>
        </div>
      ) : null}

      {funnel.presales?.consult_proposal_sla ? (
        <PresalesConsultSlaBanner
          sla={funnel.presales.consult_proposal_sla}
          disabled={busy || !canEdit}
          busy={busy}
          onReminder={() =>
            void run(async () => {
              const out = await postPresalesConsultSlaReminder(token, leadId, {});
              applyFunnel(out.funnel);
              onMessage?.('Đã tạo nhắc SLA trên activity lead');
            })
          }
        />
      ) : null}

      <div className="lead-consult-workspace__grid">
        <div className="lead-consult-workspace__main stack-gap">
          <section className="page-card stack-gap-sm">
            <h4 className="h6">Giá trị dự kiến (ABAC)</h4>
            <div className="flex-gap">
              <span className="muted">Expected value:</span>
              <WinFieldMask user={user} value={expectedValue} variant="financial" />
              <span className="muted">Margin %:</span>
              <WinFieldMask user={user} value={marginPct} variant="financial" />
            </div>
          </section>

          {funnel.presales?.l2_docs && presalesStage === 'consult' ? (
            <PresalesL2DocsChecklist
              view={funnel.presales.l2_docs}
              disabled={busy || !canEdit}
              busy={busy}
              onToggle={(key, checked) =>
                void run(async () => {
                  const out = await patchLeadPresalesL2Docs(token, leadId, { [key]: checked });
                  applyFunnel(out.funnel);
                })
              }
            />
          ) : null}

          {renderStageTasks()}

          <PresalesR5PreviewPanel
            planName={planName}
            planNorthStar={planNorthStar}
            planObjectives={planObjectives}
            planStrategy={planStrategy}
            planValidation={planValidation}
            stage={workspaceStage}
            onEditR5={onEditR5}
          />
        </div>

        {user ? (
          <aside className="lead-consult-workspace__sidebar">
            <details className="lead-consult-workspace__brief-collapsible" open>
              <summary>Brief &amp; Intake</summary>
              <PresalesConsultBriefPanel
                token={token}
                user={user}
                leadId={leadId}
                onPrefilled={() => {
                  void loadMarketingPlan();
                  onMessage?.('Đã prefill consult');
                }}
              />
              <p style={{ margin: '0.75rem 0 0' }}>
                <Link href={intakeHref} className="nav-link">
                  Mở Lead Intake (BANT) →
                </Link>
              </p>
            </details>
          </aside>
        ) : null}
      </div>

      <footer className="lead-consult-workspace__sticky" aria-label="Thao tác Consult">
        <div className="lead-consult-workspace__sticky-inner">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={prefillBusy || !canPrefill || presalesStage !== 'consult'}
            onClick={() => void onPrefill()}
          >
            {prefillBusy ? 'Prefill…' : 'Prefill từ Lead/Intake'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={aiDisabled || aiBusyTaskId != null}
            onClick={() => void run(() => onAiAssist())}
          >
            {aiBusyTaskId != null ? 'AI…' : 'AI Hỗ trợ'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={busy || !canEdit || presalesStage !== 'consult' || Boolean(handoffBlocked)}
            title={handoffBlocked ?? undefined}
            onClick={() => void run(() => onProposalHandoff())}
          >
            Tạo Proposal từ Consult →
          </button>
          <span className="muted lead-consult-workspace__sticky-hint">
            CTA <strong>Chuyển giai đoạn</strong> trên stepper phía trên
          </span>
        </div>
      </footer>
    </section>
  );
}

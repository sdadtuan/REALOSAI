'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IntakeAiSummaryPanel } from '@/components/crm/intake/IntakeAiSummaryPanel';
import { IntakeFormActions } from '@/components/crm/intake/IntakeFormActions';
import { IntakeBantSection } from '@/components/crm/intake/IntakeBantSection';
import { IntakeCompleteConfirmModal } from '@/components/crm/intake/IntakeCompleteConfirmModal';
import { IntakeDiscoverySection } from '@/components/crm/intake/IntakeDiscoverySection';
import { IntakeValidationErrors } from '@/components/crm/intake/IntakeValidationErrors';
import { CrmFunnelStepper } from '@/components/crm/funnel-stepper';
import { IntakeLeadContextCard } from '@/components/crm/intake/IntakeLeadContextCard';
import { IntakePrepSummaryCard } from '@/components/crm/intake/IntakePrepSummaryCard';
import { IntakeSessionSidebar } from '@/components/crm/intake/IntakeSessionSidebar';
import { IntakeCommitmentsSection } from '@/components/crm/intake/IntakeCommitmentsSection';
import { IntakeRedFlagsSection } from '@/components/crm/intake/IntakeRedFlagsSection';
import { IntakeStakeholderMatrix } from '@/components/crm/intake/IntakeStakeholderMatrix';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import {
  advanceLeadPresales,
  completeIntakeSession,
  createIntakeSession,
  deleteIntakeSession,
  fetchIntakeDefinitionBySlug,
  fetchIntakeDefinitions,
  fetchIntakeSessions,
  fetchIntakeStats,
  fetchLead,
  fetchLeadFunnel,
  fetchLeadPresalesConsultGate,
  generateIntakeAiSummary,
  patchIntakeSession,
  reopenIntakeSession,
  staffMe,
  staffRefresh,
  type IntakeSessionRow,
  type LeadFunnelSnapshot,
  type LeadRow,
} from '@/lib/api';
import type { ConsultGateState, FunnelPrimaryAction, IntakeStepSummary } from '@/lib/crm/funnel-stepper.types';
import {
  INTAKE_DECISION_OPTIONS,
  intakeModeLabel,
  intakeStatusLabel,
} from '@/lib/crm/intake-labels';
import {
  buildCreateIntakeSessionBody,
  findDraftSession,
  intakeFormFromSession,
  pickInitialSessionId,
} from '@/lib/crm/intake-session-form';
import {
  bantRowsFromDefinition,
  computeBantTotal,
  type BantKey,
  type BantRowUi,
} from '@/lib/crm/intake-bant';
import { buildIntakeAnswersPatch } from '@/lib/crm/intake-answers';
import {
  commitmentsToPatch,
  defaultCommitments,
  type IntakeCommitmentRow,
} from '@/lib/crm/intake-commitments';
import {
  emptyDiscoveryForMode,
  normalizeIntakeMode,
  questionItemsForMode,
  toggleDiscoveryQuestion,
  updateDiscoveryResponse,
  type DiscoveryChecklistState,
  type IntakeDefinitionUi,
  type IntakeSessionMode,
} from '@/lib/crm/intake-discovery';
import {
  emptyRedFlags,
  redFlagItemsFromDefinition,
  toggleRedFlag,
  type IntakeRedFlagsState,
} from '@/lib/crm/intake-red-flags';
import {
  defaultStakeholders,
  stakeholdersToPatch,
  type IntakeStakeholderRow,
} from '@/lib/crm/intake-stakeholders';
import {
  intakeValidationErrors,
  intakeValidationWarnings,
  validateIntakeComplete,
  type IntakeValidationIssue,
} from '@/lib/crm/intake-validation';
import { useIntakeAutosave } from '@/lib/crm/use-intake-autosave';
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

export function IntakeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = Number(searchParams.get('lead_id') || 0);
  const lifecycleId = Number(searchParams.get('lifecycle_id') || 0);

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [sessions, setSessions] = useState<IntakeSessionRow[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [bant, setBant] = useState<Record<string, number>>({});
  const [decision, setDecision] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [contactName, setContactName] = useState('');
  const [need, setNeed] = useState('');
  const [discovery, setDiscovery] = useState<DiscoveryChecklistState>(emptyDiscoveryForMode('phone'));
  const [stakeholders, setStakeholders] = useState<IntakeStakeholderRow[]>(defaultStakeholders());
  const [commitments, setCommitments] = useState<IntakeCommitmentRow[]>(defaultCommitments());
  const [redFlags, setRedFlags] = useState<IntakeRedFlagsState>(emptyRedFlags());
  const [intakeDefinition, setIntakeDefinition] = useState<IntakeDefinitionUi | null>(null);
  const [bantRows, setBantRows] = useState<BantRowUi[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [funnelSnap, setFunnelSnap] = useState<LeadFunnelSnapshot | null>(null);
  const [consultGate, setConsultGate] = useState<ConsultGateState | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [stepperBusy, setStepperBusy] = useState(false);
  const [aiSummaryBusy, setAiSummaryBusy] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completeWarnings, setCompleteWarnings] = useState<IntakeValidationIssue[]>([]);
  const [validationErrors, setValidationErrors] = useState<IntakeValidationIssue[]>([]);
  const saveInFlightRef = useRef(false);

  const contextOk = useMemo(
    () => (Number.isFinite(leadId) && leadId > 0) || (Number.isFinite(lifecycleId) && lifecycleId > 0),
    [leadId, lifecycleId],
  );

  const active = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId],
  );

  const canCreate = useMemo(() => hasCap(user, 'crm_leads', 'edit'), [user]);
  const formDisabled = active?.status === 'completed' || saving;
  const sessionMode = normalizeIntakeMode(active?.mode);
  const discoveryQuestionItems = useMemo(
    () => questionItemsForMode(intakeDefinition, sessionMode),
    [intakeDefinition, sessionMode],
  );
  const redFlagItems = useMemo(
    () =>
      redFlagItemsFromDefinition(intakeDefinition?.red_flags, intakeDefinition?.red_flag_items),
    [intakeDefinition],
  );
  const formSnapshot = useMemo(
    () =>
      JSON.stringify({
        sessionId: activeId,
        bant,
        decision,
        decisionReason,
        contactName,
        need,
        discovery,
        stakeholders,
        commitments,
        redFlags,
      }),
    [activeId, bant, decision, decisionReason, contactName, need, discovery, stakeholders, commitments, redFlags],
  );
  const liveBantTotal = useMemo(() => computeBantTotal(bant), [bant]);

  const intakeSummary = useMemo((): IntakeStepSummary => {
    const hasDraft = sessions.some((s) => s.status === 'draft');
    const latestCompleted = [...sessions]
      .filter((s) => s.status === 'completed')
      .sort((a, b) => b.id - a.id)[0];
    return {
      has_draft: hasDraft,
      latest_completed: latestCompleted
        ? {
            id: latestCompleted.id,
            decision: latestCompleted.decision ?? '',
            bant_total: Number(latestCompleted.bant_total ?? 0),
            completed_at: latestCompleted.updated_at ?? '',
          }
        : undefined,
    };
  }, [sessions]);

  const applySession = useCallback(
    (session: IntakeSessionRow | null) => {
      if (!session) {
        setActiveId(null);
        setBant({});
        setDecision('');
        setDecisionReason('');
        setContactName('');
        setNeed('');
        setDiscovery(emptyDiscoveryForMode('phone'));
        setStakeholders(defaultStakeholders());
        setCommitments(defaultCommitments());
        setRedFlags(emptyRedFlags());
        return;
      }
      setActiveId(session.id);
      const form = intakeFormFromSession(session, intakeDefinition);
      setBant(form.bant);
      setDecision(form.decision);
      setDecisionReason(form.decisionReason);
      setContactName(form.contactName);
      setNeed(form.need);
      setDiscovery(form.discovery);
      setStakeholders(form.stakeholders);
      setCommitments(form.commitments);
      setRedFlags(form.redFlags);
    },
    [intakeDefinition],
  );

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
      if (!hasCap(me, 'crm_leads', 'view')) {
        setError('Không có quyền xem trang khảo sát BANT');
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

  const loadConsultGate = useCallback(async (access: string) => {
    if (leadId <= 0) {
      setConsultGate(null);
      return;
    }
    setGateLoading(true);
    try {
      const out = await fetchLeadPresalesConsultGate(access, leadId);
      setConsultGate(out.gate);
    } catch {
      setConsultGate(null);
    } finally {
      setGateLoading(false);
    }
  }, [leadId]);

  const loadFunnel = useCallback(async (access: string) => {
    if (leadId <= 0) {
      setFunnelSnap(null);
      return;
    }
    try {
      const snap = await fetchLeadFunnel(access, leadId);
      setFunnelSnap(snap);
    } catch {
      setFunnelSnap(null);
    }
  }, [leadId]);

  const refreshStepperData = useCallback(
    async (access: string) => {
      await Promise.all([loadFunnel(access), loadConsultGate(access)]);
    },
    [loadConsultGate, loadFunnel],
  );

  const loadLeadContext = useCallback(async (access: string) => {
    if (leadId <= 0) {
      setLead(null);
      return;
    }
    try {
      const row = await fetchLead(access, leadId);
      setLead(row);
    } catch {
      setLead(null);
    }
  }, [leadId]);

  const loadSessions = useCallback(
    async (access: string, preferredId?: number | null) => {
      const rows = await fetchIntakeSessions(access, {
        lead_id: leadId > 0 ? leadId : undefined,
        lifecycle_id: lifecycleId > 0 ? lifecycleId : undefined,
      });
      setSessions(rows);
      const nextId = pickInitialSessionId(rows, preferredId ?? activeId);
      const next = rows.find((s) => s.id === nextId) ?? null;
      applySession(next);
    },
    [leadId, lifecycleId, activeId, applySession],
  );

  useEffect(() => {
    if (!contextOk) {
      setError('Cần lead_id hoặc lifecycle_id trong URL');
      setLoading(false);
      return;
    }
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      setError('');
      try {
        await fetchIntakeDefinitions(access);
        const definition = await fetchIntakeDefinitionBySlug(access, '_common');
        setIntakeDefinition({
          slug: definition.slug,
          title: definition.title,
          phone_questions: definition.phone_questions ?? [],
          inperson_questions: definition.inperson_questions ?? [],
          phone_question_items: definition.phone_question_items,
          inperson_question_items: definition.inperson_question_items,
          red_flags: definition.red_flags,
          red_flag_items: definition.red_flag_items,
          schema_version: definition.schema_version,
        });
        setBantRows(bantRowsFromDefinition(definition.bant_rows));
        const statsOut = await fetchIntakeStats(access);
        setStats(statsOut);
        await Promise.all([
          loadLeadContext(access),
          refreshStepperData(access),
          loadSessions(access, null),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải trang khảo sát thất bại');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [contextOk, ensureAuth, leadId, lifecycleId]);

  function onSelectSession(session: IntakeSessionRow) {
    applySession(session);
    setSidebarOpen(false);
    setMessage('');
  }

  async function onDeleteSession(session: IntakeSessionRow) {
    if (session.status !== 'draft') return;
    if (!window.confirm(`Xóa phiên nháp #${session.id}? Hành động không thể hoàn tác.`)) return;

    const access = getAccessToken();
    if (!access || !canCreate) return;

    setSaving(true);
    setError('');
    setMessage('');
    try {
      await deleteIntakeSession(access, session.id);
      const rows = await fetchIntakeSessions(access, {
        lead_id: leadId > 0 ? leadId : undefined,
        lifecycle_id: lifecycleId > 0 ? lifecycleId : undefined,
      });
      setSessions(rows);
      const fallbackId = rows.find((s) => s.status === 'completed')?.id ?? rows[0]?.id ?? null;
      const nextId = session.id === activeId ? fallbackId : pickInitialSessionId(rows, activeId);
      applySession(rows.find((s) => s.id === nextId) ?? null);
      await refreshStepperData(access);
      setMessage(`Đã xóa phiên nháp #${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa phiên thất bại');
    } finally {
      setSaving(false);
    }
  }

  function confirmCreateIfDraftExists(): boolean {
    const draft = findDraftSession(sessions);
    if (!draft) return true;
    return window.confirm(
      `Đang có phiên nháp #${draft.id} (${intakeModeLabel(draft.mode)}). Tạo phiên mới? Phiên nháp cũ vẫn được giữ.`,
    );
  }

  async function onCreate(mode: 'phone' | 'in_person') {
    const access = getAccessToken();
    if (!access || !user) return;
    if (!canCreate) {
      setError('Không có quyền tạo phiên khảo sát');
      return;
    }
    if (!confirmCreateIfDraftExists()) return;

    setSaving(true);
    setError('');
    try {
      const created = await createIntakeSession(
        access,
        buildCreateIntakeSessionBody({
          leadId,
          lifecycleId,
          mode,
          lead,
        }),
      );
      await loadSessions(access, created.id);
      await refreshStepperData(access);
      setSidebarOpen(false);
      setMessage(`Đã tạo phiên #${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo phiên thất bại');
    } finally {
      setSaving(false);
    }
  }

  const performSave = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!active || !user || saveInFlightRef.current) return false;
      const access = getAccessToken();
      if (!access) return false;

      saveInFlightRef.current = true;
      if (!options?.silent) {
        setSaving(true);
        setError('');
        setMessage('');
      }

      try {
        await patchIntakeSession(access, active.id, {
          bant_json: bant,
          decision,
          decision_reason: decisionReason,
          contact_name: contactName,
          answers_json: buildIntakeAnswersPatch({
            existing: active.answers_json,
            need,
            discovery: { ...discovery, mode: sessionMode },
            redFlags,
          }),
          stakeholders_json: stakeholdersToPatch(stakeholders),
          commitments_json: commitmentsToPatch(commitments),
        });
        await loadSessions(access, active.id);
        if (leadId > 0) await refreshStepperData(access);
        if (!options?.silent) setMessage('Đã lưu phiên nháp');
        return true;
      } catch (err) {
        if (!options?.silent) {
          setError(err instanceof Error ? err.message : 'Lưu thất bại');
        }
        throw err;
      } finally {
        saveInFlightRef.current = false;
        if (!options?.silent) setSaving(false);
      }
    },
    [
      active,
      bant,
      contactName,
      decision,
      decisionReason,
      discovery,
      leadId,
      loadSessions,
      need,
      redFlags,
      refreshStepperData,
      sessionMode,
      stakeholders,
      commitments,
      user,
    ],
  );

  const autosaveEnabled =
    Boolean(active?.status === 'draft' && canCreate && !loading && !saving);

  const autosave = useIntakeAutosave({
    enabled: autosaveEnabled,
    paused: completeModalOpen || saving,
    snapshot: formSnapshot,
    onSave: async () => {
      await performSave({ silent: true });
    },
  });

  useEffect(() => {
    if (!active || !intakeDefinition) return;
    const form = intakeFormFromSession(active, intakeDefinition);
    setDiscovery(form.discovery);
    setStakeholders(form.stakeholders);
    setCommitments(form.commitments);
    setRedFlags(form.redFlags);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rehydrate structured answers when definition loads
  }, [intakeDefinition?.schema_version, active?.id]);

  useEffect(() => {
    autosave.syncSnapshot(formSnapshot);
    setValidationErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset autosave baseline when switching session
  }, [activeId]);

  useEffect(() => {
    if (validationErrors.length === 0) return;
    setValidationErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear blocking errors after edits
  }, [formSnapshot]);

  function buildValidationInput() {
    return {
      contactName,
      need,
      bant,
      decision,
      decisionReason,
      sessionMode,
      discoveryChecked: discovery.checked,
      discoveryResponses: discovery.responses,
      discoveryTotal: discoveryQuestionItems.length,
      questionItems: discoveryQuestionItems,
      redFlagsChecked: redFlags.checked,
      stakeholders,
    };
  }

  async function onSave() {
    try {
      const ok = await performSave();
      if (ok) autosave.markSavedNow(formSnapshot);
    } catch {
      // performSave sets error message
    }
  }

  function onCompleteClick() {
    if (!active) return;
    const issues = validateIntakeComplete(buildValidationInput());
    const errors = intakeValidationErrors(issues);
    const warnings = intakeValidationWarnings(issues);
    setValidationErrors(errors);
    if (errors.length > 0) return;
    setCompleteWarnings(warnings);
    setCompleteModalOpen(true);
  }

  async function onConfirmComplete() {
    if (!active || !user) return;
    const access = getAccessToken();
    if (!access) return;

    setCompleteModalOpen(false);
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await performSave({ silent: true });
      autosave.markSavedNow(formSnapshot);
      const updated = await completeIntakeSession(access, active.id);
      await loadSessions(access, updated.id);
      await refreshStepperData(access);
      setMessage('Đã hoàn thành phiên khảo sát — xem stepper phía trên để chuyển Tư vấn nếu gate OK');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hoàn thành thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onStepperPrimaryAction(action: FunnelPrimaryAction) {
    if (leadId <= 0) return;
    const access = getAccessToken();
    if (!access) return;

    if (action.kind === 'create_intake_session') {
      setSidebarOpen(true);
      setMessage('Chọn + Gọi điện hoặc + Gặp trực tiếp ở cột trái để tạo phiên Intake');
      return;
    }

    if (action.kind === 'focus_intake_form') {
      document.querySelector('.intake-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action.kind !== 'advance_presales') return;

    setStepperBusy(true);
    setError('');
    setMessage('');
    try {
      let overrideReason: string | undefined;
      if (action.requiresOverride) {
        const reason = window.prompt('Director override — nhập lý do chuyển Consult:');
        if (!reason?.trim()) {
          setError('Cần lý do override để chuyển Tư vấn');
          return;
        }
        overrideReason = reason.trim();
      }

      await advanceLeadPresales(access, leadId, {
        confirm: true,
        override_reason: overrideReason,
      });
      await refreshStepperData(access);
      router.push(`/crm/leads/${leadId}#funnel-presales`);
      setMessage(`Đã chuyển giai đoạn Tư vấn — cuộn tới task Consult trên Lead #${leadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chuyển Tư vấn thất bại');
    } finally {
      setStepperBusy(false);
    }
  }

  function onBantDecisionBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
    autosave.saveOnBlur();
  }

  async function onReopen() {
    if (!active || !user) return;
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await reopenIntakeSession(access, active.id);
      await loadSessions(access, updated.id);
      setMessage('Đã mở lại phiên nháp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mở lại thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onChangeSessionMode(nextMode: IntakeSessionMode) {
    if (!active || nextMode === sessionMode) return;
    if (
      !window.confirm(
        'Đổi loại phiên sẽ reset checklist câu hỏi cho bộ câu mới. Tiếp tục?',
      )
    ) {
      return;
    }
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    try {
      const nextDiscovery = emptyDiscoveryForMode(nextMode);
      setDiscovery(nextDiscovery);
      await patchIntakeSession(access, active.id, {
        mode: nextMode,
        answers_json: buildIntakeAnswersPatch({
          existing: active.answers_json,
          need,
          discovery: nextDiscovery,
          redFlags,
        }),
      });
      await loadSessions(access, active.id);
      setMessage(`Đã chuyển sang ${intakeModeLabel(nextMode)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đổi loại phiên thất bại');
    } finally {
      setSaving(false);
    }
  }

  function onToggleDiscoveryQuestion(questionKey: string, next: boolean) {
    setDiscovery((prev) => toggleDiscoveryQuestion(prev, questionKey, next, sessionMode));
  }

  function onDiscoveryResponseChange(
    questionKey: string,
    patch: Parameters<typeof updateDiscoveryResponse>[2],
  ) {
    setDiscovery((prev) => updateDiscoveryResponse(prev, questionKey, patch, sessionMode));
  }

  function onToggleRedFlag(key: string, next: boolean) {
    setRedFlags((prev) => toggleRedFlag(prev, key, next));
  }

  async function onAiSummary() {
    if (!active || !user) return;
    const access = getAccessToken();
    if (!access) return;
    setAiSummaryBusy(true);
    setError('');
    setMessage('');
    try {
      await generateIntakeAiSummary(access, active.id);
      await loadSessions(access, active.id);
      setMessage('Đã tạo tóm tắt AI');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tóm tắt AI thất bại');
    } finally {
      setAiSummaryBusy(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  const systemSessionCount =
    stats && typeof stats.total_sessions === 'number' ? stats.total_sessions : null;

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Khảo sát BANT "BANT Intake"' },
      ]}
    >
      <PageToolbar
        title='Khảo sát BANT "BANT Intake"'
        subtitle='Phiên qualify lead B2B — Ngân sách, Thẩm quyền, Nhu cầu, Thời hạn ("Budget, Authority, Need, Timeline")'
      />

      <div className="page-card intake-page">
        {leadId > 0 ? (
          <p className="intake-page__context">
            <Link href={`/crm/leads/${leadId}`} className="nav-link">
              ← Lead #{leadId}
            </Link>
          </p>
        ) : (
          <p className="muted intake-page__context">Vòng đời dịch vụ #{lifecycleId}</p>
        )}

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="intake-page__message">{message}</p> : null}

        {!loading && contextOk ? (
          <div className={`intake-layout${sidebarOpen ? ' intake-layout--sidebar-open' : ''}`}>
            <button
              type="button"
              className="btn btn-secondary btn-sm intake-layout__sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-expanded={sidebarOpen}
            >
              Phiên {active ? `#${active.id}` : '—'} · Chọn phiên
            </button>

            {sidebarOpen ? (
              <button
                type="button"
                className="intake-layout__backdrop"
                aria-label="Đóng danh sách phiên"
                onClick={() => setSidebarOpen(false)}
              />
            ) : null}

            <aside
              className={`intake-layout__sidebar${sidebarOpen ? ' intake-layout__sidebar--open' : ''}`}
            >
              <IntakeSessionSidebar
                sessions={sessions}
                activeId={activeId}
                saving={saving}
                canCreate={canCreate}
                systemSessionCount={systemSessionCount}
                onSelect={onSelectSession}
                onDelete={(session) => void onDeleteSession(session)}
                onCreatePhone={() => void onCreate('phone')}
                onCreateInPerson={() => void onCreate('in_person')}
              />
            </aside>

            <div
              className={`intake-layout__main stack-gap${leadId > 0 ? ' intake-layout__main--stepper' : ''}`}
            >
              {leadId > 0 && lead ? (
                <IntakeLeadContextCard lead={lead} leadHref={`/crm/leads/${leadId}`} />
              ) : null}

              {leadId > 0 ? (
                <IntakePrepSummaryCard token={getAccessToken() ?? ''} leadId={leadId} />
              ) : null}

              {leadId > 0 ? (
                <CrmFunnelStepper
                  leadId={leadId}
                  funnel={funnelSnap}
                  consultGate={consultGate}
                  intakeSummary={intakeSummary}
                  context="intake"
                  gateLoading={gateLoading}
                  actionBusy={stepperBusy || saving}
                  onRefreshGate={() => {
                    const access = getAccessToken();
                    if (access) void refreshStepperData(access);
                  }}
                  onPrimaryAction={(action) => void onStepperPrimaryAction(action)}
                />
              ) : null}

              <details className="intake-help">
                <summary>Hướng dẫn sử dụng trang này</summary>
                <ol>
                  <li>
                    Chọn phiên ở cột trái (hoặc nút <strong>Chọn phiên</strong> trên mobile), hoặc tạo{' '}
                    <strong>+ Gọi điện</strong> / <strong>+ Gặp trực tiếp</strong>.
                  </li>
                  <li>
                    Tick câu hỏi và điền <strong>câu trả lời ngắn</strong> (câu quan trọng gợi ý bắt buộc trước Complete).
                  </li>
                  <li>
                    Ghi <strong>Red flags</strong>, <strong>Stakeholder matrix</strong>,{' '}
                    <strong>Cam kết KH</strong> khi đủ thông tin.
                  </li>
                  <li>Chấm 6 tiêu chí BANT (radio 1–5, tổng /30) — tự lưu sau 30s hoặc khi rời khỏi mục BANT.</li>
                  <li>
                    Xem <strong>D. AI tóm tắt</strong> sau khi lưu discovery/BANT (nút Tóm tắt AI trên phiên nháp).
                  </li>
                  <li>
                    Chọn <strong>Quyết định &quot;Decision&quot;</strong> và{' '}
                    <strong>Lý do &quot;Reason&quot;</strong>, rồi <strong>Hoàn thành phiên</strong>.
                  </li>
                  <li>
                    Khi gate OK trên <strong>Tiến trình Pre-sales</strong>, bấm{' '}
                    <strong>Chuyển → Tư vấn</strong> (vẫn hiện khi còn phiên nháp nếu đã có phiên Go hoàn thành).
                  </li>
                  <li>
                    Phiên nháp tạo nhầm: bấm <strong>Xóa</strong> ở cột trái (chỉ phiên Nháp).
                  </li>
                </ol>
              </details>

              {active ? (
                <div className="intake-form stack-gap">
                  <header className="intake-form__head">
                    <h2 className="intake-form__title">
                      Phiên #{active.id} · {intakeModeLabel(active.mode)} ·{' '}
                      {intakeStatusLabel(active.status)}
                    </h2>
                    <p className="muted intake-form__subtitle">
                      BANT {liveBantTotal}/30
                      {active.decision ? ` · ${active.decision}` : ''}
                    </p>
                  </header>

                  <IntakeDiscoverySection
                    mode={sessionMode}
                    questionItems={discoveryQuestionItems}
                    checked={discovery.checked}
                    responses={discovery.responses}
                    notes={discovery.notes}
                    contactName={contactName}
                    need={need}
                    disabled={formDisabled}
                    canChangeMode={active.status === 'draft' && canCreate}
                    onModeChange={(mode) => void onChangeSessionMode(mode)}
                    onContactNameChange={setContactName}
                    onNeedChange={setNeed}
                    onToggleQuestion={onToggleDiscoveryQuestion}
                    onResponseChange={onDiscoveryResponseChange}
                    onNotesChange={(value) =>
                      setDiscovery((prev) => ({ ...prev, mode: sessionMode, notes: value }))
                    }
                  />

                  <IntakeRedFlagsSection
                    items={redFlagItems}
                    state={redFlags}
                    disabled={formDisabled}
                    onToggle={onToggleRedFlag}
                    onNotesChange={(value) => setRedFlags((prev) => ({ ...prev, notes: value }))}
                  />

                  <section className="intake-bant-section stack-gap" aria-label='Chấm BANT "BANT scoring"'>
                    <header className="intake-form__head">
                      <h2 className="intake-form__title">C. BANT + Quyết định</h2>
                    </header>

                    <div className="intake-bant-decision-pane" onBlur={onBantDecisionBlur}>
                      <IntakeBantSection
                        bant={bant}
                        bantRows={bantRows}
                        decision={decision}
                        disabled={formDisabled}
                        onBantChange={(key: BantKey, value: number) =>
                          setBant((prev) => ({ ...prev, [key]: value }))
                        }
                      />

                      <IntakeValidationErrors issues={validationErrors} />

                      <label className="intake-field">
                        <span className="muted">Quyết định &quot;Decision&quot;</span>
                        <select
                          className="kpi-select"
                          value={decision}
                          onChange={(e) => setDecision(e.target.value)}
                          disabled={formDisabled}
                        >
                          {INTAKE_DECISION_OPTIONS.map((d) => (
                            <option key={d.value || 'empty'} value={d.value}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="intake-field">
                        <span className="muted">Lý do &quot;Reason&quot;</span>
                        <input
                          className="kpi-input"
                          value={decisionReason}
                          onChange={(e) => setDecisionReason(e.target.value)}
                          disabled={formDisabled}
                        />
                      </label>
                    </div>
                  </section>

                  <IntakeStakeholderMatrix
                    rows={stakeholders}
                    disabled={formDisabled}
                    onChange={(index, patch) =>
                      setStakeholders((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
                      )
                    }
                  />

                  <IntakeCommitmentsSection
                    rows={commitments}
                    disabled={formDisabled}
                    onChange={(index, patch) =>
                      setCommitments((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
                      )
                    }
                  />

                  <IntakeAiSummaryPanel
                    summary={active.ai_summary ?? ''}
                    disabled={formDisabled || aiSummaryBusy}
                    busy={aiSummaryBusy}
                    canGenerate={active.status === 'draft' && canCreate}
                    onGenerate={() => void onAiSummary()}
                  />

                  <IntakeFormActions
                    isCompleted={active.status === 'completed'}
                    saving={saving}
                    autosaveStatus={autosave.status}
                    autosaveSavedAt={autosave.savedAt}
                    autosaveDirty={autosave.dirty}
                    onSave={() => void onSave()}
                    onComplete={onCompleteClick}
                    onReopen={() => void onReopen()}
                  />
                </div>
              ) : (
                <p className="muted">Chưa có phiên — tạo phiên mới ở cột trái.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <IntakeCompleteConfirmModal
        open={completeModalOpen}
        busy={saving}
        sessionLabel={active ? `phiên #${active.id}` : 'phiên'}
        bantTotal={liveBantTotal}
        decision={decision}
        discoveryChecked={discovery.checked}
        discoveryTotal={discoveryQuestionItems.length}
        warnings={completeWarnings}
        onCancel={() => setCompleteModalOpen(false)}
        onConfirm={() => void onConfirmComplete()}
      />
    </StaffPageShell>
  );
}

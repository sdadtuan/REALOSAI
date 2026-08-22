'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
import { LeadFunnelPanel } from '@/components/LeadFunnelPanel';
import { LeadConsultWorkspace } from '@/components/LeadConsultWorkspace';
import { LeadPresalesFunnelStepper } from '@/components/crm/funnel-stepper';
import { LeadB2bSalesFlowBar, type LeadContractFlowSummary } from '@/components/LeadB2bSalesFlowBar';
import { LeadAttributionChips } from '@/components/crm/LeadAttributionChips';
import { LeadAuditPanel } from '@/components/crm/LeadAuditPanel';
import { LeadContactActions } from '@/components/crm/LeadContactActions';
import { B2bIntelligencePanel } from '@/components/crm/B2bIntelligencePanel';
import { LeadMobileCallBar } from '@/components/crm/LeadMobileCallBar';
import { LeadContractPanel } from '@/components/LeadContractPanel';
import { LeadDetailHero } from '@/components/crm/LeadDetailHero';
import { LeadSlaCarePanel } from '@/components/crm/LeadSlaCarePanel';
import { ClosedLoopPanel } from '@/components/crm/ClosedLoopPanel';
import { LeadCopilotPanel } from '@/components/ai/LeadCopilotPanel';
import { LeadEntityTimelinePanel } from '@/components/crm/LeadEntityTimelinePanel';
import {
  leadFlowKindLabel,
  resolveLeadFlowKindFromLead,
  showB2bSalesFlowBar,
  showContractForFlow,
} from '@/lib/crm/lead-flow-kind';
import {
  LEAD_CONSULT_TAB_HASH,
  showLeadConsultTab,
} from '@/lib/crm/lead-consult-tab.util';
import { aiCopilotEnabled } from '@/lib/ai-flags';
import { dealRoomEnabled } from '@/lib/crm/deal-room-flags';
import { leadMeetingPrepEnabled } from '@/lib/crm/lmp-flags';
import { LeadMeetingPrepPanel } from '@/app/crm/leads/meeting-prep/LeadMeetingPrepPanel';
import { PostCallDebriefModal } from '@/app/crm/leads/meeting-prep/PostCallDebriefModal';
import { ShortCallDebriefModal } from '@/app/crm/leads/meeting-prep/ShortCallDebriefModal';
import { MentionComposer } from '@/components/staff/MentionComposer';
import {
  assignLead,
  createLeadActivity,
  fetchCatalogBundle,
  fetchLead,
  fetchLeadFunnel,
  fetchLeadActivities,
  fetchLeadAttribution,
  fetchLeadAudit,
  fetchLeadCopilotContext,
  fetchLeadStatusOptions,
  patchLeadLegacy,
  staffMe,
  staffRefresh,
  type CatalogStaffOption,
  type CatalogServiceRow,
  type LeadActivityRow,
  type LeadAttributionData,
  type LeadAuditBundle,
  type LeadCopilotContext,
  type LeadFunnelSnapshot,
  type LeadRow,
  type LeadStatusOptionsResponse,
} from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  canViewLmp,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

const ACTIVITY_TYPES = [
  { value: 'note', label: 'Ghi chú' },
  { value: 'call', label: 'Gọi điện' },
  { value: 'email', label: 'Email' },
  { value: 'message', label: 'Tin nhắn' },
  { value: 'meeting', label: 'Họp' },
  { value: 'proposal', label: 'Báo giá' },
  { value: 'task', label: 'Công việc' },
  { value: 'reminder', label: 'Nhắc việc' },
];

type LeadDetailTab = 'detail' | 'consult' | 'activity' | 'ai' | 'prep';
type B2bOverviewTab = 'overview' | 'consult' | 'meeting-prep';

async function copyLeadContact(value: string, label: string, onDone: (msg: string) => void) {
  const trimmed = value.trim();
  if (!trimmed) return;
  try {
    await navigator.clipboard.writeText(trimmed);
    onDone(`Đã copy ${label} vào clipboard.`);
  } catch {
    onDone(`Không copy được ${label}.`);
  }
}

function useLeadDetailLayout() {
  const [layout, setLayout] = useState({ desktop: false, tablet: false, mobile: true });

  useEffect(() => {
    const mqDesktop = window.matchMedia('(min-width: 1280px)');
    const mqTablet = window.matchMedia('(min-width: 1024px)');

    const sync = () => {
      const w = window.innerWidth;
      setLayout({
        desktop: w >= 1280,
        tablet: w >= 1024 && w < 1280,
        mobile: w < 1024,
      });
    };

    sync();
    mqDesktop.addEventListener('change', sync);
    mqTablet.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      mqDesktop.removeEventListener('change', sync);
      mqTablet.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  return layout;
}

function useNetworkOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return online;
}

export default function CrmLeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const leadId = Number(params.id);
  const presetServiceSlug = searchParams.get('service_slug')?.trim() || undefined;

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [attribution, setAttribution] = useState<LeadAttributionData | null>(null);
  const [staffOptions, setStaffOptions] = useState<CatalogStaffOption[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogServiceRow[]>([]);
  const [activities, setActivities] = useState<LeadActivityRow[]>([]);
  const [audit, setAudit] = useState<LeadAuditBundle | null>(null);
  const [status, setStatus] = useState('');
  const [auditNote, setAuditNote] = useState('');
  const [assignToId, setAssignToId] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [activityType, setActivityType] = useState('note');
  const [activityContent, setActivityContent] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [copilotDrawerOpen, setCopilotDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<LeadDetailTab>('detail');
  const [b2bPane, setB2bPane] = useState<B2bOverviewTab>('overview');
  const [copilotMessage, setCopilotMessage] = useState('');
  const [funnelSnap, setFunnelSnap] = useState<LeadFunnelSnapshot | null>(null);
  const [contractSummary, setContractSummary] = useState<LeadContractFlowSummary | null>(null);
  const [contractRefresh, setContractRefresh] = useState(0);
  const [statusOptionsApi, setStatusOptionsApi] = useState<LeadStatusOptionsResponse | null>(null);
  const [statusOptionsLoading, setStatusOptionsLoading] = useState(false);
  const [copilotContext, setCopilotContext] = useState<LeadCopilotContext | null>(null);
  const [copilotContextLoading, setCopilotContextLoading] = useState(false);
  const [callDebriefOpen, setCallDebriefOpen] = useState(false);
  const [callDebriefActivityId, setCallDebriefActivityId] = useState<number | null>(null);
  const [terminalDebriefOpen, setTerminalDebriefOpen] = useState(false);
  const layout = useLeadDetailLayout();
  const online = useNetworkOnline();
  const copilotOn = aiCopilotEnabled();

  const leadFlowKind = useMemo(
    () =>
      statusOptionsApi?.lead_flow_kind ??
      (lead ? resolveLeadFlowKindFromLead(lead, funnelSnap) : 'b2b_prospect'),
    [lead, funnelSnap, statusOptionsApi?.lead_flow_kind],
  );
  const statusDropdownOptions = statusOptionsApi?.allowed_next ?? [];
  const statusHints = statusOptionsApi?.hints ?? [];
  const showB2bFlow = showB2bSalesFlowBar(leadFlowKind);
  const showContractPanel = showContractForFlow(leadFlowKind);
  const showConsultTab = showB2bFlow && showLeadConsultTab(funnelSnap);
  const showLmpTab = leadMeetingPrepEnabled() && showB2bFlow;
  const prepDeepLink = searchParams.get('prep') === '1';

  const reloadFunnel = useCallback(async (access: string) => {
    if (!showB2bFlow) return;
    try {
      const snap = await fetchLeadFunnel(access, leadId);
      setFunnelSnap(snap);
    } catch {
      /* funnel optional until B2 complete */
    }
  }, [leadId, showB2bFlow]);

  const openConsultTab = useCallback(() => {
    setB2bPane('consult');
    setMobileTab('consult');
    if (typeof window !== 'undefined') {
      const base = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', `${base}${LEAD_CONSULT_TAB_HASH}`);
      requestAnimationFrame(() => {
        document.getElementById('funnel-presales')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  const openMeetingPrepTab = useCallback(() => {
    setB2bPane('meeting-prep');
    setMobileTab('prep');
    requestAnimationFrame(() => {
      document.getElementById('lmp-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const openOverviewTab = useCallback(() => {
    setB2bPane('overview');
    setMobileTab('detail');
  }, []);

  const openR5EditOnOverview = useCallback(() => {
    openOverviewTab();
    requestAnimationFrame(() => {
      document.getElementById('funnel-presales-r5')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [openOverviewTab]);

  const reloadStatusOptions = useCallback(async (access: string) => {
    setStatusOptionsLoading(true);
    try {
      const opts = await fetchLeadStatusOptions(access, leadId);
      setStatusOptionsApi(opts);
      setStatus((prev) => {
        const allowedIds = new Set(opts.allowed_next.map((row) => row.id));
        if (allowedIds.has(prev)) return prev;
        return opts.current_status;
      });
    } catch {
      setStatusOptionsApi(null);
    } finally {
      setStatusOptionsLoading(false);
    }
  }, [leadId]);

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
        setError('Không có quyền xem CRM leads');
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

  const reloadTimeline = useCallback(async (access: string) => {
    const [acts, aud] = await Promise.all([
      fetchLeadActivities(access, leadId),
      fetchLeadAudit(access, leadId),
    ]);
    setActivities(acts);
    setAudit(aud);
  }, [leadId]);

  const reloadCopilotContext = useCallback(async (access: string) => {
    setCopilotContextLoading(true);
    try {
      const ctx = await fetchLeadCopilotContext(access, leadId);
      setCopilotContext(ctx);
      if (ctx.catalog?.services?.length) {
        setCatalogServices(
          ctx.catalog.services.map((svc, index) => ({
            id: index + 1,
            slug: svc.slug,
            name: svc.name,
            description: svc.description,
            sort_order: index,
            active: true,
          })),
        );
      }
    } catch {
      setCopilotContext(null);
    } finally {
      setCopilotContextLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (!Number.isFinite(leadId) || leadId <= 0) {
      setError('Lead ID không hợp lệ');
      setLoading(false);
      return;
    }
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      setError('');
      try {
        const [row, catalog, attr] = await Promise.all([
          fetchLead(access, leadId),
          fetchCatalogBundle(access).catch(() => null),
          fetchLeadAttribution(access, leadId).catch(() => null),
        ]);
        setLead(row);
        setAttribution(attr);
        setStatus(row.status || 'moi');
        if (catalog?.staff?.length) {
          setStaffOptions(catalog.staff);
        }
        if (catalog?.services?.length) {
          setCatalogServices(catalog.services.filter((service) => service.active));
        }
        await reloadTimeline(access);
        await reloadStatusOptions(access);
        await reloadCopilotContext(access);
        if (showB2bSalesFlowBar(resolveLeadFlowKindFromLead(row, null))) {
          await reloadFunnel(access);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải lead thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, leadId, reloadCopilotContext, reloadFunnel, reloadTimeline, reloadStatusOptions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncHash = () => {
      if (window.location.hash === LEAD_CONSULT_TAB_HASH && showLeadConsultTab(funnelSnap)) {
        openConsultTab();
      }
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [funnelSnap, openConsultTab]);

  useEffect(() => {
    if (prepDeepLink && showLmpTab) {
      openMeetingPrepTab();
    }
  }, [prepDeepLink, showLmpTab, openMeetingPrepTab]);

  useEffect(() => {
    if (!showConsultTab && b2bPane === 'consult') {
      setB2bPane('overview');
    }
    if (!showConsultTab && mobileTab === 'consult') {
      setMobileTab('detail');
    }
    if (!showLmpTab && b2bPane === 'meeting-prep') {
      setB2bPane('overview');
    }
    if (!showLmpTab && mobileTab === 'prep') {
      setMobileTab('detail');
    }
  }, [showConsultTab, showLmpTab, b2bPane, mobileTab]);

  useEffect(() => {
    const access = getAccessToken();
    if (!access || !lead) return;
    void reloadStatusOptions(access);
  }, [lead?.status, lead?.id, funnelSnap?.care_pipeline.all_complete, reloadStatusOptions]);

  async function onSaveStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !lead) return;
    if (!hasCap(user, 'crm_leads', 'edit')) {
      setError('Không có quyền sửa trạng thái');
      return;
    }
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    if (status.trim() === lead.status) {
      setMessage('Trạng thái không đổi');
      return;
    }
    const terminalStatuses = ['chot', 'won', 'post_sale', 'lost'];
    if (terminalStatuses.includes(status.trim()) && auditNote.trim().length < 3) {
      setError('Cần ghi chú audit ≥ 3 ký tự khi chốt / won / lost.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await patchLeadLegacy(access, leadId, {
        status: status.trim(),
        audit_note: auditNote.trim(),
      });
      setLead(updated);
      setStatus(updated.status || status);
      setAuditNote('');
      setMessage('Đã lưu trạng thái + audit SQLite');
      await reloadTimeline(access);
      await reloadStatusOptions(access);
      await reloadCopilotContext(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !lead) return;
    if (!hasCap(user, 'crm_leads', 'assign')) {
      setError('Không có quyền phân lead');
      return;
    }
    const toId = Number(assignToId);
    const reason = assignReason.trim();
    if (!Number.isFinite(toId) || toId <= 0) {
      setError('Chọn nhân viên nhận lead');
      return;
    }
    if (reason.length < 3) {
      setError('Cần ghi lý do phân lại (≥ 3 ký tự)');
      return;
    }
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }

    setAssigning(true);
    setError('');
    setMessage('');
    try {
      const updated = await assignLead(access, leadId, { to_user_id: toId, reason });
      setLead(updated);
      setAssignToId('');
      setAssignReason('');
      setMessage('Đã phân lead');
      await reloadTimeline(access);
      await reloadCopilotContext(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Phân lead thất bại');
    } finally {
      setAssigning(false);
    }
  }

  async function onAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!hasCap(user, 'crm_leads', 'edit')) {
      setError('Không có quyền thêm hoạt động');
      return;
    }
    const content = activityContent.trim();
    if (!content) {
      setError('Nội dung hoạt động không được trống');
      return;
    }
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }

    setAddingActivity(true);
    setError('');
    setMessage('');
    try {
      const activity = await createLeadActivity(access, leadId, {
        activity_type: activityType,
        content,
      });
      setActivityContent('');
      setMessage('Đã thêm hoạt động');
      await reloadTimeline(access);
      await reloadCopilotContext(access);
      if (['call', 'email', 'message', 'meeting'].includes(activityType)) {
        await reloadStatusOptions(access);
      }
      if (
        activityType === 'call' &&
        leadMeetingPrepEnabled() &&
        canViewLmp(user)
      ) {
        const leadStatus = String(lead?.status ?? status).trim().toLowerCase();
        if (leadStatus === 'chot' || leadStatus === 'lost') {
          setTerminalDebriefOpen(true);
        } else {
          setCallDebriefActivityId(activity.id);
          setCallDebriefOpen(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm hoạt động thất bại');
    } finally {
      setAddingActivity(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  const ownerLabel = useMemo(() => {
    if (!lead?.owner_id) return null;
    const staff = staffOptions.find((s) => s.id === lead.owner_id);
    return staff ? staff.name : `#${lead.owner_id}`;
  }, [lead?.owner_id, staffOptions]);

  if (!user) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  const accessToken = getAccessToken();
  const b2StageDone = Boolean(funnelSnap?.care_pipeline.stages[0]?.done);
  const showSlaSciUnifiedPanel =
    Boolean(accessToken) &&
    (leadFlowKind === 'spa_operational' ||
      (showB2bFlow && Boolean(funnelSnap?.presales_on_lead_enabled) && !b2StageDone));
  const useMobileTabs = layout.mobile;
  const showCopilotInline =
    copilotOn && !!lead && !loading && !!accessToken && !!user && layout.desktop;
  const showCopilotSheet =
    copilotOn && !!lead && !loading && !!accessToken && !!user && layout.mobile && mobileTab === 'ai';
  const showCopilotDrawer =
    copilotOn && !!lead && !loading && !!accessToken && !!user && layout.tablet && copilotDrawerOpen;
  const hideTimelinePane = useMobileTabs && mobileTab !== 'activity';
  const hideOverviewContent =
    (showConsultTab && b2bPane === 'consult' && !useMobileTabs) ||
    (showLmpTab && b2bPane === 'meeting-prep' && !useMobileTabs);
  const hideConsultWorkspace =
    (useMobileTabs && mobileTab !== 'consult') || (!useMobileTabs && b2bPane !== 'consult');
  const hideMeetingPrep =
    (useMobileTabs && mobileTab !== 'prep') || (!useMobileTabs && b2bPane !== 'meeting-prep');
  const showOverviewMain = useMobileTabs ? mobileTab === 'detail' : !hideOverviewContent;
  const showConsultMain = showConsultTab && (useMobileTabs ? mobileTab === 'consult' : !hideConsultWorkspace);
  const showMeetingPrepMain = showLmpTab && (useMobileTabs ? mobileTab === 'prep' : !hideMeetingPrep);
  const hideMainPane =
    useMobileTabs && mobileTab !== 'detail' && mobileTab !== 'consult' && mobileTab !== 'prep';
  const hideFooterPane =
    useMobileTabs && mobileTab !== 'detail' && mobileTab !== 'consult' && mobileTab !== 'prep';

  function renderCopilotPanel(variant: 'column' | 'drawer' | 'sheet', onCloseDrawer?: () => void) {
    if (!online) {
      return (
        <div
          className="lead-copilot-offline-banner"
          role="alert"
          data-testid="copilot-offline-banner"
        >
          Copilot cần kết nối mạng
        </div>
      );
    }
    if (!lead || !user || !accessToken) return null;
    return (
      <LeadCopilotPanel
        token={accessToken}
        leadId={leadId}
        lead={lead}
        user={user}
        activities={activities}
        selectedActivityId={selectedActivityId}
        onSelectActivity={setSelectedActivityId}
        onCopilotError={setCopilotMessage}
        onActivityCreated={() => {
          const access = getAccessToken();
          if (access) {
            void reloadTimeline(access);
            void reloadCopilotContext(access);
          }
        }}
        variant={variant}
        onCloseDrawer={onCloseDrawer}
        copilotContext={copilotContext}
        copilotContextLoading={copilotContextLoading}
      />
    );
  }

  function onCopyContact(value: string, label: string) {
    void copyLeadContact(value, label, setMessage);
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      width="full"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Leads', href: '/crm/leads' },
        { label: lead?.full_name || `#${leadId}` },
      ]}
    >
      <div className={`lead-detail-page${showCopilotSheet ? ' lead-detail-page--copilot-sheet' : ''}`}>

      {useMobileTabs ? (
        <div className="lead-detail-tabs" role="tablist" aria-label="Lead detail sections">
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'detail'}
            className={mobileTab === 'detail' ? 'is-active' : ''}
            onClick={() => {
              setMobileTab('detail');
              setB2bPane('overview');
            }}
          >
            Chi tiết
          </button>
          {showConsultTab ? (
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === 'consult'}
              className={mobileTab === 'consult' ? 'is-active' : ''}
              onClick={() => {
                setMobileTab('consult');
                setB2bPane('consult');
              }}
            >
              Tư vấn
            </button>
          ) : null}
          {showLmpTab ? (
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === 'prep'}
              className={mobileTab === 'prep' ? 'is-active' : ''}
              onClick={() => openMeetingPrepTab()}
            >
              Prep
            </button>
          ) : null}
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'activity'}
            className={mobileTab === 'activity' ? 'is-active' : ''}
            onClick={() => setMobileTab('activity')}
          >
            Hoạt động
          </button>
          {copilotOn ? (
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === 'ai'}
              className={mobileTab === 'ai' ? 'is-active' : ''}
              onClick={() => setMobileTab('ai')}
            >
              AI
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? <p className="lead-empty-state lead-empty-state--page">Đang tải lead #{leadId}…</p> : null}
      {error ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="lead-alert lead-alert--success" role="status">
          {message}
        </div>
      ) : null}
      {copilotMessage ? <p className="lead-copilot-hint">{copilotMessage}</p> : null}

      {lead && !loading ? (
        <div className="lead-detail-layout">
          <LeadDetailHero
            lead={lead}
            ownerLabel={ownerLabel}
            flowKind={leadFlowKind}
            flowLabel={leadFlowKindLabel(leadFlowKind)}
          />

          {showSlaSciUnifiedPanel ? (
            <LeadSlaCarePanel
              token={accessToken!}
              leadId={leadId}
              status={status}
              onAuditNoteSuggest={(text) => setAuditNote(text)}
              onReload={() => {
                const access = getAccessToken();
                if (access) {
                  void reloadTimeline(access);
                  void reloadCopilotContext(access);
                }
              }}
              copilotContext={copilotContext}
              copilotLoading={copilotContextLoading}
              onOpenMeetingPrep={showLmpTab ? openMeetingPrepTab : undefined}
            />
          ) : null}

          {accessToken && leadFlowKind === 'spa_operational' ? (
            <ClosedLoopPanel
              token={accessToken}
              leadId={leadId}
              status={status}
              closedLoop={copilotContext?.closed_loop ?? null}
              copilotLoading={copilotContextLoading}
            />
          ) : null}

          <div
            className={`lead-detail-grid${showCopilotInline ? ' lead-detail-grid--with-copilot' : ''}`}
          >
          <div
            className={`lead-detail-main ${hideMainPane ? 'lead-detail-pane--hidden' : ''}`}
          >
            <LeadAttributionChips attribution={attribution} />

            {showB2bFlow ? (
              <>
                <LeadB2bSalesFlowBar leadId={leadId} funnel={funnelSnap} contract={contractSummary} />
                {accessToken ? (
                  <B2bIntelligencePanel token={accessToken} leadId={leadId} />
                ) : null}
              </>
            ) : (
              <div className="banner banner-info lead-spa-flow-banner" style={{ marginTop: '0.75rem' }}>
                <strong>Luồng CSKH vận hành 24h</strong>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
                  Liên hệ trong SLA → hẹn gặp nếu cần → chốt dịch vụ client. Không dùng Pre-sales / HĐ agency.
                </p>
              </div>
            )}

            {accessToken && showB2bFlow ? (
              <LeadPresalesFunnelStepper
                token={accessToken}
                leadId={leadId}
                user={user}
                funnel={funnelSnap}
                onFunnelChange={setFunnelSnap}
                onOpenConsultWorkspace={showConsultTab ? openConsultTab : undefined}
                onMessage={setMessage}
                onError={setError}
              />
            ) : null}

            {accessToken && showB2bFlow && dealRoomEnabled() && funnelSnap?.presales ? (
              <div className="deal-room-entry-banner">
                <div>
                  <strong>Deal Room</strong>
                  <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                    1 màn: Consult + L1 R5 + báo giá + gates — chuẩn bị buổi chốt.
                  </p>
                </div>
                <Link href={`/crm/leads/${leadId}/deal-room`} className="btn btn-sm btn-primary">
                  Mở Deal Room →
                </Link>
              </div>
            ) : null}

            {(showConsultTab || showLmpTab) && !useMobileTabs ? (
              <div className="lead-b2b-subtabs" role="tablist" aria-label="Pre-sales workspace">
                <button
                  type="button"
                  role="tab"
                  aria-selected={b2bPane === 'overview'}
                  className={b2bPane === 'overview' ? 'is-active' : ''}
                  onClick={() => setB2bPane('overview')}
                >
                  Tổng quan
                </button>
                {showLmpTab ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={b2bPane === 'meeting-prep'}
                    className={b2bPane === 'meeting-prep' ? 'is-active' : ''}
                    onClick={() => openMeetingPrepTab()}
                  >
                    Sales Cockpit
                  </button>
                ) : null}
                {showConsultTab ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={b2bPane === 'consult'}
                    className={b2bPane === 'consult' ? 'is-active' : ''}
                    onClick={() => openConsultTab()}
                  >
                    Tư vấn
                  </button>
                ) : null}
              </div>
            ) : null}

            {showOverviewMain ? (
              <>
            {lead.phone ? (
              layout.mobile && mobileTab === 'detail' ? null : (
                <LeadContactActions
                  phone={lead.phone}
                  onCopy={onCopyContact}
                  leadId={lead.id}
                  accessToken={accessToken}
                />
              )
            ) : null}

            {accessToken ? (
              <LeadFunnelPanel
                token={accessToken}
                leadId={leadId}
                user={user}
                serviceSlug={presetServiceSlug}
                syncFunnel={funnelSnap}
                fetchOnMount={funnelSnap == null}
                serviceOptions={catalogServices.map((service) => ({
                  slug: service.slug,
                  name: service.name,
                }))}
                onOpenConsultTab={showConsultTab ? openConsultTab : undefined}
                onOpenMeetingPrepTab={showLmpTab ? openMeetingPrepTab : undefined}
                onMessage={setMessage}
                onFunnelChange={setFunnelSnap}
                onFunnelUpdated={() => {
                  setContractRefresh((n) => n + 1);
                  const access = getAccessToken();
                  if (access) void reloadTimeline(access);
                }}
                hideM1Card={showSlaSciUnifiedPanel && leadMeetingPrepEnabled()}
              />
            ) : null}

            {accessToken && showContractPanel ? (
              <LeadContractPanel
                token={accessToken}
                leadId={leadId}
                user={user}
                refreshToken={contractRefresh}
                onMessage={setMessage}
                onLoaded={setContractSummary}
              />
            ) : null}
              </>
            ) : null}

            {showConsultMain && accessToken && funnelSnap ? (
              <LeadConsultWorkspace
                token={accessToken}
                leadId={leadId}
                user={user}
                funnelSnap={funnelSnap}
                expectedValue={lead?.expected_value}
                marginPct={lead?.margin_pct}
                onFunnelChange={setFunnelSnap}
                onMessage={setMessage}
                onError={setError}
                onEditR5={openR5EditOnOverview}
              />
            ) : null}

            {showMeetingPrepMain && accessToken ? (
              <LeadMeetingPrepPanel
                token={accessToken}
                leadId={leadId}
                user={user}
                leadStatus={lead?.status}
                autoFocus={prepDeepLink}
                onMessage={setMessage}
                onError={setError}
              />
            ) : null}
          </div>

          <aside
            className={`lead-detail-sidebar ${hideTimelinePane ? 'lead-detail-pane--hidden' : ''}`}
          >
            <div className="lead-panel lead-panel--activity">
              <div className="lead-panel__head">
                <h3 className="lead-panel__title">Timeline hoạt động</h3>
                <p className="lead-panel__subtitle">Chọn activity để tóm tắt trong AI Copilot</p>
              </div>
              {activities.length === 0 ? (
                <p className="lead-empty-state">Chưa có hoạt động.</p>
              ) : (
                <ul className="lead-activity-list">
                  {activities.map((a) => (
                    <li
                      key={a.id}
                      className={`lead-activity-item ${selectedActivityId === a.id ? 'is-selected' : ''}`}
                      onClick={() => setSelectedActivityId(a.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedActivityId(a.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selectedActivityId === a.id}
                    >
                      <div className="lead-activity-item__meta">
                        <time>{a.created_at?.slice(0, 16)}</time>
                        <span className="lead-activity-item__type">
                          {a.activity_type_label || a.activity_type}
                        </span>
                        {a.user_name ? <span>{a.user_name}</span> : null}
                      </div>
                      <div className="lead-activity-item__content">{a.content || '—'}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {accessToken ? <LeadEntityTimelinePanel token={accessToken} leadId={leadId} /> : null}

            <LeadAuditPanel audit={audit} />
          </aside>

          {showCopilotInline ? renderCopilotPanel('column') : null}
          </div>

          <section
            className={`lead-detail-footer ${hideFooterPane ? 'lead-detail-pane--hidden' : ''}`}
            aria-label="Thao tác lead"
          >
            <div className="lead-actions-grid">
              <div className="lead-panel lead-panel--action">
                <div className="lead-panel__head">
                  <h3 className="lead-panel__title">Trạng thái lead</h3>
                </div>
                <form className="lead-form" id="lead-status-form" onSubmit={(e) => void onSaveStatus(e)}>
                  <label className="lead-field">
                    <span className="lead-field__label">Trạng thái</span>
                    <select
                      className="lead-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      disabled={
                        !hasCap(user, 'crm_leads', 'edit') ||
                        saving ||
                        statusOptionsLoading ||
                        statusDropdownOptions.length <= 1
                      }
                    >
                      {statusDropdownOptions.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.label}
                        </option>
                      ))}
                    </select>
                    {statusOptionsLoading ? (
                      <span className="muted" style={{ fontSize: '0.82rem' }}>
                        Đang tải trạng thái được phép…
                      </span>
                    ) : null}
                    {statusHints.length > 0 ? (
                      <ul
                        className="muted"
                        style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem', fontSize: '0.82rem' }}
                      >
                        {statusHints.map((hint) => (
                          <li key={hint}>{hint}</li>
                        ))}
                      </ul>
                    ) : null}
                  </label>
                  <label className="lead-field">
                    <span className="lead-field__label">
                      Ghi chú audit
                      {['chot', 'won', 'post_sale', 'lost'].includes(status) ? ' (bắt buộc ≥3 ký tự)' : ' (tùy chọn)'}
                    </span>
                    <input
                      className="lead-input"
                      value={auditNote}
                      onChange={(e) => setAuditNote(e.target.value)}
                      placeholder="Lý do đổi trạng thái"
                      disabled={!hasCap(user, 'crm_leads', 'edit') || saving}
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn btn-sm lead-form__submit"
                    disabled={saving || !hasCap(user, 'crm_leads', 'edit')}
                  >
                    {saving ? 'Đang lưu…' : 'Lưu trạng thái'}
                  </button>
                </form>
              </div>

              <div className="lead-panel lead-panel--action">
                <div className="lead-panel__head">
                  <h3 className="lead-panel__title">Phân lead</h3>
                </div>
                <form className="lead-form" onSubmit={(e) => void onAssign(e)}>
                  <label className="lead-field">
                    <span className="lead-field__label">Nhân viên</span>
                    <select
                      className="lead-select"
                      value={assignToId}
                      onChange={(e) => setAssignToId(e.target.value)}
                      disabled={!hasCap(user, 'crm_leads', 'assign') || assigning}
                    >
                      <option value="">— Chọn —</option>
                      {staffOptions.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name} (#{s.id})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="lead-field">
                    <span className="lead-field__label">Lý do</span>
                    <input
                      className="lead-input"
                      value={assignReason}
                      onChange={(e) => setAssignReason(e.target.value)}
                      placeholder="Bắt buộc (≥ 3 ký tự)"
                      disabled={!hasCap(user, 'crm_leads', 'assign') || assigning}
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn btn-sm lead-form__submit"
                    disabled={assigning || !hasCap(user, 'crm_leads', 'assign')}
                  >
                    {assigning ? 'Đang phân…' : 'Phân lead'}
                  </button>
                </form>
              </div>

              <div className="lead-panel lead-panel--action">
                <div className="lead-panel__head">
                  <h3 className="lead-panel__title">Thêm hoạt động</h3>
                </div>
                <form className="lead-form" id="lead-activity-form" onSubmit={(e) => void onAddActivity(e)}>
                  <label className="lead-field">
                    <span className="lead-field__label">Loại</span>
                    <select
                      className="lead-select"
                      value={activityType}
                      onChange={(e) => setActivityType(e.target.value)}
                      disabled={!hasCap(user, 'crm_leads', 'edit') || addingActivity}
                    >
                      {ACTIVITY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="lead-field">
                    <span className="lead-field__label">Nội dung</span>
                    <MentionComposer
                      token={getAccessToken()}
                      value={activityContent}
                      onChange={setActivityContent}
                      disabled={!hasCap(user, 'crm_leads', 'edit') || addingActivity}
                      rows={3}
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn btn-sm lead-form__submit"
                    disabled={addingActivity || !hasCap(user, 'crm_leads', 'edit')}
                  >
                    {addingActivity ? 'Đang thêm…' : 'Thêm hoạt động'}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {layout.mobile && mobileTab === 'detail' && lead?.phone ? (
        <LeadMobileCallBar
          phone={lead.phone}
          leadId={lead.id}
          accessToken={accessToken}
          onCopy={onCopyContact}
        />
      ) : null}

      {showCopilotSheet ? (
        <>
          <div
            className="lead-copilot-backdrop lead-copilot-backdrop--sheet"
            role="presentation"
            onClick={() => setMobileTab('detail')}
          />
          {renderCopilotPanel('sheet', () => setMobileTab('detail'))}
        </>
      ) : null}

      {showCopilotDrawer ? (
        <>
          <div
            className="lead-copilot-backdrop"
            role="presentation"
            onClick={() => setCopilotDrawerOpen(false)}
          />
          {renderCopilotPanel('drawer', () => setCopilotDrawerOpen(false))}
        </>
      ) : null}

      {layout.tablet && copilotOn && lead && !loading && !copilotDrawerOpen ? (
        <button
          type="button"
          className="lead-copilot-fab"
          onClick={() => setCopilotDrawerOpen(true)}
          aria-label="Mở AI Copilot"
        >
          AI Copilot
        </button>
      ) : null}
      {accessToken && leadMeetingPrepEnabled() && canViewLmp(user) ? (
        <>
          <ShortCallDebriefModal
            token={accessToken}
            leadId={leadId}
            activityId={callDebriefActivityId}
            open={callDebriefOpen}
            onClose={() => {
              setCallDebriefOpen(false);
              setCallDebriefActivityId(null);
            }}
            onSubmitted={() => setMessage('Đã gửi debrief nhanh — cảm ơn AM')}
            onError={(msg) => setError(msg)}
          />
          <PostCallDebriefModal
            token={accessToken}
            leadId={leadId}
            leadStatus={lead?.status ?? status}
            open={terminalDebriefOpen}
            onClose={() => setTerminalDebriefOpen(false)}
            onSubmitted={() => setMessage('Đã gửi debrief — cảm ơn AM')}
            onError={(msg) => setError(msg)}
          />
        </>
      ) : null}
      </div>
    </StaffPageShell>
  );
}

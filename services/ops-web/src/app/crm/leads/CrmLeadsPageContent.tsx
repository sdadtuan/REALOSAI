'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmLeadsImportExport } from '@/components/crm/CrmLeadsImportExport';
import { LeadsColumnPicker } from '@/components/crm/LeadsColumnPicker';
import { CrmLeadsList } from '@/components/crm/CrmLeadsList';
import { LeadKanbanBoard } from '@/components/crm/LeadKanbanBoard';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { WinFilterChips } from '@/components/win';
import {
  BulkActionBar,
  FilterBar,
  FilterBarActions,
  FilterBarSearch,
  PageFooter,
  PageToolbar,
  SegmentedControl,
  StaffPageShell,
} from '@/components/layout';
import { PresalesConsultSlaSummaryCard } from '@/components/PresalesConsultSlaSummaryCard';
import { PresalesFunnelMetricsCard } from '@/components/PresalesFunnelMetricsCard';
import {
  fetchLeads,
  bulkAssignLeads,
  fetchCrmStaffList,
  fetchLeadLookupOptions,
  fetchPresalesConsultSlaSummary,
  fetchPresalesFunnelMetrics,
  fetchReviewQueueCount,
  staffMe,
  staffRefresh,
} from '@/lib/api';
import type { CrmLeadLookupOption, CrmStaffRow, LeadRow, PresalesConsultSlaSummary, PresalesFunnelMetricsResponse } from '@/lib/api';
import { aiCopilotEnabled, canUseAiCopilot } from '@/lib/ai-flags';
import { useLeadScoresMap } from '@/hooks/useLeadScoresMap';
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
import { statusOptionsForFlowKind, type LeadFlowKind } from '@/lib/crm/lead-flow-kind';
import {
  leadFlowKindQuery,
  leadsListHref,
  leadsListSubtitle,
  leadsListTitle,
  leadsNewHref,
  type CrmLeadsFlowScope,
} from '@/lib/crm/lead-flow-routes';
import {
  buildLeadsFilterChips,
  buildLeadsListSearchParams,
  clearAllLeadsFilters,
  clearLeadsFilterField,
  ownerParamToListTab,
  parseLeadsListUrl,
} from '@/lib/crm/leads-list-url';
import { readLeadsVisibleColumns, defaultB2bLeadsVisibleColumns, type LeadsColumnId } from '@/lib/crm/leads-columns';
import { fetchB2bProjects, type B2bProjectListItem } from '@/lib/b2b-projects-api';

const PAGE_SIZE = 50;
const PAGE_SIZE_KANBAN = 300;
const LEADS_VIEW_STORAGE_KEY = 'crm-leads-view-mode';

type LeadsViewMode = 'list' | 'kanban';

function readLeadsViewMode(): LeadsViewMode {
  if (typeof window === 'undefined') return 'list';
  return window.localStorage.getItem(LEADS_VIEW_STORAGE_KEY) === 'kanban' ? 'kanban' : 'list';
}

type LeadKindFilter = 'pipeline' | 'review' | 'all';

export function CrmLeadsPageContent({ flowScope = 'all' }: { flowScope?: CrmLeadsFlowScope }) {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [listTab, setListTab] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [leadKind, setLeadKind] = useState<LeadKindFilter>(() =>
    flowScope === 'b2b_prospect' ? 'all' : 'pipeline',
  );
  const [reviewQueueCount, setReviewQueueCount] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [staffOptions, setStaffOptions] = useState<CrmStaffRow[]>([]);
  const [sourceOptions, setSourceOptions] = useState<CrmLeadLookupOption[]>([]);
  const [channelOptions, setChannelOptions] = useState<CrmLeadLookupOption[]>([]);
  const [b2bProjects, setB2bProjects] = useState<B2bProjectListItem[]>([]);
  const [bulkOwnerId, setBulkOwnerId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slaSummary, setSlaSummary] = useState<PresalesConsultSlaSummary | null>(null);
  const [funnelMetrics, setFunnelMetrics] = useState<PresalesFunnelMetricsResponse | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<LeadsColumnId>>(() =>
    flowScope === 'b2b_prospect' ? defaultB2bLeadsVisibleColumns() : readLeadsVisibleColumns(false),
  );
  const [viewMode, setViewMode] = useState<LeadsViewMode>('list');
  const urlReadyRef = useRef(false);

  const listHref = leadsListHref(flowScope);
  const pageTitle = leadsListTitle(flowScope);
  const pageSubtitleHint = leadsListSubtitle(flowScope);
  const flowKindFilter = leadFlowKindQuery(flowScope);
  const statusOptions = useMemo(
    () =>
      flowKindFilter
        ? [...statusOptionsForFlowKind(flowKindFilter)]
        : ['moi', 'da_lien_he', 'dang_tu_van', 'chot', 'lost', 'bao_gia', 'won'],
    [flowKindFilter],
  );

  const canImport = useMemo(
    () => hasCap(user, 'crm_leads', 'edit') || hasCap(user, 'crm_leads', 'assign'),
    [user],
  );
  const canCreate = useMemo(() => hasCap(user, 'crm_leads', 'edit'), [user]);
  const canReviewQueue = useMemo(() => hasCap(user, 'crm_leads', 'assign'), [user]);

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

  const loadLeads = useCallback(
    async (accessToken: string, nextOffset: number, search: string, mode: LeadsViewMode = viewMode) => {
      setLoading(true);
      setError('');
      try {
        const ownerId = listTab === 'mine' && user?.id ? Number(user.id) : undefined;
        const kanban = mode === 'kanban';
        const data = await fetchLeads(accessToken, {
          q: search || undefined,
          status: filterStatus || undefined,
          source: filterSource || undefined,
          channel: filterChannel || undefined,
          owner_id: ownerId,
          unassigned_only: listTab === 'unassigned',
          review_queue_only: leadKind === 'review' ? true : undefined,
          hide_review_queue:
            flowScope === 'b2b_prospect' || leadKind === 'all' ? false : undefined,
          lead_flow_kind: flowKindFilter,
          limit: kanban ? PAGE_SIZE_KANBAN : PAGE_SIZE,
          offset: kanban ? 0 : nextOffset,
        });
        setRows(data.leads);
        setTotal(data.total);
        setOffset(data.offset);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải leads thất bại');
      } finally {
        setLoading(false);
      }
    },
    [filterChannel, filterSource, filterStatus, flowKindFilter, flowScope, leadKind, listTab, user?.id, viewMode],
  );

  useEffect(() => {
    setViewMode(readLeadsViewMode());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const parsed = parseLeadsListUrl(new URLSearchParams(window.location.search), flowScope);
    setListTab(ownerParamToListTab(parsed.owner));
    setLeadKind(parsed.kind);
    setFilterStatus(parsed.status);
    setFilterSource(parsed.source);
    setFilterChannel(parsed.channel);
    setQ(parsed.q);
    setQuery(parsed.q);
    urlReadyRef.current = true;
  }, [flowScope]);

  useEffect(() => {
    if (!urlReadyRef.current) return;
    const params = buildLeadsListSearchParams(
      {
        owner: listTab,
        kind: leadKind,
        status: filterStatus,
        source: filterSource,
        channel: filterChannel,
        q: query,
      },
      flowScope,
    );
    const qs = params.toString();
    router.replace(qs ? `${listHref}?${qs}` : listHref, { scroll: false });
  }, [
    listTab,
    leadKind,
    filterStatus,
    filterSource,
    filterChannel,
    query,
    listHref,
    flowScope,
    router,
  ]);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setToken(access);
      const [staffOut, reviewOut, sourceOut, channelOut] = await Promise.all([
        fetchCrmStaffList(access).catch(() => ({ staff: [], summary: {} })),
        canReviewQueue
          ? fetchReviewQueueCount(access).catch(() => ({ count: 0 }))
          : Promise.resolve({ count: 0 }),
        fetchLeadLookupOptions(access, 'source').catch(() => ({ options: [] as CrmLeadLookupOption[] })),
        fetchLeadLookupOptions(access, 'channel').catch(() => ({ options: [] as CrmLeadLookupOption[] })),
      ]);
      setStaffOptions(staffOut.staff ?? []);
      setReviewQueueCount(reviewOut.count ?? 0);
      setSourceOptions(sourceOut.options ?? []);
      setChannelOptions(channelOut.options ?? []);
      if (hasCap(getStoredUser(), 'crm_b2b_projects', 'view')) {
        try {
          setB2bProjects(await fetchB2bProjects(access, 'active'));
        } catch {
          setB2bProjects([]);
        }
      }
    })();
  }, [ensureAuth, canReviewQueue]);

  useEffect(() => {
    if (!token) return;
    void loadLeads(token, 0, query);
  }, [token, query, listTab, leadKind, filterStatus, filterSource, filterChannel, loadLeads]);

  useEffect(() => {
    if (!token || flowScope !== 'b2b_prospect') {
      setSlaSummary(null);
      setFunnelMetrics(null);
      return;
    }
    void (async () => {
      try {
        const amId = listTab === 'mine' && user?.id ? Number(user.id) : undefined;
        const [slaOut, metricsOut] = await Promise.all([
          fetchPresalesConsultSlaSummary(token, amId),
          fetchPresalesFunnelMetrics(token, { amId }),
        ]);
        setSlaSummary(slaOut.summary);
        setFunnelMetrics(metricsOut);
      } catch {
        setSlaSummary(null);
        setFunnelMetrics(null);
      }
    })();
  }, [token, flowScope, listTab, user?.id]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(q.trim());
    setOffset(0);
    setSelectedIds(new Set());
  }

  async function goPage(nextOffset: number) {
    if (!token || nextOffset < 0 || nextOffset >= total) return;
    await loadLeads(token, nextOffset, query);
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const row of rows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  async function handleBulkAssign() {
    if (!token || !bulkOwnerId || !selectedList.length) return;
    const staff = staffOptions.find((row) => String(row.id) === bulkOwnerId);
    if (!staff) return;
    setBulkBusy(true);
    setError('');
    try {
      await bulkAssignLeads(token, {
        lead_ids: selectedList,
        owner_id: staff.id,
        reason: `Bulk assign from ${listHref}`,
      });
      setSelectedIds(new Set());
      await loadLeads(token, offset, query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk assign thất bại');
    } finally {
      setBulkBusy(false);
    }
  }

  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);
  const leadIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const ownerNameById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const staff of staffOptions) {
      map[staff.id] = staff.name;
    }
    return map;
  }, [staffOptions]);
  const projectLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of b2bProjects) {
      map[p.id] = `${p.name} (${p.code})`;
    }
    return map;
  }, [b2bProjects]);
  const showScores = useMemo(
    () => aiCopilotEnabled() && canUseAiCopilot(user?.id, user?.caps),
    [user?.id, user?.caps],
  );
  const { scores: scoreMap, pending: scoresPending } = useLeadScoresMap(token, leadIds, showScores);

  useEffect(() => {
    setVisibleColumns(readLeadsVisibleColumns(showScores));
  }, [showScores]);

  const filterChips = useMemo(
    () =>
      buildLeadsFilterChips(
        {
          owner: listTab,
          kind: leadKind,
          status: filterStatus,
          source: filterSource,
          channel: filterChannel,
          q: query,
        },
        flowScope,
        {
          sourceLabel: (key) => sourceOptions.find((o) => o.option_key === key)?.label ?? key,
          channelLabel: (key) => channelOptions.find((o) => o.option_key === key)?.label ?? key,
        },
      ),
    [
      listTab,
      leadKind,
      filterStatus,
      filterSource,
      filterChannel,
      query,
      flowScope,
      sourceOptions,
      channelOptions,
    ],
  );

  const showLeadKindTags = flowScope !== 'b2b_prospect';

  const emptyActions = (
    <>
      {canImport ? (
        <label htmlFor="crm-leads-import-file" className="btn btn-sm">
          Import Excel
        </label>
      ) : null}
      {canCreate ? (
        <Link href={leadsNewHref(flowScope)} className="btn btn-sm btn-secondary">
          + Tạo lead
        </Link>
      ) : null}
      <Link href="/crm/intake" className="btn btn-sm btn-ghost">
        Lead Intake
      </Link>
    </>
  );

  const pageMeta = useMemo(() => {
    const parts = [
      `${total.toLocaleString('vi-VN')} leads`,
      `trang ${Math.floor(offset / PAGE_SIZE) + 1} / ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`,
      pageSubtitleHint,
    ];
    if (flowScope !== 'b2b_prospect') {
      if (leadKind === 'pipeline') parts.push('ẩn Phải tra soát');
      else if (leadKind === 'review') parts.push('chỉ Phải tra soát');
    }
    if (selectedList.length) parts.push(`đã chọn ${selectedList.length}`);
    return parts.join(' · ');
  }, [total, offset, leadKind, pageSubtitleHint, selectedList.length, flowScope]);

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading width="wide">
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      width="wide"
      breadcrumb={[
        { label: 'CRM', href: listHref },
        { label: 'Leads', href: listHref },
        { label: pageTitle },
      ]}
    >
      <PageToolbar
        title={pageTitle}
        subtitle={pageMeta}
        actions={
          <>
            <LeadsColumnPicker
              visible={visibleColumns}
              showScores={showScores}
              showLeadKindTags={showLeadKindTags}
              onChange={setVisibleColumns}
            />
            {token ? (
              <CrmLeadsImportExport
                token={token}
                query={query}
                selectedIds={selectedList}
                canImport={canImport}
                onImported={() => void loadLeads(token, 0, query)}
                onError={setError}
              />
            ) : null}
            {canCreate ? (
              <Link href={leadsNewHref(flowScope)} className="btn btn-sm">
                + Tạo lead
              </Link>
            ) : null}
          </>
        }
      />

      <div className="bitrix-view-tabs" role="tablist" aria-label="Chế độ xem lead">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'kanban'}
          className={`bitrix-view-tab${viewMode === 'kanban' ? ' is-active' : ''}`}
          onClick={() => {
            setViewMode('kanban');
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(LEADS_VIEW_STORAGE_KEY, 'kanban');
            }
            setOffset(0);
            if (token) void loadLeads(token, 0, query, 'kanban');
          }}
        >
          Kanban
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'list'}
          className={`bitrix-view-tab${viewMode === 'list' ? ' is-active' : ''}`}
          onClick={() => {
            setViewMode('list');
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(LEADS_VIEW_STORAGE_KEY, 'list');
            }
            setOffset(0);
            if (token) void loadLeads(token, 0, query, 'list');
          }}
        >
          Danh sách
        </button>
      </div>

      <div className="page-card page-card--flat-top stack-gap">
        {flowScope === 'b2b_prospect' && slaSummary ? (
          <PresalesConsultSlaSummaryCard summary={slaSummary} />
        ) : null}
        {flowScope === 'b2b_prospect' && funnelMetrics ? (
          <PresalesFunnelMetricsCard data={funnelMetrics} />
        ) : null}

        <SegmentedControl
          options={[
            { id: 'all', label: 'Tất cả' },
            { id: 'mine', label: 'Của tôi' },
            { id: 'unassigned', label: 'Chưa phân' },
          ]}
          value={listTab}
          onChange={(id) => {
            setListTab(id);
            setOffset(0);
            setSelectedIds(new Set());
          }}
        />

        {flowScope === 'spa_operational' || flowScope === 'all' ? (
          <SegmentedControl
            label="Loại lead"
            options={[
              { id: 'pipeline', label: 'Pipeline AM' },
              {
                id: 'review',
                label: 'Phải tra soát',
                badge: reviewQueueCount && reviewQueueCount > 0 ? reviewQueueCount : undefined,
              },
              { id: 'all', label: 'Tất cả (có tag)' },
            ]}
            value={leadKind}
            onChange={(id) => {
              setLeadKind(id);
              setOffset(0);
              setSelectedIds(new Set());
            }}
            className="segmented-control--kind"
          />
        ) : null}

        <WinFilterChips
          chips={filterChips}
          onRemove={(chipId) => {
            const next = clearLeadsFilterField(
              {
                owner: listTab,
                kind: leadKind,
                status: filterStatus,
                source: filterSource,
                channel: filterChannel,
                q: query,
              },
              chipId,
            );
            setListTab(next.owner);
            setLeadKind(next.kind);
            setFilterStatus(next.status);
            setFilterSource(next.source);
            setFilterChannel(next.channel);
            setQ(next.q);
            setQuery(next.q);
            setOffset(0);
            setSelectedIds(new Set());
          }}
          onClearAll={() => {
            const next = clearAllLeadsFilters(
              {
                owner: listTab,
                kind: leadKind,
                status: filterStatus,
                source: filterSource,
                channel: filterChannel,
                q: query,
              },
              flowScope,
            );
            setListTab(next.owner);
            setLeadKind(next.kind);
            setFilterStatus(next.status);
            setFilterSource(next.source);
            setFilterChannel(next.channel);
            setQ(next.q);
            setQuery(next.q);
            setOffset(0);
            setSelectedIds(new Set());
          }}
        />

        <FilterBar onSubmit={onSearch}>
          <FilterBarSearch value={q} onChange={setQ} placeholder="Tìm tên, SĐT, email…" />
          <select
            className="kpi-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Lọc trạng thái"
          >
            <option value="">Trạng thái</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="kpi-select"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            aria-label="Lọc nguồn"
          >
            <option value="">Nguồn</option>
            {sourceOptions.map((opt) => (
              <option key={opt.id} value={opt.option_key}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            className="kpi-select"
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            aria-label="Lọc kênh"
          >
            <option value="">Kênh</option>
            {channelOptions.map((opt) => (
              <option key={opt.id} value={opt.option_key}>
                {opt.label}
              </option>
            ))}
          </select>
          <FilterBarActions>
            {canReviewQueue && flowScope !== 'b2b_prospect' ? (
              <Link href="/crm/leads/review-queue" className="btn btn-sm btn-ghost">
                Inbox GDKD →
              </Link>
            ) : null}
            <button className="btn btn-sm btn-secondary" type="submit" disabled={loading}>
              Lọc
            </button>
          </FilterBarActions>
        </FilterBar>

        {canImport ? (
          <BulkActionBar count={selectedList.length}>
            <select
              className="kpi-select"
              value={bulkOwnerId}
              onChange={(e) => setBulkOwnerId(e.target.value)}
              aria-label="Chọn owner bulk assign"
            >
              <option value="">Gán owner…</option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-sm"
              disabled={bulkBusy || !bulkOwnerId}
              onClick={() => void handleBulkAssign()}
            >
              Bulk assign
            </button>
          </BulkActionBar>
        ) : null}

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {!loading && total === 0 && flowScope === 'b2b_prospect' ? (
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            Không thấy lead B2B? Kiểm tra{' '}
            <Link href="/crm/leads" className="nav-link">
              Quản lý Lead (tất cả)
            </Link>{' '}
            — lead gắn client agency hoặc trùng SĐT có thể nằm luồng CSKH vận hành / bị ẩn trùng.
          </p>
        ) : null}

        <PullToRefresh
          disabled={loading || !token || viewMode === 'kanban'}
          onRefresh={async () => {
            if (!token) return;
            await loadLeads(token, offset, query);
          }}
        >
          {viewMode === 'kanban' ? (
            <LeadKanbanBoard
              rows={rows}
              flowKind={(flowKindFilter ?? 'b2b_prospect') as LeadFlowKind}
            />
          ) : (
            <CrmLeadsList
              rows={rows}
              loading={loading}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleAll}
              ownerNameById={ownerNameById}
              projectLabelById={projectLabelById}
              visibleColumns={visibleColumns}
              showScores={showScores}
              scoreMap={scoreMap}
              scoresPending={scoresPending}
              showLeadKindTags={showLeadKindTags}
              emptyActions={emptyActions}
            />
          )}
        </PullToRefresh>

        {viewMode === 'list' ? (
          <PageFooter meta={`Hiển thị ${rows.length} / ${total.toLocaleString('vi-VN')} leads`}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={loading || offset <= 0}
              onClick={() => void goPage(Math.max(0, offset - PAGE_SIZE))}
            >
              ← Trước
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={loading || offset + PAGE_SIZE >= total}
              onClick={() => void goPage(offset + PAGE_SIZE)}
            >
              Sau →
            </button>
          </PageFooter>
        ) : (
          <PageFooter
            meta={`Kanban · ${rows.length} / ${total.toLocaleString('vi-VN')} leads (tối đa ${PAGE_SIZE_KANBAN})`}
          />
        )}
      </div>
    </StaffPageShell>
  );
}

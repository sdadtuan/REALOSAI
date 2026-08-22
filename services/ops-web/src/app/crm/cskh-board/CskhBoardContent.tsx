'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { WinEmptyState } from '@/components/win';
import { CskhManagerIntelPanel } from '@/components/crm/CskhManagerIntelPanel';
import { CskhClosedLoopPanel } from '@/components/crm/CskhClosedLoopPanel';
import { CskhBreachBacklogPanel } from '@/components/crm/CskhBreachBacklogPanel';
import { CskhShiftHandoffPanel } from '@/components/crm/CskhShiftHandoffPanel';
import { CskhBoardPrepPanel } from '@/app/crm/cskh-board/CskhBoardPrepPanel';
import {
  bulkAssignCskhLeads,
  bulkRescheduleCskhLeads,
  cskhBoardExportUrl,
  fetchCskhBoard,
  fetchCskhSlaPredictions,
  fetchCrmStaffList,
  staffMe,
  staffRefresh,
  type CskhBoardResponse,
  type CskhBoardRow,
  type SlaPredictRow,
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
import { leadMeetingPrepEnabled } from '@/lib/crm/lmp-flags';

const PAGE_SIZE = 50;

type SlaTier = 'first_call_15m' | 'b2_complete_4h' | 'close_24h';
type SlaFilter = 'all' | 'breach' | 'warning' | 'open';

const SLA_TIER_META: Record<
  SlaTier,
  { title: string; deadline: string; hint: string; targetPct: number }
> = {
  first_call_15m: {
    title: '15 phút',
    deadline: 'Gọi lần đầu',
    hint: 'Activity「Gọi điện」trên lead detail',
    targetPct: 85,
  },
  b2_complete_4h: {
    title: '4 giờ',
    deadline: 'Hoàn thành B2',
    hint: 'Funnel B2 → Liên hệ OK + Hoàn thành B2',
    targetPct: 80,
  },
  close_24h: {
    title: '24 giờ',
    deadline: 'Chốt / Lost',
    hint: 'Status chot hoặc lost + audit note',
    targetPct: 70,
  },
};

function complianceClass(pass: boolean | null | undefined): string {
  if (pass === true) return 'cskh-sla-dashboard-card__compliance--pass';
  if (pass === false) return 'cskh-sla-dashboard-card__compliance--fail';
  return 'cskh-sla-dashboard-card__compliance--na';
}

function complianceLabel(pass: boolean | null | undefined): string {
  if (pass === true) return 'Đạt';
  if (pass === false) return 'Chưa đạt';
  return 'Chưa có số liệu';
}

function slaBadge(state: CskhBoardRow['sla_state']): { label: string; className: string } {
  if (state === 'breach') return { label: 'Breach', className: 'badge badge-danger' };
  if (state === 'warning') return { label: 'Warning', className: 'badge badge-warn' };
  if (state === 'ok') return { label: 'OK', className: 'badge badge-ok' };
  return { label: '—', className: 'muted' };
}

function tierSnapshot(row: CskhBoardRow, tier: SlaTier) {
  return row.sla_tiers.find((item) => item.tier === tier);
}

function predictRiskLabel(pred: SlaPredictRow | undefined): string | null {
  if (!pred) return null;
  if (pred.risk === 'imminent') return `Sắp breach · ${pred.minutes_remaining}p`;
  if (pred.risk === 'high') return `High · ${pred.minutes_remaining}p`;
  if (pred.risk === 'medium') return `Medium · ${pred.minutes_remaining}p`;
  return null;
}

function formatElapsed(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes}p`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}p` : `${hours}h`;
}

function isM1PreCallEligible(row: CskhBoardRow): boolean {
  return !row.b2_completed_at;
}

function CskhLeadCard({
  row,
  canAssign,
  selected,
  onToggle,
  activeTier,
  predict,
  showPrepPreview,
  prepPreviewOpen,
  onTogglePrepPreview,
  token,
  user,
  onPrepMessage,
  onPrepError,
}: {
  row: CskhBoardRow;
  canAssign: boolean;
  selected: boolean;
  onToggle: () => void;
  activeTier: SlaTier;
  predict?: SlaPredictRow;
  showPrepPreview: boolean;
  prepPreviewOpen: boolean;
  onTogglePrepPreview: () => void;
  token: string;
  user: StoredStaffUser | null;
  onPrepMessage: (msg: string) => void;
  onPrepError: (msg: string) => void;
}) {
  const tier = tierSnapshot(row, activeTier);
  const badge = slaBadge(tier?.sla_state ?? row.sla_state);
  const breachClass = tier?.sla_state === 'breach' ? ' cskh-board-card--breach' : '';
  const warningClass = tier?.sla_state === 'warning' ? ' cskh-board-card--warning' : '';
  const phoneDigits = row.phone?.replace(/\D/g, '') ?? '';

  return (
    <li className={`cskh-board-card win-cskh-mobile-card${breachClass}${warningClass}`} data-testid="cskh-board-card">
      {canAssign ? (
        <label className="cskh-board-card__select">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Chọn lead ${row.id}`}
          />
        </label>
      ) : null}
      <div className="cskh-board-card__body">
        <div className="cskh-board-card__head">
          <strong>{row.full_name || `#${row.id}`}</strong>
          <span className={badge.className}>{badge.label}</span>
        </div>
        {row.phone ? <div className="muted cskh-board-card__phone">{row.phone}</div> : null}
        <div className="cskh-board-card__meta muted">
          <span>{row.status}</span>
          <span>{row.owner_name ?? row.owner_id ?? '—'}</span>
          {tier?.elapsed_minutes != null ? <span>{formatElapsed(tier.elapsed_minutes)}</span> : null}
        </div>
        <div className="cskh-board-card__meta muted">
          <span>Nhận: {row.received_at?.slice(0, 16) ?? '—'}</span>
          {predict ? (
            <span className={`sla-predict-badge sla-predict-badge--${predict.risk}`}>
              {predictRiskLabel(predict)}
            </span>
          ) : null}
        </div>
        <div className="cskh-board-card__sla-tiers">
          {row.sla_tiers.map((item) => (
            <span
              key={item.tier}
              className={`cskh-board-tier-pill cskh-board-tier-pill--${item.sla_state}${
                item.tier === activeTier ? ' is-active-tier' : ''
              }`}
            >
              {SLA_TIER_META[item.tier as SlaTier]?.title ?? item.tier}: {item.sla_state}
            </span>
          ))}
        </div>
        {row.next_follow_up_at ? (
          <div className="cskh-board-card__follow muted">Follow-up: {row.next_follow_up_at.slice(0, 16)}</div>
        ) : null}
      </div>
      <div className="win-leads-mobile-card__actions">
        {phoneDigits ? (
          <a className="win-leads-mobile-card__action" href={`tel:${phoneDigits}`}>
            Gọi
          </a>
        ) : (
          <span className="win-leads-mobile-card__action" aria-disabled="true" style={{ opacity: 0.45 }}>
            Gọi
          </span>
        )}
        {showPrepPreview ? (
          <button
            type="button"
            className="win-leads-mobile-card__action"
            onClick={onTogglePrepPreview}
          >
            {prepPreviewOpen ? 'Ẩn script' : 'Script M1'}
          </button>
        ) : (
          <Link href={`/crm/leads/${row.id}?prep=1`} className="win-leads-mobile-card__action">
            SCI
          </Link>
        )}
        <Link
          href={`/crm/leads/${row.id}`}
          className="win-leads-mobile-card__action win-leads-mobile-card__action--primary"
        >
          Chi tiết →
        </Link>
      </div>
      {prepPreviewOpen && showPrepPreview ? (
        <CskhBoardPrepPanel
          token={token}
          user={user}
          leadId={row.id}
          leadLabel={row.full_name || `#${row.id}`}
          slaTiers={row.sla_tiers}
          onMessage={onPrepMessage}
          onError={onPrepError}
        />
      ) : null}
    </li>
  );
}

export function CskhBoardContent() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [rows, setRows] = useState<CskhBoardRow[]>([]);
  const [summary, setSummary] = useState({ total: 0, breach: 0, warning: 0, ok: 0 });
  const [slaDashboard, setSlaDashboard] = useState<CskhBoardResponse['sla_dashboard'] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [slaFilter, setSlaFilter] = useState<SlaFilter>('breach');
  const [slaTier, setSlaTier] = useState<SlaTier>('first_call_15m');
  const [ownerId, setOwnerId] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [staffOptions, setStaffOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [assignTo, setAssignTo] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [predictByLead, setPredictByLead] = useState<Map<number, SlaPredictRow>>(new Map());
  const [expandedPrepId, setExpandedPrepId] = useState<number | null>(null);

  const canAssign = hasCap(user, 'crm_leads', 'assign');
  const showLmpPrep = leadMeetingPrepEnabled() && canViewLmp(user);
  const tableColSpan = (canAssign ? 1 : 0) + 10;

  const loadPredictions = useCallback(async (accessToken: string) => {
    try {
      const data = await fetchCskhSlaPredictions(accessToken);
      const map = new Map<number, SlaPredictRow>();
      const rank = { low: 1, medium: 2, high: 3, imminent: 4 };
      for (const item of data.items) {
        const existing = map.get(item.lead_id);
        if (!existing || rank[item.risk] > rank[existing.risk]) {
          map.set(item.lead_id, item);
        }
      }
      setPredictByLead(map);
    } catch {
      setPredictByLead(new Map());
    }
  }, []);

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
        setError('Không có quyền xem bảng CSKH');
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

  const loadBoard = useCallback(
    async (
      accessToken: string,
      nextOffset: number,
      overrides?: {
        q?: string;
        owner_id?: string;
        sla_filter?: SlaFilter;
        sla_tier?: SlaTier;
      },
    ) => {
      const nextQuery = overrides?.q ?? query;
      const nextOwnerId = overrides?.owner_id ?? ownerId;
      const nextSlaFilter = overrides?.sla_filter ?? slaFilter;
      const nextSlaTier = overrides?.sla_tier ?? slaTier;

      if (overrides?.q !== undefined) setQuery(nextQuery);
      if (overrides?.owner_id !== undefined) setOwnerId(nextOwnerId);
      if (overrides?.sla_filter !== undefined) setSlaFilter(nextSlaFilter);
      if (overrides?.sla_tier !== undefined) setSlaTier(nextSlaTier);

      setLoading(true);
      setError('');
      setExpandedPrepId(null);
      try {
        const data = await fetchCskhBoard(accessToken, {
          q: nextQuery || undefined,
          owner_id: nextOwnerId ? Number(nextOwnerId) : undefined,
          sla_filter: nextSlaFilter,
          sla_tier: nextSlaTier,
          limit: PAGE_SIZE,
          offset: nextOffset,
        });
        setRows(data.items);
        setSummary(data.summary);
        setSlaDashboard(data.sla_dashboard);
        setTotal(data.total);
        setOffset(data.offset);
        setSelected(new Set());
        void loadPredictions(accessToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải bảng CSKH thất bại');
      } finally {
        setLoading(false);
      }
    },
    [ownerId, query, slaFilter, slaTier, loadPredictions],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setToken(access);
      const me = getStoredUser();
      if (me && hasCap(me, 'crm_leads', 'assign')) {
        try {
          const staff = await fetchCrmStaffList(access);
          setStaffOptions(
            staff.staff.map((s) => ({ id: Number(s.id), name: String(s.name ?? s.id) })),
          );
        } catch {
          /* optional */
        }
      }
      await loadBoard(access, 0);
    })();
    // Initial auth + first load only — filter changes call loadBoard directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureAuth]);

  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected],
  );

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulkAssign() {
    if (!token || !canAssign) return;
    const ids = [...selected];
    if (!ids.length) {
      setError('Chọn ít nhất một lead');
      return;
    }
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const out = await bulkAssignCskhLeads(token, {
        lead_ids: ids,
        to_user_id: Number(assignTo),
        reason: assignReason.trim(),
      });
      setMsg(`Đã phân lại ${out.assigned}/${out.total} lead`);
      await loadBoard(token, offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk assign thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function runBulkReschedule() {
    if (!token || !canAssign) return;
    const ids = [...selected];
    if (!ids.length || !followUpAt) {
      setError('Chọn lead và thời gian follow-up');
      return;
    }
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const out = await bulkRescheduleCskhLeads(token, {
        lead_ids: ids,
        follow_up_at: new Date(followUpAt).toISOString(),
      });
      setMsg(`Đã lên lịch follow-up cho ${out.rescheduled} lead`);
      await loadBoard(token, offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk reschedule thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function exportBoard() {
    if (!token) return;
    const url = cskhBoardExportUrl({
      owner_id: ownerId ? Number(ownerId) : undefined,
      sla_filter: slaFilter,
      sla_tier: slaTier,
      q: query || undefined,
      format: 'xlsx',
    });
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `cskh-board-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export Excel thất bại');
    }
  }

  function applyTierFilter(nextTier: SlaTier, nextSla: SlaFilter = 'breach') {
    if (token) void loadBoard(token, 0, { sla_tier: nextTier, sla_filter: nextSla, q: q.trim() });
  }

  function applyFilter(nextSla: SlaFilter) {
    if (token) void loadBoard(token, 0, { sla_filter: nextSla, q: q.trim() });
  }

  function runSearchFilter() {
    if (token) void loadBoard(token, 0, { q: q.trim() });
  }

  const filterFields = (
    <>
      <label>
        SLA tier
        <select
          value={slaTier}
          onChange={(e) => {
            const next = e.target.value as SlaTier;
            setSlaTier(next);
            if (token) void loadBoard(token, 0, { sla_tier: next });
          }}
        >
          <option value="first_call_15m">15p — Gọi lần đầu</option>
          <option value="b2_complete_4h">4h — Hoàn thành B2</option>
          <option value="close_24h">24h — Chốt / Lost</option>
        </select>
      </label>
      <label>
        SLA filter
        <select value={slaFilter} onChange={(e) => setSlaFilter(e.target.value as SlaFilter)}>
          <option value="breach">SLA breach</option>
          <option value="warning">Sắp breach</option>
          <option value="open">Đang mở (ok+warning)</option>
          <option value="all">Tất cả</option>
        </select>
      </label>
      <label>
        Owner ID
        <input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} placeholder="optional" />
      </label>
      <label className="grow">
        Tìm kiếm
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên / SĐT / email" />
      </label>
      <button type="button" className="btn btn-primary" onClick={() => runSearchFilter()}>
        Lọc
      </button>
    </>
  );

  return (
    <StaffPageShell
      user={user}
      onLogout={() => {
        clearSession();
        router.replace('/login');
      }}
      loading={!user}
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'CSKH', href: '/crm/cskh-board' },
        { label: 'Bảng SLA' },
      ]}
    >
      <PageToolbar
        title="Dashboard SLA CSKH vận hành 24h"
        subtitle="15 phút gọi lần đầu · 4 giờ hoàn thành B2 · 24 giờ chốt/lost (SOP CSKH)"
        actions={
          <>
            <Link href="/crm/gdkd-enterprise" className="btn btn-sm btn-ghost">
              KPI GDKD
            </Link>
            <Link href="/crm/leads" className="btn btn-sm btn-ghost">
              Quản lý Lead
            </Link>
            <Link href="/crm/ai/coach" className="btn btn-sm btn-ghost">
              Coach digest
            </Link>
            <Link href="/crm/leads/review-queue" className="btn btn-sm btn-ghost">
              Review queue
            </Link>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => void exportBoard()}>
              Export Excel
            </button>
          </>
        }
      />

      <div className="page-card stack-gap cskh-board-page">
        <div className="cskh-sla-dashboard" aria-label="Dashboard SLA 15p / 4h / 24h">
          {(Object.keys(SLA_TIER_META) as SlaTier[]).map((tier) => {
            const meta = SLA_TIER_META[tier];
            const stats = slaDashboard?.tiers[tier];
            const active = slaTier === tier;
            return (
              <button
                key={tier}
                type="button"
                className={`cskh-sla-dashboard-card${active ? ' is-active' : ''}`}
                onClick={() => applyTierFilter(tier, 'breach')}
              >
                <div className="cskh-sla-dashboard-card__head">
                  <strong>{meta.title}</strong>
                  <span className="muted">{meta.deadline}</span>
                </div>
                <div className={`cskh-sla-dashboard-card__compliance ${complianceClass(stats?.compliance_pass)}`}>
                  <span className="cskh-sla-dashboard-card__compliance-value">
                    {stats?.compliance_pct != null ? `${stats.compliance_pct}%` : '—'}
                  </span>
                  <span className="cskh-sla-dashboard-card__compliance-target muted">
                    Target ≥{stats?.target_pct ?? meta.targetPct}% · {complianceLabel(stats?.compliance_pass)}
                  </span>
                </div>
                <div className="cskh-sla-dashboard-card__stats">
                  <span className="cskh-sla-dashboard-stat cskh-sla-dashboard-stat--ok">
                    OK {stats?.ok ?? 0}
                  </span>
                  <span className="cskh-sla-dashboard-stat cskh-sla-dashboard-stat--breach">
                    Breach {stats?.breach ?? 0}
                  </span>
                  <span className="cskh-sla-dashboard-stat cskh-sla-dashboard-stat--warn">
                    Warning {stats?.warning ?? 0}
                  </span>
                </div>
                {stats?.evaluated ? (
                  <p className="muted cskh-sla-dashboard-card__evaluated">
                    {stats.ok} / {stats.evaluated} lead đạt SLA (OK vs breach)
                  </p>
                ) : null}
                <p className="muted cskh-sla-dashboard-card__hint">{meta.hint}</p>
              </button>
            );
          })}
        </div>

        {token ? <CskhBreachBacklogPanel token={token} /> : null}
        {token && canAssign ? <CskhShiftHandoffPanel token={token} /> : null}

        {token && canAssign ? (
          <CskhManagerIntelPanel
            token={token}
            canAssign={canAssign}
            onApplyTriage={({ leadIds, toUserId, reason }) => {
              setSelected(new Set(leadIds));
              setAssignTo(String(toUserId));
              setAssignReason(reason);
              setMsg(`Đã chọn ${leadIds.length} lead — kiểm tra Bulk actions và bấm Reassign.`);
            }}
          />
        ) : null}

        {token && canAssign ? <CskhClosedLoopPanel token={token} /> : null}

        <div className="cskh-board-summary-chips" aria-label="Tóm tắt SLA theo tier đang chọn">
          <button
            type="button"
            className={`cskh-board-summary-chip${slaFilter === 'breach' ? ' is-active' : ''}`}
            onClick={() => applyFilter('breach')}
          >
            Breach {summary.breach}
          </button>
          <button
            type="button"
            className={`cskh-board-summary-chip cskh-board-summary-chip--warn${slaFilter === 'warning' ? ' is-active' : ''}`}
            onClick={() => applyFilter('warning')}
          >
            Warning {summary.warning}
          </button>
          <button
            type="button"
            className={`cskh-board-summary-chip cskh-board-summary-chip--ok${slaFilter === 'open' ? ' is-active' : ''}`}
            onClick={() => applyFilter('open')}
          >
            OK {summary.ok}
          </button>
          <span className="cskh-board-summary-chip cskh-board-summary-chip--total muted">Tổng {summary.total}</span>
        </div>

        <div className="card cskh-board-filters-desktop" style={{ marginBottom: '1rem' }}>
          <div className="row gap-sm wrap">{filterFields}</div>
          <p className="muted cskh-board-summary-line" style={{ marginTop: '0.75rem' }}>
            Tier {SLA_TIER_META[slaTier].title} · Compliance{' '}
            {slaDashboard?.tiers[slaTier]?.compliance_pct != null
              ? `${slaDashboard.tiers[slaTier].compliance_pct}% (target ≥${slaDashboard.tiers[slaTier].target_pct}%)`
              : '—'}{' '}
            · OK {summary.ok} · Breach {summary.breach} · Warning {summary.warning}
          </p>
        </div>

        <details className="card cskh-board-filter-accordion" style={{ marginBottom: '1rem' }}>
          <summary>Bộ lọc</summary>
          <div className="row gap-sm wrap" style={{ marginTop: '0.75rem' }}>
            {filterFields}
          </div>
        </details>

        {canAssign ? (
          <div className="card cskh-board-bulk" style={{ marginBottom: '1rem' }}>
            <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Bulk actions ({selected.size} selected)</h2>
            <div className="row gap-sm wrap">
              <label>
                Reassign to
                <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                  <option value="">— staff —</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name} (#{s.id})
                    </option>
                  ))}
                </select>
              </label>
              <label className="grow">
                Lý do
                <input value={assignReason} onChange={(e) => setAssignReason(e.target.value)} />
              </label>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void runBulkAssign()}>
                Bulk reassign
              </button>
            </div>
            <div className="row gap-sm wrap" style={{ marginTop: '0.75rem' }}>
              <label>
                Follow-up at
                <input type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void runBulkReschedule()}
              >
                Bulk reschedule
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="ok-text">{msg}</p> : null}

        <div className="card table-wrap cskh-board-table-wrap">
          {loading ? <p className="muted">Đang tải…</p> : null}
          <table className="data-table">
            <thead>
              <tr>
                {canAssign ? (
                  <th>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Chọn tất cả" />
                  </th>
                ) : null}
                <th>Lead</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Received</th>
                <th>First call</th>
                <th>B2 done</th>
                <th>Closed</th>
                <th>SLA tiers</th>
                <th>Risk</th>
                <th>Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const tier = tierSnapshot(row, slaTier);
                const predict = predictByLead.get(row.id);
                const m1Eligible = isM1PreCallEligible(row);
                const prepOpen = expandedPrepId === row.id;
                const showRowPrep = showLmpPrep && m1Eligible;
                return (
                  <Fragment key={row.id}>
                    <tr className={tier?.sla_state === 'breach' ? 'row-danger' : undefined}>
                      {canAssign ? (
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={() => toggleOne(row.id)}
                            aria-label={`Chọn lead ${row.id}`}
                          />
                        </td>
                      ) : null}
                      <td>
                        <Link href={`/crm/leads/${row.id}`}>{row.full_name || `#${row.id}`}</Link>
                        <div className="muted">{row.phone}</div>
                        {showRowPrep ? (
                          <button
                            type="button"
                            className="lmp-cskh-sci-link lmp-cskh-sci-link--button"
                            onClick={() => setExpandedPrepId(prepOpen ? null : row.id)}
                          >
                            {prepOpen ? 'Ẩn script M1' : 'Xem script M1'}
                          </button>
                        ) : (
                          <Link href={`/crm/leads/${row.id}?prep=1`} className="lmp-cskh-sci-link">
                            SCI · Talk Track
                          </Link>
                        )}
                      </td>
                      <td>{row.status}</td>
                      <td>{row.owner_name ?? row.owner_id ?? '—'}</td>
                      <td>{row.received_at?.slice(0, 16) ?? '—'}</td>
                      <td>{row.first_call_at?.slice(0, 16) ?? '—'}</td>
                      <td>{row.b2_completed_at?.slice(0, 16) ?? '—'}</td>
                      <td>{row.closed_at?.slice(0, 16) ?? '—'}</td>
                      <td>
                        <div className="cskh-board-tier-inline">
                          {row.sla_tiers.map((item) => (
                            <span
                              key={item.tier}
                              className={`cskh-board-tier-pill cskh-board-tier-pill--${item.sla_state}${
                                item.tier === slaTier ? ' is-active-tier' : ''
                              }`}
                            >
                              {SLA_TIER_META[item.tier as SlaTier]?.title ?? item.tier}: {item.sla_state}
                            </span>
                          ))}
                        </div>
                        {tier?.elapsed_minutes != null ? (
                          <span className="muted"> · {formatElapsed(tier.elapsed_minutes)}</span>
                        ) : null}
                      </td>
                      <td>
                        {predict ? (
                          <span className={`sla-predict-badge sla-predict-badge--${predict.risk}`}>
                            {predictRiskLabel(predict)}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>{row.next_follow_up_at?.slice(0, 16) ?? '—'}</td>
                    </tr>
                    {prepOpen && showRowPrep ? (
                      <tr className="cskh-board-prep-expand-row">
                        <td colSpan={tableColSpan}>
                          <CskhBoardPrepPanel
                            token={token}
                            user={user}
                            leadId={row.id}
                            leadLabel={row.full_name || `#${row.id}`}
                            slaTiers={row.sla_tiers}
                            onMessage={setMsg}
                            onError={setError}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!loading && rows.length === 0 ? <p className="muted">Không có lead phù hợp bộ lọc.</p> : null}
        </div>

        {!loading && rows.length === 0 ? (
          <WinEmptyState
            icon="📊"
            title="Không có lead phù hợp"
            subtitle="Thử đổi tier SLA, bộ lọc breach/warning hoặc tìm kiếm khác."
          />
        ) : (
          <ul className="cskh-board-cards" aria-label="Bảng CSKH (mobile)" data-testid="cskh-board-cards">
            {loading ? (
              <li className="cskh-board-card cskh-board-card--empty muted">Đang tải…</li>
            ) : (
              rows.map((row) => (
                <CskhLeadCard
                  key={row.id}
                  row={row}
                  canAssign={canAssign}
                  selected={selected.has(row.id)}
                  onToggle={() => toggleOne(row.id)}
                  activeTier={slaTier}
                  predict={predictByLead.get(row.id)}
                  showPrepPreview={showLmpPrep && isM1PreCallEligible(row)}
                  prepPreviewOpen={expandedPrepId === row.id}
                  onTogglePrepPreview={() =>
                    setExpandedPrepId(expandedPrepId === row.id ? null : row.id)
                  }
                  token={token}
                  user={user}
                  onPrepMessage={setMsg}
                  onPrepError={setError}
                />
              ))
            )}
          </ul>
        )}

        <div className="row gap-sm cskh-board-pagination" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={offset <= 0 || loading}
            onClick={() => void loadBoard(token, Math.max(0, offset - PAGE_SIZE))}
          >
            ← Trước
          </button>
          <span className="muted">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} / {total}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={offset + PAGE_SIZE >= total || loading}
            onClick={() => void loadBoard(token, offset + PAGE_SIZE)}
          >
            Sau →
          </button>
        </div>
      </div>
    </StaffPageShell>
  );
}

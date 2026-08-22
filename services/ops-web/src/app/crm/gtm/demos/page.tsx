'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HubPageLayout, StaffPageShell } from '@/components/layout';
import {
  downloadGtmProposalPdf,
  exportGtmDemoRequests,
  fetchGtmDemoRequests,
  grantGtmSandbox,
  importGtmDemoRequests,
  patchGtmDemoRequest,
  GTM_INDUSTRY_LABELS,
  GTM_MARKET_LABELS,
  GTM_NEXT_STATUSES,
  GTM_SKU_LABELS,
  GTM_STATUS_LABELS,
  type GtmDemoRequestRow,
  type GtmImportResult,
  type GtmIndustry,
  type GtmLocale,
  type GtmMarketCountry,
  type GtmStatus,
} from '@/lib/gtm/api';
import { canViewGtmDemos, canWriteGtmDemos, slaBadgeClass, slaBadgeLabel } from '@/lib/gtm/caps';
import {
  canExportGtmDemos,
  canGrantSandboxRow,
  canImportGtmDemos,
} from '@/lib/gtm/sandbox-caps';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { staffMe, staffRefresh } from '@/lib/api';

const STATUSES: GtmStatus[] = [
  'new',
  'qualified',
  'disqualified',
  'demo_booked',
  'sandbox_granted',
  'won',
  'lost',
];
const INDUSTRIES = Object.keys(GTM_INDUSTRY_LABELS) as GtmIndustry[];
const LOCALES: GtmLocale[] = ['vi', 'en'];
const MARKETS = Object.keys(GTM_MARKET_LABELS) as GtmMarketCountry[];

function formatAge(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}p`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function GtmDemosPage() {
  return (
    <Suspense
      fallback={
        <StaffPageShell user={null} onLogout={() => {}} loading>
          <span />
        </StaffPageShell>
      }
    >
      <GtmDemosContent />
    </Suspense>
  );
}

function GtmDemosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<GtmDemoRequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importSummary, setImportSummary] = useState<GtmImportResult | null>(null);
  const [ioBusy, setIoBusy] = useState<'export' | 'import' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filterStatus = (searchParams.get('status') as GtmStatus | null) ?? '';
  const filterIndustry = (searchParams.get('industry') as GtmIndustry | null) ?? '';
  const filterLocale = (searchParams.get('locale') as GtmLocale | null) ?? '';
  const filterMarket = (searchParams.get('market_country') as GtmMarketCountry | null) ?? '';

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
      if (!canViewGtmDemos(me)) {
        setError('Không có quyền xem demo inbox');
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
      if (!canViewGtmDemos(me)) {
        setError('Không có quyền xem demo inbox');
        return null;
      }
      return access;
    }
  }, [router]);

  const load = useCallback(async () => {
    const access = await ensureAuth();
    if (!access) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetchGtmDemoRequests(access, {
        status: filterStatus || undefined,
        industry: filterIndustry || undefined,
        locale: filterLocale || undefined,
        market_country: filterMarket || undefined,
        limit: 100,
      });
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tải demo requests thất bại');
    } finally {
      setLoading(false);
    }
  }, [ensureAuth, filterIndustry, filterLocale, filterMarket, filterStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  function setFilter(key: 'status' | 'industry' | 'locale' | 'market_country', value: string) {
    const qs = new URLSearchParams(searchParams.toString());
    if (value) qs.set(key, value);
    else qs.delete(key);
    router.replace(`/crm/gtm/demos${qs.toString() ? `?${qs.toString()}` : ''}`);
  }

  async function handleStatusChange(row: GtmDemoRequestRow, next: GtmStatus) {
    if (!canWriteGtmDemos(user)) return;
    const access = getAccessToken();
    if (!access) return;
    if (next === row.status) return;

    let status_note = row.status_note;
    if (next === 'qualified') {
      const note = window.prompt('Ghi chú qualify (tối thiểu 10 ký tự):', status_note ?? '');
      if (note == null) return;
      if (note.trim().length < 10) {
        setMsg('Ghi chú qualify cần ≥10 ký tự');
        return;
      }
      status_note = note.trim();
    }

    setBusyId(row.id);
    setMsg('');
    try {
      await patchGtmDemoRequest(access, row.id, { status: next, status_note });
      setMsg(`Đã cập nhật ${row.full_name} → ${GTM_STATUS_LABELS[next]}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cập nhật status thất bại');
    } finally {
      setBusyId(null);
    }
  }

  async function handleGrantSandbox(row: GtmDemoRequestRow) {
    if (!canGrantSandboxRow(user, row.status)) return;
    const access = getAccessToken();
    if (!access) return;
    setBusyId(row.id);
    setMsg('');
    setError('');
    try {
      const out = await grantGtmSandbox(access, row.id);
      if (out.status_note === 'sandbox_email_failed') {
        setError('Email sandbox thất bại — status giữ demo_booked');
      } else if (out.status === 'sandbox_granted') {
        const idempotent = row.status === 'sandbox_granted';
        setMsg(
          idempotent
            ? `Sandbox đã cấp cho ${row.full_name}`
            : `Đã cấp sandbox 14 ngày cho ${row.full_name}`,
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Grant sandbox thất bại');
    } finally {
      setBusyId(null);
    }
  }

  async function handleExport() {
    const access = getAccessToken();
    if (!access || !canExportGtmDemos(user)) return;
    setIoBusy('export');
    setError('');
    try {
      await exportGtmDemoRequests(access, {
        status: filterStatus || undefined,
        industry: filterIndustry || undefined,
        locale: filterLocale || undefined,
        market_country: filterMarket || undefined,
      });
      setMsg('Đã tải file Excel');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export thất bại');
    } finally {
      setIoBusy(null);
    }
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return;
    const access = getAccessToken();
    if (!access || !canImportGtmDemos(user)) return;
    setIoBusy('import');
    setImportSummary(null);
    setError('');
    try {
      const result = await importGtmDemoRequests(access, file);
      setImportSummary(result);
      setMsg(`Import: ${result.imported} mới, ${result.skipped} bỏ qua`);
      if (result.imported > 0) await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import thất bại');
    } finally {
      setIoBusy(null);
      setImportOpen(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleProposalPdf(row: GtmDemoRequestRow) {
    const access = getAccessToken();
    if (!access) return;
    setBusyId(row.id);
    setError('');
    try {
      await downloadGtmProposalPdf(access, row.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tải PDF thất bại');
    } finally {
      setBusyId(null);
    }
  }

  function formatSandboxExpiry(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user && loading) {
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
      breadcrumb={[{ label: 'GTM', href: '/crm/gtm/demos' }, { label: 'Demo inbox' }]}
    >
      <HubPageLayout
        title="Demo PTTCRM inbox"
        subtitle="Yêu cầu demo từ pttcrm.com · SLA P50 2h (timezone theo market ASEAN)"
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {canExportGtmDemos(user) ? (
              <button
                type="button"
                className="btn btn-sm"
                disabled={loading || ioBusy != null}
                onClick={() => void handleExport()}
              >
                {ioBusy === 'export' ? 'Đang xuất…' : 'Export Excel'}
              </button>
            ) : null}
            {canImportGtmDemos(user) ? (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={loading || ioBusy != null}
                onClick={() => setImportOpen(true)}
              >
                Import Excel
              </button>
            ) : null}
            <button type="button" className="btn btn-sm btn-ghost" disabled={loading} onClick={() => void load()}>
              Làm mới
            </button>
          </div>
        }
      >
        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="muted">{msg}</p> : null}
        {importSummary ? (
          <p className="muted">
            Import: {importSummary.imported} mới · {importSummary.skipped} bỏ qua
            {importSummary.errors.length ? ` · ${importSummary.errors.length} lỗi` : ''}
          </p>
        ) : null}

        {importOpen ? (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-card" style={{ maxWidth: 420 }}>
              <h3>Import demo leads</h3>
              <p className="muted" style={{ fontSize: '0.9em' }}>
                Cột: full_name, email, phone, company, industry, sku_interest, notes
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => void handleImportFile(e.target.files?.[0])}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setImportOpen(false)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            Status
            <select value={filterStatus} onChange={(e) => setFilter('status', e.target.value)}>
              <option value="">Tất cả</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {GTM_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            Industry
            <select value={filterIndustry} onChange={(e) => setFilter('industry', e.target.value)}>
              <option value="">Tất cả</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {GTM_INDUSTRY_LABELS[i]}
                </option>
              ))}
            </select>
          </label>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            Locale
            <select value={filterLocale} onChange={(e) => setFilter('locale', e.target.value)}>
              <option value="">Tất cả</option>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            Market
            <select value={filterMarket} onChange={(e) => setFilter('market_country', e.target.value)}>
              <option value="">Tất cả</option>
              {MARKETS.map((m) => (
                <option key={m} value={m}>
                  {GTM_MARKET_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <span className="muted">{total} yêu cầu</span>
        </div>

        {loading ? <p className="muted">Đang tải…</p> : null}

        {!loading ? (
          <div className="data-table-wrap">
            <table className="data-table data-table--dense">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Industry</th>
                  <th>SKU</th>
                  <th>Locale</th>
                  <th>Market</th>
                  <th>UTM campaign</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Age</th>
                  <th>SLA</th>
                  <th>Sandbox</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const nextStatuses = GTM_NEXT_STATUSES[row.status];
                  const slaLabel = slaBadgeLabel(row.sla_tone);
                  return (
                    <tr key={row.id}>
                      <td className="muted">{new Date(row.created_at).toLocaleString('vi-VN')}</td>
                      <td>
                        {row.lead_id ? (
                          <Link href={`/crm/leads/${row.lead_id}`} className="link">
                            {row.full_name}
                          </Link>
                        ) : (
                          row.full_name
                        )}
                        <div className="muted" style={{ fontSize: '0.85em' }}>
                          {row.email}
                        </div>
                      </td>
                      <td>{row.company}</td>
                      <td>{GTM_INDUSTRY_LABELS[row.industry]}</td>
                      <td>{GTM_SKU_LABELS[row.sku_interest]}</td>
                      <td>{row.locale.toUpperCase()}</td>
                      <td className="muted">
                        {row.market_country
                          ? GTM_MARKET_LABELS[row.market_country as GtmMarketCountry] ?? row.market_country
                          : '—'}
                      </td>
                      <td className="muted">{row.utm_campaign ?? '—'}</td>
                      <td>
                        {canWriteGtmDemos(user) && nextStatuses.length ? (
                          <select
                            value={row.status}
                            disabled={busyId === row.id}
                            onChange={(e) => void handleStatusChange(row, e.target.value as GtmStatus)}
                            style={{ minWidth: 120 }}
                          >
                            <option value={row.status}>{GTM_STATUS_LABELS[row.status]}</option>
                            {nextStatuses.map((s) => (
                              <option key={s} value={s}>
                                → {GTM_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          GTM_STATUS_LABELS[row.status]
                        )}
                      </td>
                      <td className="muted">{row.owner_user_id ?? '—'}</td>
                      <td>{formatAge(row.created_at)}</td>
                      <td>
                        {slaLabel ? (
                          <span className={slaBadgeClass(row.sla_tone)} title={row.sla_timezone_label ?? undefined}>
                            {slaLabel}
                            {row.sla_deadline_local ? ` · ${row.sla_deadline_local}` : ''}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {row.status === 'sandbox_granted' && row.sandbox_expires_at ? (
                          <span className="badge">Sandbox đến {formatSandboxExpiry(row.sandbox_expires_at)}</span>
                        ) : canGrantSandboxRow(user, row.status) ? (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={busyId === row.id}
                            onClick={() => void handleGrantSandbox(row)}
                          >
                            Grant 14 ngày
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          title="Tải proposal PDF"
                          disabled={busyId === row.id}
                          onClick={() => void handleProposalPdf(row)}
                        >
                          PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length ? (
                  <tr>
                    <td colSpan={14} className="muted">
                      Không có yêu cầu demo
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}

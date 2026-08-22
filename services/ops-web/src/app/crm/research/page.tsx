'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
import { ResearchStatusChip } from '@/components/research/ResearchStatusChip';
import { fetchAgencyClients, staffMe, staffRefresh } from '@/lib/api';
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
  fetchResearchProjects,
  PRODUCT_TYPE_CARDS,
  PROJECT_STATUSES,
  STATUS_LABELS,
  type ResearchProject,
} from '@/lib/market-research-api';
import { isMarketResearchFeEnabled } from '@/lib/market-research-flags';
import { shouldShowTaxonomyNav } from '@/components/research/taxonomy-pane.util';

export default function CrmResearchListPage() {
  return (
    <Suspense fallback={<p className="muted">Đang tải…</p>}>
      <CrmResearchListContent />
    </Suspense>
  );
}

function CrmResearchListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<ResearchProject[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState(searchParams.get('client_id') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [productType, setProductType] = useState(searchParams.get('product_type') ?? '');
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  const persistFilters = useCallback(() => {
    const qs = new URLSearchParams();
    if (clientId) qs.set('client_id', clientId);
    if (status) qs.set('status', status);
    if (productType) qs.set('product_type', productType);
    if (query) qs.set('q', query);
    const next = qs.toString();
    router.replace(next ? `/crm/research?${next}` : '/crm/research');
  }, [clientId, status, productType, query, router]);

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
        persistFilters();
        const [data, agency] = await Promise.all([
          fetchResearchProjects(access, {
            client_id: clientId || undefined,
            status: status || undefined,
            product_type: productType || undefined,
            q: query || undefined,
          }),
          fetchAgencyClients(access).catch(() => ({ clients: [] })),
        ]);
        setRows(data.projects);
        setClients(agency.clients.map((c) => ({ id: c.id, name: c.name })));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải dự án thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, clientId, status, productType, query, persistFilters]);

  function logout() {
    clearSession();
    router.push('/login');
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

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { href: '/crm/research', label: 'Nghiên cứu thị trường' },
      ]}
    >
      <div className="page-card stack-gap">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Nghiên cứu thị trường</h1>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {shouldShowTaxonomyNav(hasCap(user, 'crm_research', 'configure')) ? (
              <Link href="/crm/research/taxonomy" className="btn btn-sm btn-secondary">
                Taxonomy
              </Link>
            ) : null}
            {hasCap(user, 'crm_research', 'create') ? (
              <Link href="/crm/research/new" className="btn btn-sm">
                Tạo project
              </Link>
            ) : null}
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q.trim());
          }}
          style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
        >
          <select className="kpi-input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Tất cả khách hàng</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="kpi-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select className="kpi-input" value={productType} onChange={(e) => setProductType(e.target.value)}>
            <option value="">Tất cả loại</option>
            {PRODUCT_TYPE_CARDS.map((c) => (
              <option key={c.type} value={c.type}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            className="kpi-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm tiêu đề…"
            style={{ flex: 1, minWidth: 180 }}
          />
          <button type="submit" className="btn btn-sm">
            Tìm
          </button>
        </form>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {rows.length === 0 && !loading ? (
          <div className="card" style={{ padding: '1.25rem' }}>
            <p>Chưa có dự án nghiên cứu</p>
            {hasCap(user, 'crm_research', 'create') ? (
              <Link href="/crm/research/new" className="btn btn-sm">
                Tạo project
              </Link>
            ) : null}
          </div>
        ) : null}
        {rows.length ? (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Client</th>
                <th>Tiêu đề</th>
                <th>Loại</th>
                <th>Trạng thái</th>
                <th>Owner</th>
                <th>Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.client_name || p.client_id}</td>
                  <td>
                    <Link href={`/crm/research/${p.id}?tab=brief`} className="nav-link">
                      {p.title}
                    </Link>
                  </td>
                  <td>
                    <code>{p.product_type}</code>
                  </td>
                  <td>
                    <ResearchStatusChip status={p.status} />
                  </td>
                  <td>{p.created_by ?? '—'}</td>
                  <td className="muted">{p.updated_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </StaffPageShell>
  );
}

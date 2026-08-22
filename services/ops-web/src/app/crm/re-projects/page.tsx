'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FilterBar,
  FilterBarActions,
  FilterBarSearch,
  HubPageLayout,
  StaffPageShell,
} from '@/components/layout';
import { createReProject, fetchReProjects, staffMe, staffRefresh, type ReProjectRow } from '@/lib/api';
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

export default function CrmReProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<ReProjectRow[]>([]);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      if (!hasCap(me, 'crm_re_projects', 'view') && !hasCap(me, 'crm_re_projects_products', 'view')) {
        setError('Không có quyền dự án BĐS');
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

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      setError('');
      try {
        setRows(await fetchReProjects(access, query || undefined));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải dự án thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, query]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    try {
      await createReProject(access, { name: newName.trim(), project_type: 'can_ho' });
      setNewName('');
      setRows(await fetchReProjects(access, query || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo dự án thất bại');
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(q.trim());
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      loading={!user}
      width="default"
      breadcrumb={[
        { label: 'CRM', href: '/crm' },
        { label: 'Dự án BĐS', href: '/crm/re-projects' },
        { label: 'Danh sách' },
      ]}
    >
      <HubPageLayout
        title="Dự án BĐS"
        subtitle={`${rows.length.toLocaleString('vi-VN')} dự án`}
      >
        <FilterBar onSubmit={onSearch}>
          <FilterBarSearch value={q} onChange={setQ} placeholder="Tìm tên / mã / quận…" />
          <FilterBarActions>
            <button type="submit" className="btn btn-sm btn-secondary">
              Tìm
            </button>
          </FilterBarActions>
        </FilterBar>

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {rows.map((p) => (
            <li key={p.id} style={{ marginBottom: '0.35rem' }}>
              <Link href={`/crm/re-projects/${p.id}`} className="nav-link">
                {p.name}
              </Link>{' '}
              <span className="muted">
                {p.code || `#${p.id}`} · {p.project_type_label ?? p.project_type} · {p.status}
                {p.city ? ` · ${p.city}` : ''}
              </span>
            </li>
          ))}
        </ul>
        {rows.length === 0 && !loading ? <p className="muted">Chưa có dự án.</p> : null}

        {hasCap(user, 'crm_re_projects', 'create') ? (
          <form onSubmit={(e) => void onCreate(e)} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              className="kpi-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tên dự án mới"
              disabled={saving}
              aria-label="Tên dự án mới"
            />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={saving || !newName.trim()}>
              + Dự án
            </button>
          </form>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}

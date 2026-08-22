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
import { createB2bProject, fetchB2bProjects, type B2bProjectListItem } from '@/lib/b2b-projects-api';
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
import { staffMe, staffRefresh } from '@/lib/api';

export default function CrmB2bProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<B2bProjectListItem[]>([]);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [newCode, setNewCode] = useState('');
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
      if (!hasCap(me, 'crm_b2b_projects', 'view')) {
        setError('Không có quyền Dự án PTT');
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
        const list = await fetchB2bProjects(access);
        const needle = query.trim().toLowerCase();
        setRows(
          needle
            ? list.filter(
                (p) =>
                  p.name.toLowerCase().includes(needle) ||
                  p.code.toLowerCase().includes(needle) ||
                  p.status.toLowerCase().includes(needle),
              )
            : list,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải dự án thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, query]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    try {
      await createB2bProject(access, { code: newCode.trim(), name: newName.trim() });
      setNewCode('');
      setNewName('');
      setRows(await fetchB2bProjects(access));
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
        { label: 'Dự án PTT', href: '/crm/b2b-projects' },
        { label: 'Danh sách' },
      ]}
    >
      <HubPageLayout title="Dự án PTT" subtitle={`${rows.length.toLocaleString('vi-VN')} dự án · chủ quản PTT`}>
        <FilterBar onSubmit={onSearch}>
          <FilterBarSearch value={q} onChange={setQ} placeholder="Tìm tên / mã / trạng thái…" />
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
              <Link href={`/crm/b2b-projects/${p.id}`} className="nav-link">
                {p.name}
              </Link>{' '}
              <span className="muted">
                {p.code} · {p.status}
              </span>
            </li>
          ))}
        </ul>
        {rows.length === 0 && !loading ? <p className="muted">Chưa có dự án PTT.</p> : null}

        {hasCap(user, 'crm_b2b_projects', 'manage') ? (
          <form onSubmit={(e) => void onCreate(e)} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              className="kpi-input"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="Mã (slug webhook)"
              disabled={saving}
              aria-label="Mã dự án"
            />
            <input
              className="kpi-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tên dự án mới"
              disabled={saving}
              aria-label="Tên dự án mới"
            />
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              disabled={saving || !newCode.trim() || !newName.trim()}
            >
              + Dự án
            </button>
          </form>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}

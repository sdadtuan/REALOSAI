'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import { AdminOrgSubNav } from '@/components/rbac/AdminOrgSubNav';
import { ClientScopeImport } from '@/components/rbac/ClientScopeImport';
import { UserIdentityCard } from '@/components/rbac/UserIdentityCard';
import { WinScopeBadge } from '@/components/rbac/WinScopeBadge';
import { WinDrawer } from '@/components/win';
import {
  fetchStaffOrgJobFunctionCatalog,
  fetchStaffOrgPositions,
  fetchStaffOrgUsers,
  type StaffOrgPositionRow,
  type StaffOrgUserSummary,
} from '@/lib/api';
import {
  canEditOrgUsers,
  canViewOrgAdmin,
  useAdminCrmAuth,
} from '@/lib/admin/use-admin-crm-auth';

const PAGE_SIZE = 20;

function AdminOrgUsersPageContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email')?.trim() ?? '';
  const deepLinkHandled = useRef(false);
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewOrgAdmin);
  const [rows, setRows] = useState<StaffOrgUserSummary[]>([]);
  const [positions, setPositions] = useState<StaffOrgPositionRow[]>([]);
  const [catalog, setCatalog] = useState<Array<{ code: string; label: string }>>([]);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState(() => emailParam);
  const [query, setQuery] = useState(() => emailParam);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<StaffOrgUserSummary | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const canEdit = canEditOrgUsers(user);

  const reload = useCallback(async (access: string, search?: string) => {
    const [users, pos, fnCatalog] = await Promise.all([
      fetchStaffOrgUsers(access, { q: search, includeInactive: true }),
      fetchStaffOrgPositions(access),
      fetchStaffOrgJobFunctionCatalog(access),
    ]);
    setRows(users);
    setPositions(pos);
    setCatalog(fnCatalog.map((f) => ({ code: f.code, label: f.label })));
  }, []);

  useEffect(() => {
    if (!token) return;
    void reload(token, query).catch((err) =>
      setLoadError(err instanceof Error ? err.message : 'Tải thất bại'),
    );
  }, [token, query, reload]);

  useEffect(() => {
    if (!emailParam || deepLinkHandled.current || !rows.length) return;
    const needle = emailParam.toLowerCase();
    const matches = rows.filter((r) => r.email.trim().toLowerCase() === needle);
    if (matches.length === 1) {
      deepLinkHandled.current = true;
      setSelected(matches[0]!);
      setDrawerOpen(true);
    }
  }, [emailParam, rows]);

  const highlightEmail = emailParam.toLowerCase();

  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  function openUser(row: StaffOrgUserSummary) {
    setSelected(row);
    setDrawerOpen(true);
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Nhân viên"
      subtitle="Tài khoản staff + onboard wizard"
      breadcrumb={[
        { label: 'Quản trị hệ thống', href: '/admin' },
        { label: 'Người dùng' },
      ]}
      loading={loading}
      actions={
        canEdit ? (
          <Link href="/admin/crm/org/users/new" className="btn btn-primary btn-sm">
            + Onboard NV
          </Link>
        ) : null
      }
    >
      <AdminOrgSubNav />
      {error ? <p className="form-error">{error}</p> : null}
      {loadError ? <p className="form-error">{loadError}</p> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
          setPage(0);
        }}
        style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên / email…"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-sm">
          Tìm
        </button>
      </form>

      {canEdit && token ? (
        <ClientScopeImport token={token} onApplied={() => void reload(token, query)} />
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Email</th>
              <th>Chức vụ · Team · Functions</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={row.id}
                className={
                  highlightEmail && row.email.trim().toLowerCase() === highlightEmail
                    ? 'is-highlighted'
                    : undefined
                }
              >
                <td>
                  <button type="button" className="btn btn-link" onClick={() => openUser(row)}>
                    {row.display_name}
                  </button>
                </td>
                <td>{row.email}</td>
                <td>
                  <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                    {row.position_code ?? row.position_id}
                    {row.team_codes?.length ? ` · ${row.team_codes.join(', ')}` : ''}
                    {row.job_functions?.length ? ` · ${row.job_functions.join(', ')}` : ''}
                    <WinScopeBadge clientIds={row.client_ids} />
                  </span>
                </td>
                <td>{row.active === false ? 'Ngưng' : 'Hoạt động'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="win-filter-chips" style={{ marginTop: '0.75rem' }}>
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`chip${page === i ? ' is-active' : ''}`}
              onClick={() => setPage(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      ) : null}

      {token && selected ? (
        <WinDrawer
          open={drawerOpen}
          title={selected.display_name}
          onClose={() => setDrawerOpen(false)}
        >
          <UserIdentityCard
            token={token}
            user={selected}
            positions={positions}
            functionOptions={catalog}
            canEdit={canEdit}
            onSaved={(updated) => {
              setSelected(updated);
              void reload(token, query);
            }}
            onOffboarded={() => {
              setDrawerOpen(false);
              void reload(token, query);
            }}
          />
        </WinDrawer>
      ) : null}
    </AdminPageShell>
  );
}

export default function AdminOrgUsersPage() {
  return (
    <Suspense
      fallback={
        <AdminPageShell
          user={null}
          onLogout={() => {}}
          section="crm-config"
          title="Nhân viên"
          loading
        >
          <span />
        </AdminPageShell>
      }
    >
      <AdminOrgUsersPageContent />
    </Suspense>
  );
}

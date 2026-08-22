'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import { AdminPermissionsSubNav } from '@/components/rbac/AdminPermissionsSubNav';
import {
  createStaffPermissionSet,
  fetchStaffPermissionSets,
  staffMe,
  staffRefresh,
  type StaffPermissionSetSummary,
} from '@/lib/api';
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
import { winPermissionSetsEnabled } from '@/lib/win/flags';

export default function AdminCrmPermissionSetsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [sets, setSets] = useState<StaffPermissionSetSummary[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');

  const canConfigure = hasCap(user, 'crm_data_config', 'configure');

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    if (!winPermissionSetsEnabled()) {
      setError('Permission Sets chưa bật (NEXT_PUBLIC_WIN_PERMISSION_SETS=1)');
      return null;
    }
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
      if (!hasCap(me, 'crm_data_config', 'configure')) {
        setError('Không có quyền cấu hình Permission Sets');
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

  const loadSets = useCallback(async (access: string) => {
    setSets(await fetchStaffPermissionSets(access));
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        await loadSets(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải danh sách thất bại');
      }
    })();
  }, [ensureAuth, loadSets]);

  async function handleCreate() {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    setBusy(true);
    setError('');
    try {
      await createStaffPermissionSet(access, { code: newCode, name: newName || newCode });
      setNewCode('');
      setNewName('');
      await loadSets(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo set thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      title="Bộ quyền bổ sung (Permission Sets)"
      subtitle="R2-B — gắn cap lẻ cho user mà không sửa ma trận chức vụ mặc định."
      section="crm-config"
      user={user}
      onLogout={logout}
    >
      <AdminPermissionsSubNav />
      {error ? <p className="form-error">{error}</p> : null}

      {canConfigure ? (
        <section className="stack-gap" style={{ marginBottom: '1rem' }}>
          <h3 className="section-title">Tạo set mới</h3>
          <div className="form-row">
            <label>
              Mã (VD: SET-SOLUTION-BACKUP)
              <input value={newCode} onChange={(e) => setNewCode(e.target.value)} disabled={busy} />
            </label>
            <label>
              Tên hiển thị
              <input value={newName} onChange={(e) => setNewName(e.target.value)} disabled={busy} />
            </label>
            <button type="button" className="btn btn-primary" onClick={() => void handleCreate()} disabled={busy}>
              Tạo
            </button>
          </div>
        </section>
      ) : null}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên</th>
              <th>Grants</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sets.map((set) => (
              <tr key={set.code}>
                <td>{set.code}</td>
                <td>{set.name}</td>
                <td className="muted">{set.grant_count}</td>
                <td>
                  {canConfigure ? (
                    <Link href={`/admin/crm/permission-sets/${encodeURIComponent(set.code)}`} className="nav-link">
                      Sửa ma trận
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}

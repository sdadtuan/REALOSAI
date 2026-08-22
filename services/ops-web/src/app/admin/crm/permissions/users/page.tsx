'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import { AdminPermissionsSubNav } from '@/components/rbac/AdminPermissionsSubNav';
import { EffectiveCapsPreview } from '@/components/rbac/EffectiveCapsPreview';
import { JobFunctionPicker } from '@/components/rbac/JobFunctionPicker';
import { WinReloginToast } from '@/components/win';
import {
  fetchStaffOrgJobFunctionCatalog,
  fetchStaffOrgUsers,
  fetchStaffUserEffectiveCaps,
  fetchStaffUserJobFunctions,
  putStaffUserJobFunctions,
  staffMe,
  staffRefresh,
  type StaffOrgUserSummary,
  type StaffUserEffectiveCaps,
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
import { detectSodViolations } from '@/lib/rbac/sod-rules';

export default function AdminCrmPermissionUsersPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [users, setUsers] = useState<StaffOrgUserSummary[]>([]);
  const [catalog, setCatalog] = useState<Array<{ code: string; label: string }>>([]);
  const [selectedId, setSelectedId] = useState('');
  const [functions, setFunctions] = useState<string[]>([]);
  const [baseline, setBaseline] = useState<string[]>([]);
  const [preview, setPreview] = useState<StaffUserEffectiveCaps | null>(null);
  const [error, setError] = useState('');
  const [showReloginToast, setShowReloginToast] = useState(false);
  const [busy, setBusy] = useState(false);

  const canConfigure = hasCap(user, 'crm_data_config', 'configure');
  const sodViolations = useMemo(() => detectSodViolations(functions), [functions]);
  const selected = users.find((u) => u.id === selectedId) ?? null;

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

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
      if (!hasCap(me, 'crm_data_config', 'view') && !hasCap(me, 'crm_staff_roster', 'view')) {
        setError('Không có quyền gán job function');
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

  const loadUser = useCallback(async (access: string, userId: string) => {
    const detail = await fetchStaffUserJobFunctions(access, userId);
    const next = [...(detail.functions ?? [])].sort();
    setFunctions(next);
    setBaseline(next);
    try {
      setPreview(await fetchStaffUserEffectiveCaps(access, userId));
    } catch {
      setPreview(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        const [rows, fnCatalog] = await Promise.all([
          fetchStaffOrgUsers(access),
          fetchStaffOrgJobFunctionCatalog(access),
        ]);
        setUsers(rows);
        setCatalog(fnCatalog.map((f) => ({ code: f.code, label: f.label })));
        if (rows.length) {
          setSelectedId(rows[0].id);
          await loadUser(access, rows[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải danh sách user thất bại');
      }
    })();
  }, [ensureAuth, loadUser]);

  async function handleSave() {
    const access = getAccessToken();
    if (!access || !canConfigure || !selectedId || sodViolations.length) return;
    setBusy(true);
    setError('');
    try {
      await putStaffUserJobFunctions(access, selectedId, functions);
      await loadUser(access, selectedId);
      setShowReloginToast(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu job functions thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <AdminPageShell user={null} onLogout={logout} section="crm-config" title="Gán job function" loading>
        <span />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Gán job function cho user"
      subtitle="R1.5 — tối đa 3 function, union vào caps chức vụ"
      actions={
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy || !canConfigure || !selectedId || sodViolations.length > 0}
          onClick={() => void handleSave()}
        >
          Lưu job functions
        </button>
      }
    >
      <div className="page-card stack-gap">
        <AdminPermissionsSubNav />
        {showReloginToast ? (
          <WinReloginToast message="Đã lưu job functions. Yêu cầu NV đăng xuất và đăng nhập lại để badge/menu cập nhật." />
        ) : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="win-info-callout">
          Chọn nhân viên đăng nhập ops-web (<code>staff_users</code>). Caps hiệu lực = chức vụ + functions.
        </div>

        <div className="kpi-page__filters">
          <label className="muted">
            User
            <select
              value={selectedId}
              disabled={busy}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedId(id);
                const access = getAccessToken();
                if (access && id) void loadUser(access, id);
              }}
            >
              {users.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.display_name} ({row.email})
                  {row.job_functions.length ? ` · ${row.job_functions.join(',')}` : ''}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <span className="muted">
              {selected.position_code ?? `position_id=${selected.position_id}`}
            </span>
          ) : null}
        </div>

        {!canConfigure ? (
          <p className="muted">Chế độ chỉ xem — cần crm_data_config.configure để lưu.</p>
        ) : null}

        <JobFunctionPicker
          options={catalog}
          value={functions}
          disabled={!canConfigure || busy}
          onChange={setFunctions}
        />

        {baseline.join(',') !== functions.join(',') ? (
          <p className="muted" role="status">
            Thay đổi chưa lưu: {baseline.join(', ') || '(trống)'} → {functions.join(', ') || '(trống)'}
          </p>
        ) : null}

        <EffectiveCapsPreview preview={preview} loading={busy} />
      </div>
    </AdminPageShell>
  );
}

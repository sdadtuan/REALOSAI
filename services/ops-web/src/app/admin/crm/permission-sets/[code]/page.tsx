'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import { AdminPermissionsSubNav } from '@/components/rbac/AdminPermissionsSubNav';
import { PermissionMatrixTable } from '@/components/rbac/PermissionMatrixTable';
import { WinDiffChip, WinReloginToast } from '@/components/win';
import {
  fetchStaffPermissionSet,
  putStaffPermissionSetGrants,
  staffMe,
  staffRefresh,
  type StaffPermissionMatrixRow,
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
import { computeGrantDiff } from '@/lib/rbac/grant-diff';
import { winPermissionSetsEnabled } from '@/lib/win/flags';

function grantsToPayload(grants: Record<string, string[]>) {
  const rows: Array<{ section_id: string; action: string }> = [];
  for (const [section_id, actions] of Object.entries(grants)) {
    for (const action of actions) {
      rows.push({ section_id, action });
    }
  }
  return rows;
}

export default function AdminCrmPermissionSetEditorPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(String(params.code ?? ''));

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [setName, setSetName] = useState('');
  const [matrix, setMatrix] = useState<StaffPermissionMatrixRow[]>([]);
  const [grants, setGrants] = useState<Record<string, string[]>>({});
  const [baselineGrants, setBaselineGrants] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [showReloginToast, setShowReloginToast] = useState(false);
  const [busy, setBusy] = useState(false);

  const canConfigure = hasCap(user, 'crm_data_config', 'configure');
  const diff = useMemo(() => computeGrantDiff(baselineGrants, grants), [baselineGrants, grants]);

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
        setError('Không có quyền sửa Permission Sets');
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

  const loadSet = useCallback(
    async (access: string) => {
      const detail = await fetchStaffPermissionSet(access, code);
      setSetName(detail.name);
      setMatrix(detail.matrix);
      const grantMap: Record<string, string[]> = {};
      for (const g of detail.grants ?? []) {
        const list = grantMap[g.section_id] ?? [];
        if (!list.includes(g.action)) list.push(g.action);
        grantMap[g.section_id] = list.sort();
      }
      setGrants(grantMap);
      setBaselineGrants(structuredClone(grantMap));
    },
    [code],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        await loadSet(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải set thất bại');
      }
    })();
  }, [ensureAuth, loadSet]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, StaffPermissionMatrixRow[]>();
    for (const row of matrix) {
      const list = groups.get(row.group) ?? [];
      list.push(row);
      groups.set(row.group, list);
    }
    return [...groups.entries()];
  }, [matrix]);

  function isAllowed(sectionId: string, action: string): boolean {
    return (grants[sectionId] ?? []).includes(action);
  }

  function toggleCap(sectionId: string, action: string, checked: boolean) {
    setGrants((prev) => {
      const next = { ...prev };
      const current = new Set(next[sectionId] ?? []);
      if (checked) current.add(action);
      else current.delete(action);
      if (current.size) next[sectionId] = [...current].sort();
      else delete next[sectionId];
      return next;
    });
  }

  async function handleSave() {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    setBusy(true);
    setError('');
    try {
      await putStaffPermissionSetGrants(access, code, grantsToPayload(grants));
      await loadSet(access);
      setShowReloginToast(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu ma trận set thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      title={`Permission Set — ${code}`}
      subtitle={setName || 'Ma trận quyền bổ sung (union vào user)'}
      section="crm-config"
      user={user}
      onLogout={logout}
      actions={
        <div className="toolbar-actions">
          <WinDiffChip added={diff.added} removed={diff.removed} />
          <Link href="/admin/crm/permission-sets" className="btn btn-ghost">
            ← Danh sách
          </Link>
          <button type="button" className="btn btn-primary" disabled={busy || !canConfigure} onClick={() => void handleSave()}>
            Lưu ma trận set
          </button>
        </div>
      }
    >
      <AdminPermissionsSubNav />
      {showReloginToast ? <WinReloginToast message="User gắn set này cần đăng nhập lại để caps có hiệu lực." /> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="win-info-callout">
        Grants trong set được <strong>union</strong> với chức vụ + job function khi tính effective caps.
      </div>

      <PermissionMatrixTable
        groupedRows={groupedRows}
        grants={grants}
        canConfigure={canConfigure}
        busy={busy}
        isAllowed={isAllowed}
        onToggle={toggleCap}
        addonTag
      />
    </AdminPageShell>
  );
}

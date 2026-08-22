'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import { AdminPermissionsSubNav } from '@/components/rbac/AdminPermissionsSubNav';
import { PermissionMatrixTable } from '@/components/rbac/PermissionMatrixTable';
import { WinDiffChip, WinReloginToast } from '@/components/win';
import {
  exportStaffJobFunction,
  fetchStaffJobFunction,
  fetchStaffJobFunctions,
  patchStaffJobFunction,
  staffMe,
  staffRefresh,
  type StaffJobFunctionSummary,
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
import { detectContentApproveSod } from '@/lib/rbac/sod-rules';

function grantsFromDetail(grants: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(grants).map(([k, v]) => [k, [...v].sort()]));
}

export default function AdminCrmPermissionFunctionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [functions, setFunctions] = useState<StaffJobFunctionSummary[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [matrix, setMatrix] = useState<StaffPermissionMatrixRow[]>([]);
  const [grants, setGrants] = useState<Record<string, string[]>>({});
  const [baselineGrants, setBaselineGrants] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [showReloginToast, setShowReloginToast] = useState(false);
  const [busy, setBusy] = useState(false);

  const canConfigure = hasCap(user, 'crm_data_config', 'configure');
  const diff = useMemo(() => computeGrantDiff(baselineGrants, grants), [baselineGrants, grants]);
  const sodViolation = useMemo(() => detectContentApproveSod(grants), [grants]);

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
      if (!hasCap(me, 'crm_data_config', 'view')) {
        setError('Không có quyền xem ma trận job function');
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

  const loadFunction = useCallback(async (access: string, code: string) => {
    const detail = await fetchStaffJobFunction(access, code);
    const nextGrants = grantsFromDetail(detail.grants);
    setMatrix(detail.matrix);
    setGrants(nextGrants);
    setBaselineGrants(nextGrants);
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        const rows = await fetchStaffJobFunctions(access);
        setFunctions(rows);
        if (rows.length) {
          setSelectedCode(rows[0].code);
          await loadFunction(access, rows[0].code);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải job functions thất bại');
      }
    })();
  }, [ensureAuth, loadFunction]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, StaffPermissionMatrixRow[]>();
    for (const row of matrix) {
      const list = groups.get(row.group) ?? [];
      list.push(row);
      groups.set(row.group, list);
    }
    return [...groups.entries()];
  }, [matrix]);

  const selected = functions.find((f) => f.code === selectedCode) ?? null;

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
    if (!access || !canConfigure || !selectedCode) return;
    if (sodViolation) {
      setError(sodViolation.message);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await patchStaffJobFunction(access, selectedCode, { grants });
      await loadFunction(access, selectedCode);
      setShowReloginToast(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu ma trận function thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    const access = getAccessToken();
    if (!access || !selectedCode) return;
    setBusy(true);
    try {
      const data = await exportStaffJobFunction(access, selectedCode);
      const blob = new Blob([String(data.markdown ?? '')], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rbac-function-${data.function_code ?? selectedCode}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xuất ma trận thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <AdminPageShell user={null} onLogout={logout} section="crm-config" title="Job function" loading>
        <span />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Ma trận job function"
      subtitle="Add-on caps union vào chức vụ gốc — R1.5"
      actions={
        <div className="toolbar-actions">
          <WinDiffChip added={diff.added} removed={diff.removed} />
          <button type="button" className="btn btn--secondary" disabled={busy || !selectedCode} onClick={() => void handleExport()}>
            Xuất MD
          </button>
          <button type="button" className="btn btn--primary" disabled={busy || !canConfigure || !selectedCode || !!sodViolation} onClick={() => void handleSave()}>
            Lưu ma trận function
          </button>
        </div>
      }
    >
      <div className="page-card stack-gap">
        <AdminPermissionsSubNav />
        {showReloginToast ? <WinReloginToast /> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="win-info-callout">
          Caps ở đây <strong>cộng</strong> với ma trận chức vụ. Không thay caps base.
        </div>

        <div className="kpi-page__filters">
          <label className="muted">
            Job function
            <select
              value={selectedCode}
              disabled={busy}
              onChange={(e) => {
                const code = e.target.value;
                setSelectedCode(code);
                const access = getAccessToken();
                if (access && code) void loadFunction(access, code);
              }}
            >
              {functions.map((fn) => (
                <option key={fn.code} value={fn.code}>
                  {fn.code} — {fn.label}
                  {fn.grants_customized ? ' (đã tùy chỉnh)' : ''}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <span className="muted">
              scope: {selected.department_scope} · {selected.description}
            </span>
          ) : null}
        </div>

        {sodViolation ? <p className="error">{sodViolation.message}</p> : null}

        <PermissionMatrixTable
          groupedRows={groupedRows}
          grants={grants}
          canConfigure={canConfigure}
          busy={busy}
          isAllowed={isAllowed}
          onToggle={toggleCap}
          addonTag
        />
      </div>
    </AdminPageShell>
  );
}

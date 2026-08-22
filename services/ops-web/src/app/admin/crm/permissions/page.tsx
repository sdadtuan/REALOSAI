'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import { AdminPermissionsSubNav } from '@/components/rbac/AdminPermissionsSubNav';
import { WinAccessReviewExport } from '@/components/rbac/WinAccessReviewExport';
import { BreakGlassRequestModal } from '@/components/rbac/BreakGlassRequestModal';
import { PermissionMatrixTable } from '@/components/rbac/PermissionMatrixTable';
import { WinDiffChip, WinReloginToast } from '@/components/win';
import {
  exportStaffPermissionPosition,
  fetchStaffPermissionAudit,
  fetchStaffPermissionPosition,
  fetchStaffPermissionPositions,
  patchStaffPermissionPosition,
  signAdminConfigSnapshot,
  staffMe,
  staffRefresh,
  type StaffPermissionAuditRow,
  type StaffPermissionMatrixRow,
  type StaffPermissionPositionDetail,
  type StaffPermissionPositionSummary,
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
import { winBreakGlassEnabled } from '@/lib/win/flags';

function grantsFromDetail(detail: StaffPermissionPositionDetail): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(detail.grants).map(([k, v]) => [k, [...v].sort()]),
  );
}

export default function AdminCrmPermissionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [positions, setPositions] = useState<StaffPermissionPositionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [matrix, setMatrix] = useState<StaffPermissionMatrixRow[]>([]);
  const [grants, setGrants] = useState<Record<string, string[]>>({});
  const [baselineGrants, setBaselineGrants] = useState<Record<string, string[]>>({});
  const [audit, setAudit] = useState<StaffPermissionAuditRow[]>([]);
  const [error, setError] = useState('');
  const [showReloginToast, setShowReloginToast] = useState(false);
  const [breakGlassOpen, setBreakGlassOpen] = useState(false);
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
        setError('Không có quyền xem ma trận phân quyền (crm_data_config.view)');
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

  const loadPosition = useCallback(async (access: string, positionId: number) => {
    const detail = await fetchStaffPermissionPosition(access, positionId);
    const nextGrants = grantsFromDetail(detail);
    setMatrix(detail.matrix);
    setGrants(nextGrants);
    setBaselineGrants(nextGrants);
    const auditRows = await fetchStaffPermissionAudit(access, { position_id: positionId, limit: 20 });
    setAudit(auditRows);
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        const rows = await fetchStaffPermissionPositions(access);
        setPositions(rows);
        if (rows.length) {
          const firstId = rows[0].id;
          setSelectedId(firstId);
          await loadPosition(access, firstId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải ma trận phân quyền thất bại');
      }
    })();
  }, [ensureAuth, loadPosition]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, StaffPermissionMatrixRow[]>();
    for (const row of matrix) {
      const list = groups.get(row.group) ?? [];
      list.push(row);
      groups.set(row.group, list);
    }
    return [...groups.entries()];
  }, [matrix]);

  const selectedPosition = positions.find((p) => p.id === selectedId) ?? null;

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

  async function handlePositionChange(positionId: number) {
    const access = getAccessToken();
    if (!access) return;
    setSelectedId(positionId);
    setBusy(true);
    setError('');
    try {
      await loadPosition(access, positionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải chức vụ thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    const access = getAccessToken();
    if (!access || !canConfigure || selectedId == null) return;
    if (sodViolation) {
      setError(sodViolation.message);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await patchStaffPermissionPosition(access, selectedId, { grants });
      await loadPosition(access, selectedId);
      setShowReloginToast(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu ma trận thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    const access = getAccessToken();
    if (!access || selectedId == null) return;
    setBusy(true);
    setError('');
    try {
      const data = await exportStaffPermissionPosition(access, selectedId);
      const blob = new Blob([String(data.markdown ?? JSON.stringify(data, null, 2))], {
        type: 'text/markdown;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rbac-${data.position_code ?? selectedId}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xuất ma trận thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignSnapshot() {
    const access = getAccessToken();
    if (!access || selectedId == null) return;
    const pos = positions.find((p) => p.id === selectedId);
    if (!pos) return;
    setBusy(true);
    setError('');
    try {
      await signAdminConfigSnapshot(access, {
        snapshot_type: 'permission_matrix',
        entity_key: pos.code,
        note: `Snapshot ma trận ${pos.code}`,
        payload: { grants, position_id: selectedId, position_code: pos.code },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ký snapshot thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <AdminPageShell
        user={null}
        onLogout={logout}
        section="crm-config"
        title="Ma trận phân quyền"
        subtitle="Quản lý caps theo chức vụ trên PostgreSQL (R1-S3)"
        loading
      >
        <span />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Ma trận phân quyền"
      subtitle="Quản lý caps theo chức vụ trên PostgreSQL — mọi thay đổi được ghi audit"
      actions={
        <div className="toolbar-actions">
          <WinDiffChip added={diff.added} removed={diff.removed} />
          {canConfigure ? <WinAccessReviewExport disabled={busy} /> : null}
          {winBreakGlassEnabled() ? (
            <button type="button" className="btn btn--secondary" onClick={() => setBreakGlassOpen(true)}>
              Break-glass
            </button>
          ) : null}
          <button type="button" className="btn btn--secondary" disabled={busy || selectedId == null} onClick={() => void handleExport()}>
            Xuất MD
          </button>
          {canConfigure ? (
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy || selectedId == null}
              onClick={() => void handleSignSnapshot()}
            >
              Ký snapshot
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy || !canConfigure || selectedId == null || !!sodViolation}
            onClick={() => void handleSave()}
          >
            Lưu ma trận
          </button>
        </div>
      }
    >
      <div className="page-card stack-gap">
        <AdminPermissionsSubNav />
        {showReloginToast ? <WinReloginToast /> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="win-info-callout">
          Caps <strong>base</strong> theo chức vụ. Job function add-on cấu hình ở tab Job function.
        </div>

        <div className="kpi-page__filters">
          <label className="muted">
            Chức vụ
            <select
              value={selectedId ?? ''}
              disabled={busy}
              onChange={(e) => void handlePositionChange(Number(e.target.value))}
            >
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                  {p.grants_customized ? ' (đã tùy chỉnh)' : ''}
                </option>
              ))}
            </select>
          </label>
          {selectedPosition ? (
            <span className="muted">
              position_id={selectedPosition.id}
              {selectedPosition.grants_customized ? ' · grants_customized' : ' · default/migrated'}
            </span>
          ) : null}
        </div>

        {!canConfigure ? (
          <p className="muted">Chế độ chỉ xem — cần quyền crm_data_config.configure để lưu.</p>
        ) : null}

        {sodViolation ? <p className="error">{sodViolation.message}</p> : null}

        <PermissionMatrixTable
          groupedRows={groupedRows}
          grants={grants}
          canConfigure={canConfigure}
          busy={busy}
          isAllowed={isAllowed}
          onToggle={toggleCap}
        />

        <section className="stack-gap">
          <div className="toolbar-actions">
            <h3 className="section-title">Audit log (20 gần nhất)</h3>
            <Link href="/admin/audit?category=permission_matrix" className="muted">
              Xem toàn bộ audit →
            </Link>
            {' · '}
            <Link href="/admin/audit/access-reviews" className="muted">
              Access review campaigns →
            </Link>
          </div>
          {audit.length === 0 ? (
            <p className="muted">Chưa có bản ghi audit cho chức vụ này.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Actor</th>
                    <th>Thay đổi</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((row) => {
                    const auditDiff = row.diff_json as { added?: unknown[]; removed?: unknown[] };
                    return (
                      <tr key={row.id}>
                        <td>{new Date(row.created_at).toLocaleString('vi-VN')}</td>
                        <td>{row.actor_email || '—'}</td>
                        <td className="muted">
                          +{(auditDiff.added ?? []).length} / -{(auditDiff.removed ?? []).length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {winBreakGlassEnabled() && user ? (
        <BreakGlassRequestModal user={user} open={breakGlassOpen} onClose={() => setBreakGlassOpen(false)} />
      ) : null}
    </AdminPageShell>
  );
}

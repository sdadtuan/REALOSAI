'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { AdminPermissionsSubNav } from '@/components/rbac/AdminPermissionsSubNav';
import {
  fetchStaffOrgPositions,
  fetchStaffSsoGroups,
  upsertStaffSsoGroup,
  type StaffKeycloakGroupMapRow,
  type StaffOrgPositionRow,
} from '@/lib/api';
import { canConfigureData, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';
import { winSsoEnabled } from '@/lib/win/flags';

const DEFAULT_GROUPS = [
  'grp-super-admin',
  'grp-gdkd',
  'grp-am',
  'grp-mkt',
  'grp-cskh',
  'grp-it-admin',
  'grp-hr-ops',
];

export default function AdminStaffSsoGroupsPage() {
  const { user, token, error: authError, loading: authLoading, logout } = useAdminCrmAuth(canConfigureData);
  const [groups, setGroups] = useState<StaffKeycloakGroupMapRow[]>([]);
  const [positions, setPositions] = useState<StaffOrgPositionRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [newGroup, setNewGroup] = useState('grp-am');
  const [newPositionId, setNewPositionId] = useState('');

  const load = useCallback(async (access: string) => {
    setError('');
    const [groupRes, posRows] = await Promise.all([
      fetchStaffSsoGroups(access),
      fetchStaffOrgPositions(access),
    ]);
    setGroups(groupRes.groups);
    setPositions(posRows);
    if (!newPositionId && posRows[0]) {
      setNewPositionId(String(posRows[0].id));
    }
  }, [newPositionId]);

  useEffect(() => {
    if (!token || !winSsoEnabled()) return;
    void load(token).catch((err) => {
      setError(err instanceof Error ? err.message : 'Tải SSO groups thất bại');
    });
  }, [token, load]);

  async function onSave(
    kcGroup: string,
    positionId: number,
    active: boolean,
  ) {
    if (!token) return;
    setBusy(kcGroup);
    setError('');
    try {
      await upsertStaffSsoGroup(token, kcGroup, { position_id: positionId, active });
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy('');
    }
  }

  async function onAddGroup(e: FormEvent) {
    e.preventDefault();
    if (!token || !newGroup.trim() || !newPositionId) return;
    await onSave(newGroup.trim(), Number(newPositionId), true);
    setNewGroup('');
  }

  const mapByGroup = new Map(groups.map((g) => [g.kc_group, g]));

  return (
    <AdminPageShell
      title="Keycloak group → chức vụ"
      subtitle="WIN-4-A — ánh xạ nhóm IdP sang crm_positions (HR + IT)"
      section="crm-config"
      user={user}
      onLogout={logout}
    >
      <AdminPermissionsSubNav />
      {!winSsoEnabled() ? (
        <p className="error">Bật NEXT_PUBLIC_WIN_SSO=1 để quản lý group map.</p>
      ) : null}
      {authLoading ? <p className="muted">Đang xác thực…</p> : null}
      {authError ? <p className="error">{authError}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <form onSubmit={onAddGroup} className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Thêm / cập nhật mapping</h2>
        <div className="field">
          <label htmlFor="kc_group">Keycloak group</label>
          <input
            id="kc_group"
            list="kc-group-suggestions"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder="grp-am"
            required
          />
          <datalist id="kc-group-suggestions">
            {DEFAULT_GROUPS.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="position_id">Chức vụ CRM</label>
          <select
            id="position_id"
            value={newPositionId}
            onChange={(e) => setNewPositionId(e.target.value)}
            required
          >
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!!busy}>
          Lưu mapping
        </button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Keycloak group</th>
              <th>Chức vụ</th>
              <th>Trạng thái</th>
              <th>Cập nhật</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {DEFAULT_GROUPS.map((kcGroup) => {
              const row = mapByGroup.get(kcGroup);
              return (
                <tr key={kcGroup}>
                  <td>
                    <code>{kcGroup}</code>
                  </td>
                  <td>
                    {row ? (
                      <>
                        {row.position_code ?? row.position_id} — {row.position_name ?? ''}
                      </>
                    ) : (
                      <span className="muted">Chưa map</span>
                    )}
                  </td>
                  <td>{row?.active === false ? 'Tắt' : row ? 'Bật' : '—'}</td>
                  <td className="muted" style={{ fontSize: '0.85rem' }}>
                    {row?.updated_by ? `${row.updated_by}` : '—'}
                  </td>
                  <td>
                    {row ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy === kcGroup}
                        onClick={() =>
                          void onSave(kcGroup, row.position_id, row.active !== false)
                        }
                      >
                        Refresh
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}

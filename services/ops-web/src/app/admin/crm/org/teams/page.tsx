'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { AdminOrgSubNav } from '@/components/rbac/AdminOrgSubNav';
import {
  createStaffOrgTeam,
  fetchStaffOrgDepartments,
  fetchStaffOrgTeams,
  patchStaffOrgTeam,
  type StaffDepartmentRow,
  type StaffTeamRow,
} from '@/lib/api';
import {
  canConfigureOrgStructure,
  canViewOrgAdmin,
  useAdminCrmAuth,
} from '@/lib/admin/use-admin-crm-auth';

export default function AdminOrgTeamsPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewOrgAdmin);
  const [departments, setDepartments] = useState<StaffDepartmentRow[]>([]);
  const [deptFilter, setDeptFilter] = useState<number | ''>('');
  const [rows, setRows] = useState<StaffTeamRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');

  const canConfigure = canConfigureOrgStructure(user);

  const reload = useCallback(
    async (access: string) => {
      const deptId = deptFilter === '' ? undefined : Number(deptFilter);
      setRows(await fetchStaffOrgTeams(access, deptId));
    },
    [deptFilter],
  );

  useEffect(() => {
    if (!token) return;
    void fetchStaffOrgDepartments(token)
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void reload(token).catch((err) => setFormError(err instanceof Error ? err.message : 'Tải thất bại'));
  }, [token, reload]);

  const deptLabel = useMemo(
    () => Object.fromEntries(departments.map((d) => [d.id, `${d.code} — ${d.name}`])),
    [departments],
  );

  function openCreate() {
    setEditId(null);
    setCode('');
    setName('');
    setDepartmentId(deptFilter === '' ? '' : deptFilter);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(row: StaffTeamRow) {
    setEditId(row.id);
    setCode(row.code);
    setName(row.name);
    setDepartmentId(row.department_id ?? '');
    setFormError('');
    setModalOpen(true);
  }

  async function save() {
    if (!token || !canConfigure) return;
    setBusy(true);
    setFormError('');
    try {
      const payload = {
        code,
        name,
        department_id: departmentId === '' ? null : Number(departmentId),
      };
      if (editId == null) {
        await createStaffOrgTeam(token, payload);
      } else {
        await patchStaffOrgTeam(token, editId, payload);
      }
      await reload(token);
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Team"
      subtitle="Nhóm trong phòng ban"
      breadcrumb={[
        { label: 'Cấu hình CRM', href: '/admin/crm/custom-fields' },
        { label: 'Tổ chức', href: '/admin/crm/org/teams' },
        { label: 'Team' },
      ]}
      loading={loading}
      actions={
        canConfigure ? (
          <button type="button" className="btn btn-primary" onClick={openCreate} disabled={busy}>
            + Team
          </button>
        ) : null
      }
    >
      <AdminOrgSubNav />
      {error ? <p className="form-error">{error}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}

      <div className="win-filter-chips" style={{ marginBottom: '0.75rem' }}>
        <button
          type="button"
          className={`chip${deptFilter === '' ? ' is-active' : ''}`}
          onClick={() => setDeptFilter('')}
        >
          Tất cả phòng
        </button>
        {departments.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`chip${deptFilter === d.id ? ' is-active' : ''}`}
            onClick={() => setDeptFilter(d.id)}
          >
            {d.code}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên</th>
              <th>Phòng</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.code}</td>
                <td>{row.name}</td>
                <td>{row.department_code ?? deptLabel[row.department_id ?? -1] ?? '—'}</td>
                <td>{row.active ? 'Hoạt động' : 'Ngưng'}</td>
                <td>
                  {canConfigure ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(row)}>
                      Sửa
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setModalOpen(false)}>
          <div className="modal-card" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{editId == null ? 'Thêm team' : 'Sửa team'}</h3>
            <label>
              Mã
              <input value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <label>
              Tên
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Phòng ban
              <select
                value={departmentId === '' ? '' : String(departmentId)}
                onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                Hủy
              </button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
                Lưu
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPageShell>
  );
}

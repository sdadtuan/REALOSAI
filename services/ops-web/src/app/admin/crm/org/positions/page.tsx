'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminPageShell } from '@/components/admin';
import { AdminOrgSubNav } from '@/components/rbac/AdminOrgSubNav';
import {
  fetchStaffOrgDepartments,
  fetchStaffOrgPositions,
  patchStaffOrgPosition,
  type StaffDepartmentRow,
  type StaffOrgPositionRow,
} from '@/lib/api';
import {
  canConfigureData,
  canViewOrgAdmin,
  useAdminCrmAuth,
} from '@/lib/admin/use-admin-crm-auth';

export default function AdminOrgPositionsPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewOrgAdmin);
  const [departments, setDepartments] = useState<StaffDepartmentRow[]>([]);
  const [rows, setRows] = useState<StaffOrgPositionRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [editRow, setEditRow] = useState<StaffOrgPositionRow | null>(null);
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');

  const canConfigure = canConfigureData(user);

  const reload = useCallback(async (access: string) => {
    setRows(await fetchStaffOrgPositions(access));
  }, []);

  useEffect(() => {
    if (!token) return;
    void Promise.all([fetchStaffOrgPositions(token), fetchStaffOrgDepartments(token)])
      .then(([positions, depts]) => {
        setRows(positions);
        setDepartments(depts);
      })
      .catch((err) => setFormError(err instanceof Error ? err.message : 'Tải thất bại'));
  }, [token]);

  const deptLabel = useMemo(
    () => Object.fromEntries(departments.map((d) => [d.id, `${d.code} — ${d.name}`])),
    [departments],
  );

  function openEdit(row: StaffOrgPositionRow) {
    setEditRow(row);
    setName(row.name);
    setDepartmentId(row.department_id ?? '');
    setFormError('');
  }

  async function save() {
    if (!token || !canConfigure || !editRow) return;
    setBusy(true);
    try {
      await patchStaffOrgPosition(token, editRow.id, {
        name,
        department_id: departmentId === '' ? null : Number(departmentId),
      });
      await reload(token);
      setEditRow(null);
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
      title="Chức vụ"
      subtitle="Metadata chức vụ — ma trận quyền tại Phân quyền → Chức vụ"
      breadcrumb={[
        { label: 'Cấu hình CRM', href: '/admin/crm/custom-fields' },
        { label: 'Tổ chức', href: '/admin/crm/org/positions' },
        { label: 'Chức vụ' },
      ]}
      loading={loading}
    >
      <AdminOrgSubNav />
      {error ? <p className="form-error">{error}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}

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

      {editRow ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setEditRow(null)}>
          <div className="modal-card" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Sửa chức vụ {editRow.code}</h3>
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
              <button type="button" className="btn btn-ghost" onClick={() => setEditRow(null)}>
                Hủy
              </button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
                Lưu
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="muted" style={{ marginTop: '1rem' }}>
        Ma trận quyền theo chức vụ:{' '}
        <Link href="/admin/crm/permissions">Phân quyền → Chức vụ</Link>
      </p>
    </AdminPageShell>
  );
}

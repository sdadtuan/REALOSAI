'use client';

import { useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { AdminPermissionsSubNav } from '@/components/rbac/AdminPermissionsSubNav';
import { fetchStaffFieldRegistry, staffMe } from '@/lib/api';
import { clearSession, getAccessToken, hasCap, type StoredStaffUser } from '@/lib/auth';
import { winFieldAbacEnabled } from '@/lib/win/flags';

type FieldRow = {
  entity: string;
  field: string;
  section: string;
  action: string;
  mask_mode: string;
  patch_forbidden?: boolean;
  export_strip?: boolean;
};

export default function AdminFieldRegistryPage() {
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    void staffMe(token)
      .then((me) => {
        setUser(me);
        if (!hasCap(me, 'crm_data_config', 'view')) {
          setError('Cần quyền crm_data_config.view');
          return;
        }
        if (!winFieldAbacEnabled()) {
          setError('Bật NEXT_PUBLIC_WIN_FIELD_ABAC=1 để xem registry');
          return;
        }
        return fetchStaffFieldRegistry(token).then((res) => setFields(res.fields ?? []));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Tải registry thất bại'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminPageShell
      user={user}
      onLogout={() => clearSession()}
      section="crm-config"
      title="Field ABAC registry"
      breadcrumb={[
        { label: 'Quản trị', href: '/admin/crm/permissions' },
        { label: 'Field registry' },
      ]}
    >
      <AdminPermissionsSubNav />
      {loading ? <p className="muted">Đang tải…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!error && fields.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Field</th>
                <th>Cap</th>
                <th>Mask</th>
                <th>PATCH</th>
                <th>Export strip</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((row) => (
                <tr key={`${row.entity}.${row.field}`}>
                  <td>{row.entity}</td>
                  <td>{row.field}</td>
                  <td>
                    {row.section}.{row.action}
                  </td>
                  <td>{row.mask_mode}</td>
                  <td>{row.patch_forbidden ? '403' : '—'}</td>
                  <td>{row.export_strip ? 'yes' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </AdminPageShell>
  );
}

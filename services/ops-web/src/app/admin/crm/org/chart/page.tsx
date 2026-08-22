'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { AdminOrgSubNav } from '@/components/rbac/AdminOrgSubNav';
import { WinOrgChart } from '@/components/win/WinOrgChart';
import { fetchStaffOrgChart, type StaffOrgChartNode } from '@/lib/api';
import {
  canViewOrgAdmin,
  useAdminCrmAuth,
} from '@/lib/admin/use-admin-crm-auth';

export default function AdminOrgChartPage() {
  const { user, token, error: authError, loading: authLoading, logout } = useAdminCrmAuth(canViewOrgAdmin);
  const [nodes, setNodes] = useState<StaffOrgChartNode[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async (access: string, inactive: boolean) => {
    setBusy(true);
    setLoadError('');
    try {
      setNodes(await fetchStaffOrgChart(access, { includeInactive: inactive }));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải sơ đồ thất bại');
      setNodes([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void reload(token, includeInactive);
  }, [token, includeInactive, reload]);

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Sơ đồ tổ chức"
      subtitle="Cây báo cáo theo reports_to_id — WIN-2-D"
      breadcrumb={[
        { label: 'Cấu hình CRM', href: '/admin/crm/custom-fields' },
        { label: 'Tổ chức', href: '/admin/crm/org/users' },
        { label: 'Sơ đồ' },
      ]}
      loading={authLoading}
    >
      <AdminOrgSubNav />
      {authError ? <p className="form-error">{authError}</p> : null}
      <div className="page-card stack-gap">
        <p className="muted">
          Click tên NV → workspace CRM. Badge = mã chức vụ org user.
        </p>
        <label className="win-org-chart__filter">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />{' '}
          Hiện NV inactive
        </label>
        <WinOrgChart nodes={nodes} loading={busy} error={loadError} />
      </div>
    </AdminPageShell>
  );
}

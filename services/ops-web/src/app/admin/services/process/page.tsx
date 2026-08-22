'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { fetchSpcProcessLibrary, type SpcProcessPhaseRow } from '@/lib/spc-api';
import { canViewSpcAdmin, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

export default function AdminServicesProcessPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewSpcAdmin);
  const [items, setItems] = useState<SpcProcessPhaseRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [dvFilter, setDvFilter] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setLoadError('');
    try {
      const res = await fetchSpcProcessLibrary(token, dvFilter.trim() || undefined);
      setItems(res.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải process phases thất bại');
    }
  }, [token, dvFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const dvCodes = useMemo(() => {
    return [...new Set(items.map((p) => p.dv_code))].sort();
  }, [items]);

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      title="Process phases (L3)"
      subtitle="Quy trình triển khai theo tuần — spawn-week đọc tasks_json theo SKU lifecycle"
      section="crm-config"
      loading={loading}
      breadcrumb={[
        { label: 'Quản trị hệ thống', href: '/admin' },
        { label: 'Dịch vụ & Catalog', href: '/admin/services' },
        { label: 'Process phases' },
      ]}
    >
      {error ? <p className="error">{error}</p> : null}
      {loadError ? <p className="error">{loadError}</p> : null}

      <div className="page-card" style={{ marginBottom: '1rem' }}>
        <label>
          Lọc DV{' '}
          <input
            list="spc-dv-codes"
            value={dvFilter}
            onChange={(e) => setDvFilter(e.target.value.toUpperCase())}
            placeholder="VD: DV02"
            style={{ marginLeft: '0.5rem' }}
          />
        </label>
        <datalist id="spc-dv-codes">
          {dvCodes.map((dv) => (
            <option key={dv} value={dv} />
          ))}
        </datalist>
        <button type="button" className="btn-secondary" style={{ marginLeft: '0.5rem' }} onClick={() => void reload()}>
          Tải lại
        </button>
        <p className="muted" style={{ marginBottom: 0 }}>
          {items.length} phase · SKU override hiển thị cột sku_code · spawn tuần đầu dùng phase T1
        </p>
      </div>

      <div className="page-card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Phase</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>DV</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>SKU</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Tuần</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>PTT làm</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Tasks</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.phase_code}>
                <td style={{ padding: '0.5rem' }}>
                  <Link href={`/admin/services/families/${row.dv_code}`}>{row.phase_code}</Link>
                </td>
                <td style={{ padding: '0.5rem' }}>{row.dv_code}</td>
                <td style={{ padding: '0.5rem' }}>{row.sku_code ?? '—'}</td>
                <td style={{ padding: '0.5rem' }}>{row.week_label_vi}</td>
                <td style={{ padding: '0.5rem', maxWidth: 280 }}>{row.ptt_work_vi}</td>
                <td style={{ padding: '0.5rem' }}>{Array.isArray(row.tasks_json) ? row.tasks_json.length : 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}

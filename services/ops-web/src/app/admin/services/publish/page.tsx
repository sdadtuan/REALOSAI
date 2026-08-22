'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { fetchSpcPortfolio, fetchSpcPublishLog, type SpcPublishLogItem } from '@/lib/spc-api';
import { canViewSpcAdmin, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

export default function AdminServicesPublishPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewSpcAdmin);
  const [draftCount, setDraftCount] = useState(0);
  const [draftFamilies, setDraftFamilies] = useState<Array<{ dv_code: string; name_vi: string; draft_count: number }>>([]);
  const [log, setLog] = useState<SpcPublishLogItem[]>([]);
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setLoadError('');
    try {
      const [portfolio, publishLog] = await Promise.all([
        fetchSpcPortfolio(token),
        fetchSpcPublishLog(token),
      ]);
      setDraftCount(publishLog.draft_count ?? 0);
      setDraftFamilies(
        (portfolio.items ?? []).filter((row) => row.draft_count > 0).map((row) => ({
          dv_code: row.dv_code,
          name_vi: row.name_vi,
          draft_count: row.draft_count,
        })),
      );
      setLog(publishLog.items ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải publish queue thất bại');
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      title="Publish & audit"
      subtitle="Draft → IT publish → ops_service_profile sync + spc_publish_log"
      section="crm-config"
      loading={loading}
      breadcrumb={[
        { label: 'Quản trị hệ thống', href: '/admin' },
        { label: 'Dịch vụ & Catalog', href: '/admin/services' },
        { label: 'Publish' },
      ]}
    >
      {error ? <p className="error">{error}</p> : null}
      {loadError ? <p className="error">{loadError}</p> : null}

      <div className="page-card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Draft queue</h3>
        <p className="muted">{draftCount} SKU đang draft — AM chỉ thấy bản published.</p>
        {draftFamilies.length ? (
          <ul>
            {draftFamilies.map((row) => (
              <li key={row.dv_code}>
                <Link href={`/admin/services/families/${row.dv_code}`}>
                  {row.dv_code} — {row.name_vi}
                </Link>{' '}
                ({row.draft_count} draft)
              </li>
            ))}
          </ul>
        ) : (
          <p>Không có draft chờ publish.</p>
        )}
      </div>

      <div className="page-card">
        <h3 style={{ marginTop: 0 }}>Publish log</h3>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Entity</th>
              <th>Action</th>
              <th>Version</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            {log.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.created_at).toLocaleString('vi-VN')}</td>
                <td>
                  {row.entity_type}/{row.entity_key}
                </td>
                <td>{row.action}</td>
                <td>
                  {row.from_version ?? '—'} → {row.to_version ?? '—'}
                </td>
                <td>{row.actor_email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}

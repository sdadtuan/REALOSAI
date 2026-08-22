'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import {
  closeAccessReviewCampaign,
  fetchAccessReviewCampaigns,
  launchAccessReviewCampaign,
  type AccessReviewCampaign,
} from '@/lib/api';
import { canViewAdminAudit, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';
import { hasCap } from '@/lib/auth';

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Nháp',
    active: 'Đang chạy',
    completed: 'Hoàn tất',
    cancelled: 'Đã huỷ',
  };
  return map[status] ?? status;
}

export default function AccessReviewsPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewAdminAudit);
  const canConfigure = hasCap(user, 'crm_data_config', 'configure');
  const [campaigns, setCampaigns] = useState<AccessReviewCampaign[]>([]);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setLoadError('');
    try {
      const out = await fetchAccessReviewCampaigns(token);
      setCampaigns(out.campaigns);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải campaigns thất bại');
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleLaunch(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await launchAccessReviewCampaign(token, id);
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Launch thất bại');
    } finally {
      setBusyId('');
    }
  }

  async function handleClose(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await closeAccessReviewCampaign(token, id, true);
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Đóng campaign thất bại');
    } finally {
      setBusyId('');
    }
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Access review campaigns"
      subtitle="Quarterly certification — R4 Identity Governance"
      breadcrumb={[
        { label: 'Quản trị', href: '/admin' },
        { label: 'Audit', href: '/admin/audit' },
        { label: 'Access reviews' },
      ]}
      loading={loading}
      actions={
        <div className="toolbar-actions">
          <Link href="/admin/audit/access-reviews/inbox" className="btn btn-ghost btn-sm">
            Inbox duyệt
          </Link>
          {canConfigure ? (
            <Link href="/admin/audit/access-reviews/new" className="btn btn-primary btn-sm">
              + Tạo campaign
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="admin-governance-page">
        {error ? <p className="form-error">{error}</p> : null}
        {loadError ? <p className="form-error">{loadError}</p> : null}
        <table className="table admin-audit-table">
          <thead>
            <tr>
              <th>Tiêu đề</th>
              <th>Quý</th>
              <th>Trạng thái</th>
              <th>Due</th>
              <th>Tiến độ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/audit/access-reviews/${c.id}`}>{c.title}</Link>
                </td>
                <td>{c.quarter}</td>
                <td>
                  <span className={`admin-ar-campaign-status admin-ar-campaign-status--${c.status}`}>
                    {statusLabel(c.status)}
                  </span>
                </td>
                <td>{new Date(c.due_at).toLocaleDateString('vi-VN')}</td>
                <td>
                  {c.item_counts.certified}/{c.item_counts.total} certified · {c.item_counts.pending} pending
                </td>
                <td>
                  {canConfigure && c.status === 'draft' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={busyId === c.id}
                      onClick={() => void handleLaunch(c.id)}
                    >
                      Launch
                    </button>
                  ) : null}
                  {canConfigure && c.status === 'active' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      disabled={busyId === c.id}
                      onClick={() => void handleClose(c.id)}
                    >
                      Đóng
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!campaigns.length && !loadError ? <p className="muted">Chưa có campaign.</p> : null}
      </div>
    </AdminPageShell>
  );
}

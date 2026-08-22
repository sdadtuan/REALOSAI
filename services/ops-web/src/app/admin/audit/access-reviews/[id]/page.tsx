'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import {
  closeAccessReviewCampaign,
  fetchAccessReviewCampaign,
  fetchAccessReviewItems,
  launchAccessReviewCampaign,
  type AccessReviewCampaign,
  type AccessReviewItem,
} from '@/lib/api';
import { canViewAdminAudit, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';
import { hasCap } from '@/lib/auth';

export default function AccessReviewCampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewAdminAudit);
  const canConfigure = hasCap(user, 'crm_data_config', 'configure');
  const [campaign, setCampaign] = useState<AccessReviewCampaign | null>(null);
  const [items, setItems] = useState<AccessReviewItem[]>([]);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!token || !id) return;
    setLoadError('');
    try {
      const [c, it] = await Promise.all([
        fetchAccessReviewCampaign(token, id),
        fetchAccessReviewItems(token, id),
      ]);
      setCampaign(c);
      setItems(it.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải campaign thất bại');
    }
  }, [token, id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleLaunch() {
    if (!token || !id) return;
    setBusy(true);
    try {
      await launchAccessReviewCampaign(token, id);
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Launch thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleClose(force: boolean) {
    if (!token || !id) return;
    setBusy(true);
    try {
      await closeAccessReviewCampaign(token, id, force);
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Đóng campaign thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title={campaign?.title ?? 'Campaign'}
      subtitle={campaign ? `${campaign.quarter} · ${campaign.status}` : undefined}
      breadcrumb={[
        { label: 'Quản trị', href: '/admin' },
        { label: 'Access reviews', href: '/admin/audit/access-reviews' },
        { label: campaign?.title ?? id },
      ]}
      loading={loading}
      actions={
        canConfigure && campaign?.status === 'draft' ? (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void handleLaunch()}>
            Launch campaign
          </button>
        ) : canConfigure && campaign?.status === 'active' ? (
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void handleClose(true)}>
            Đóng campaign
          </button>
        ) : null
      }
    >
      <div className="admin-governance-page">
        {error ? <p className="form-error">{error}</p> : null}
        {loadError ? <p className="form-error">{loadError}</p> : null}
        {campaign ? (
          <p className="muted">
            Due {new Date(campaign.due_at).toLocaleDateString('vi-VN')} · Owner {campaign.owner_email} ·{' '}
            {campaign.item_counts.pending} pending / {campaign.item_counts.total} total
          </p>
        ) : null}
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Chức vụ</th>
              <th>Quyết định</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={item.days_until_due != null && item.days_until_due < 0 ? 'admin-cert-inbox-row--overdue' : undefined}>
                <td>
                  <Link href={`/admin/crm/permissions/users?email=${encodeURIComponent(item.user_email)}`}>
                    {item.user_email}
                  </Link>
                </td>
                <td>{item.position_code ?? '—'}</td>
                <td>{item.decision}</td>
                <td>{(item.risk_flags ?? []).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Link href="/admin/audit/access-reviews/inbox" className="btn btn-ghost btn-sm">
          → Inbox duyệt quyền
        </Link>
      </div>
    </AdminPageShell>
  );
}

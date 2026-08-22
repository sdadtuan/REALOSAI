'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { fetchAccessReviewInbox, patchAccessReviewItem, type AccessReviewItem } from '@/lib/api';
import { canViewAdminAudit, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

export default function AccessReviewInboxPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewAdminAudit);
  const [items, setItems] = useState<AccessReviewItem[]>([]);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setLoadError('');
    try {
      const out = await fetchAccessReviewInbox(token);
      setItems(out.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải inbox thất bại');
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function decide(itemId: string, decision: string) {
    if (!token) return;
    setBusyId(itemId);
    try {
      await patchAccessReviewItem(token, itemId, { decision });
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setBusyId('');
    }
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Inbox duyệt quyền"
      subtitle="Certification — trưởng phòng / PO"
      breadcrumb={[
        { label: 'Quản trị', href: '/admin' },
        { label: 'Access reviews', href: '/admin/audit/access-reviews' },
        { label: 'Inbox' },
      ]}
      loading={loading}
    >
      <div className="admin-governance-page">
        {error ? <p className="form-error">{error}</p> : null}
        {loadError ? <p className="form-error">{loadError}</p> : null}
        {!items.length ? <p className="muted">Không có mục chờ duyệt.</p> : null}
        {items.map((item) => (
          <div
            key={item.id}
            className={`win-info-callout stack-gap${item.days_until_due != null && item.days_until_due < 0 ? ' admin-cert-inbox-row--overdue' : ''}`}
          >
            <p>
              <strong>{item.user_display_name || item.user_email}</strong> · {item.position_code ?? '—'}
              {item.days_until_due != null ? (
                <span className="muted"> · còn {item.days_until_due} ngày</span>
              ) : null}
            </p>
            {(item.risk_flags ?? []).length ? (
              <p className="muted">Risk: {(item.risk_flags ?? []).join(', ')}</p>
            ) : null}
            <div className="toolbar-actions">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={busyId === item.id}
                onClick={() => void decide(item.id, 'certified')}
              >
                Certify
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busyId === item.id}
                onClick={() => void decide(item.id, 'revoke_requested')}
              >
                Yêu cầu thu hồi
              </button>
              <Link
                href={`/admin/crm/permissions/users?email=${encodeURIComponent(item.user_email)}`}
                className="btn btn-sm btn-ghost"
              >
                Xem quyền
              </Link>
            </div>
          </div>
        ))}
      </div>
    </AdminPageShell>
  );
}

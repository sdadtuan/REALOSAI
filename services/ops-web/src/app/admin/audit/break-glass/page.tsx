'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { BreakGlassRequestModal } from '@/components/rbac/BreakGlassRequestModal';
import {
  approveBreakGlassGrant,
  fetchActiveBreakGlassGrants,
  type BreakGlassGrant,
} from '@/lib/api';
import { canViewAdminAudit, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';
import { getAccessToken, hasCap } from '@/lib/auth';
import { winBreakGlassEnabled } from '@/lib/win/flags';

function formatCountdown(expiresAt: string | null | undefined): string {
  if (!expiresAt) return '—';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Hết hạn';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export default function BreakGlassGovernancePage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewAdminAudit);
  const [modalOpen, setModalOpen] = useState(false);
  const [grants, setGrants] = useState<BreakGlassGrant[]>([]);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const canApprove =
    user &&
    (hasCap(user, 'crm_gdkd', 'override') || hasCap(user, 'crm_data_config', 'configure'));

  useEffect(() => {
    if (!token || !canApprove) return;
    void (async () => {
      try {
        const out = await fetchActiveBreakGlassGrants(token);
        setGrants(out.grants);
      } catch {
        setGrants([]);
      }
    })();
  }, [token, canApprove, modalOpen]);

  async function handleApprove(id: string, approve: boolean) {
    const access = getAccessToken();
    if (!access) return;
    setBusy(true);
    setLoadError('');
    try {
      await approveBreakGlassGrant(access, id, { approve });
      const out = await fetchActiveBreakGlassGrants(access);
      setGrants(out.grants);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Duyệt thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Break-glass governance"
      subtitle="Emergency access · TTL 4h · auto-revoke"
      breadcrumb={[
        { label: 'Quản trị', href: '/admin' },
        { label: 'Audit', href: '/admin/audit' },
        { label: 'Break-glass' },
      ]}
      loading={loading}
      actions={
        winBreakGlassEnabled() ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>
            Yêu cầu break-glass
          </button>
        ) : null
      }
    >
      <div className="admin-governance-page">
        {error ? <p className="form-error">{error}</p> : null}
        {loadError ? <p className="form-error">{loadError}</p> : null}
        <p className="muted">
          <Link href="/admin/audit?category=rbac_event&q=break_glass">Xem lịch sử trên Audit Center →</Link>
        </p>

        <section className="stack-gap">
          <h3 className="section-title">Đang active</h3>
          {grants.filter((g) => g.status === 'approved').map((g) => (
            <div key={g.id} className="win-info-callout">
              <strong>{g.user_email ?? g.user_id}</strong> — {g.reason}
              <p className="admin-break-glass-countdown">Còn {formatCountdown(g.expires_at)}</p>
            </div>
          ))}
          {!grants.some((g) => g.status === 'approved') ? <p className="muted">Không có grant active.</p> : null}
        </section>

        {canApprove ? (
          <section className="stack-gap">
            <h3 className="section-title">Chờ duyệt</h3>
            {grants.filter((g) => g.status === 'pending').map((g) => (
              <div key={g.id} className="win-info-callout stack-gap">
                <p>
                  <strong>{g.user_email ?? g.user_id}</strong> — {g.reason}
                </p>
                <div className="toolbar-actions">
                  <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void handleApprove(g.id, true)}>
                    Duyệt
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void handleApprove(g.id, false)}>
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </section>
        ) : null}
      </div>

      {user && winBreakGlassEnabled() ? (
        <BreakGlassRequestModal user={user} open={modalOpen} onClose={() => setModalOpen(false)} />
      ) : null}
    </AdminPageShell>
  );
}

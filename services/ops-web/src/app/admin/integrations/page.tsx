'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import {
  createServiceAccount,
  fetchAdminIntegrations,
  fetchAdminIntegrationsHealth,
  fetchServiceAccounts,
  revokeServiceAccount,
  rotateServiceAccount,
  type AdminIntegrationRow,
  type ServiceAccountRow,
} from '@/lib/api';
import { canViewAdminAudit, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

type IntegrationsTab = 'registry' | 'service-accounts';

function statusClass(status: string): string {
  if (status === 'critical') return 'admin-integration-status--critical';
  if (status === 'warning') return 'admin-audit-severity--warning';
  return '';
}

export default function AdminIntegrationsPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewAdminAudit);
  const [tab, setTab] = useState<IntegrationsTab>('registry');
  const [integrations, setIntegrations] = useState<AdminIntegrationRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [health, setHealth] = useState<{ expiring_count?: number; critical_count?: number } | null>(null);
  const [accounts, setAccounts] = useState<ServiceAccountRow[]>([]);
  const [newAccountName, setNewAccountName] = useState('');
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const reloadRegistry = useCallback(async () => {
    if (!token) return;
    setLoadError('');
    try {
      const [list, h] = await Promise.all([
        fetchAdminIntegrations(token),
        fetchAdminIntegrationsHealth(token),
      ]);
      setIntegrations(list.integrations);
      setSummary(list.summary);
      setHealth(h);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải registry thất bại');
    }
  }, [token]);

  const reloadAccounts = useCallback(async () => {
    if (!token) return;
    setLoadError('');
    try {
      const out = await fetchServiceAccounts(token);
      setAccounts(out.accounts ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải service accounts thất bại');
    }
  }, [token]);

  useEffect(() => {
    if (tab === 'registry') void reloadRegistry();
    else void reloadAccounts();
  }, [tab, reloadRegistry, reloadAccounts]);

  async function runCreateAccount() {
    if (!token || !newAccountName.trim()) return;
    setBusy(true);
    setPlainKey(null);
    try {
      const out = await createServiceAccount(token, { name: newAccountName.trim() });
      setPlainKey(out.plain_key);
      setNewAccountName('');
      await reloadAccounts();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tạo service account thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function runRotate(id: string) {
    if (!token) return;
    setBusy(true);
    setPlainKey(null);
    try {
      const out = await rotateServiceAccount(token, id);
      setPlainKey(out.plain_key);
      await reloadAccounts();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Rotate key thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function runRevoke(id: string) {
    if (!token) return;
    setBusy(true);
    try {
      await revokeServiceAccount(token, id);
      await reloadAccounts();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Revoke thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Registry tích hợp"
      subtitle="Webhooks · OAuth tokens · SSO · Service accounts"
      breadcrumb={[
        { label: 'Quản trị', href: '/admin' },
        { label: 'Integrations' },
      ]}
      loading={loading}
    >
      <div className="admin-governance-page">
        {error ? <p className="form-error">{error}</p> : null}
        {loadError ? <p className="form-error">{loadError}</p> : null}

        <div className="win-filter-chips">
          <button
            type="button"
            className={`win-filter-chip${tab === 'registry' ? ' win-filter-chip--active' : ''}`}
            onClick={() => setTab('registry')}
          >
            Registry
          </button>
          <button
            type="button"
            className={`win-filter-chip${tab === 'service-accounts' ? ' win-filter-chip--active' : ''}`}
            onClick={() => setTab('service-accounts')}
          >
            Service accounts
          </button>
        </div>

        {tab === 'registry' ? (
          <>
            <div className="admin-audit-filters">
              <span className="muted">
                OK {summary.ok ?? 0} · Warning {summary.warning ?? 0} · Critical {summary.critical ?? 0}
                {health ? ` · Expiring ${health.expiring_count ?? 0}` : ''}
              </span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Loại</th>
                  <th>Trạng thái</th>
                  <th>Chi tiết</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {integrations.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.kind}</td>
                    <td className={statusClass(row.status)}>{row.status}</td>
                    <td className="muted">{row.detail}</td>
                    <td>
                      {row.redirect_href ? (
                        <Link href={row.redirect_href} className="btn btn-sm btn-ghost">
                          Quản lý
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <p className="muted">
              API keys scoped cho automation — lưu key ngay khi tạo/rotate.{' '}
              <Link href="/admin/policies">Policy workspace →</Link>
            </p>
            {plainKey ? (
              <div className="page-card stack-gap">
                <strong>Key mới (chỉ hiện một lần)</strong>
                <code>{plainKey}</code>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => void navigator.clipboard.writeText(plainKey)}>
                  Sao chép
                </button>
              </div>
            ) : null}
            <div className="kpi-page__filters">
              <input
                type="text"
                className="kpi-input"
                placeholder="Tên service account"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                disabled={busy}
              />
              <button type="button" className="btn btn-primary" disabled={busy || !newAccountName.trim()} onClick={() => void runCreateAccount()}>
                Tạo account
              </button>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Prefix</th>
                  <th>Trạng thái</th>
                  <th>Lần dùng cuối</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {accounts.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>
                      <code>{row.key_prefix}…</code>
                    </td>
                    <td>{row.active ? 'Hoạt động' : 'Revoked'}</td>
                    <td className="muted">{row.last_used_at ?? '—'}</td>
                    <td>
                      {row.active ? (
                        <>
                          <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void runRotate(row.id)}>
                            Rotate
                          </button>{' '}
                          <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void runRevoke(row.id)}>
                            Revoke
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {accounts.length === 0 ? <p className="muted">Chưa có service account.</p> : null}
          </>
        )}
      </div>
    </AdminPageShell>
  );
}

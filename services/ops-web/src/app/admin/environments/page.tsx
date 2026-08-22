'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { WinDiffChip } from '@/components/win';
import {
  createAdminEnvDiff,
  fetchAdminEnvDiff,
  fetchAdminEnvSnapshots,
  type AdminEnvDiffResult,
  type AdminEnvSnapshotRow,
} from '@/lib/api';
import { canViewPolicyAdmin, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

export default function AdminEnvironmentsPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewPolicyAdmin);
  const [snapshots, setSnapshots] = useState<AdminEnvSnapshotRow[]>([]);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [uploadJson, setUploadJson] = useState('');
  const [diff, setDiff] = useState<AdminEnvDiffResult | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const reloadSnapshots = useCallback(async () => {
    if (!token) return;
    setLoadError('');
    try {
      const out = await fetchAdminEnvSnapshots(token);
      setSnapshots(out.snapshots ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải snapshot thất bại');
    }
  }, [token]);

  useEffect(() => {
    void reloadSnapshots();
  }, [reloadSnapshots]);

  async function runDiff() {
    if (!token) return;
    setBusy(true);
    setLoadError('');
    try {
      let parsedUpload: unknown;
      if (uploadJson.trim()) {
        parsedUpload = JSON.parse(uploadJson);
      }
      const out = await createAdminEnvDiff(token, {
        left_snapshot_id: leftId || undefined,
        right_snapshot_id: rightId || undefined,
        upload_json: parsedUpload,
      });
      setDiff(out);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'So sánh môi trường thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function refreshDiff(id: string) {
    if (!token) return;
    setBusy(true);
    try {
      const out = await fetchAdminEnvDiff(token, id);
      setDiff(out);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải kết quả diff thất bại');
    } finally {
      setBusy(false);
    }
  }

  const diffCardClass =
    diff?.severity === 'critical' ? 'page-card admin-env-diff--critical' : 'page-card';

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="So sánh môi trường"
      subtitle="Staging vs prod snapshot — không live-query prod"
      breadcrumb={[
        { label: 'Quản trị', href: '/admin' },
        { label: 'Environments' },
      ]}
      loading={loading}
    >
      <div className="admin-governance-page admin-policy-page">
        {error ? <p className="form-error">{error}</p> : null}
        {loadError ? <p className="form-error">{loadError}</p> : null}

        <div className="kpi-page__filters">
          <label className="muted">
            Trái (staging / local)
            <select value={leftId} onChange={(e) => setLeftId(e.target.value)} disabled={busy}>
              <option value="">Staging hiện tại</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({s.snapshot_type})
                </option>
              ))}
            </select>
          </label>
          <label className="muted">
            Phải (prod snapshot)
            <select value={rightId} onChange={(e) => setRightId(e.target.value)} disabled={busy}>
              <option value="">— chọn snapshot —</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({s.snapshot_type})
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void runDiff()}>
            So sánh
          </button>
        </div>

        <label className="muted stack-gap">
          Hoặc dán JSON export prod (tuỳ chọn)
          <textarea
            className="kpi-input"
            rows={4}
            value={uploadJson}
            onChange={(e) => setUploadJson(e.target.value)}
            placeholder='{"matrix": …}'
          />
        </label>

        {diff ? (
          <section className={diffCardClass}>
            <div className="admin-audit-filters">
              <strong>Kết quả diff</strong>
              <WinDiffChip added={diff.summary.added} removed={diff.summary.removed} />
              <span className="muted">~{diff.summary.changed} thay đổi · {diff.severity}</span>
              <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void refreshDiff(diff.id)}>
                Làm mới
              </button>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Chức vụ</th>
                  <th>Thêm</th>
                  <th>Bớt</th>
                </tr>
              </thead>
              <tbody>
                {diff.matrix_diff.map((row) => (
                  <tr key={row.position_code}>
                    <td>{row.position_code}</td>
                    <td className="muted">{row.added.join(', ') || '—'}</td>
                    <td className="muted">{row.removed.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {diff.org_diff?.length ? (
              <section className="stack-gap">
                <h3 className="section-title">Org diff</h3>
                <ul>
                  {diff.org_diff.map((row, i) => (
                    <li key={`${row.entity}-${row.field}-${i}`} className="muted">
                      {row.entity}.{row.field}: {String(row.from)} → {String(row.to)}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </section>
        ) : null}
      </div>
    </AdminPageShell>
  );
}

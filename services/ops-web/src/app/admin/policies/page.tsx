'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import {
  applyCompliancePack,
  exportAdminPolicyBundle,
  fetchAdminPolicies,
  fetchAdminPolicy,
  fetchCompliancePacks,
  patchAdminPolicy,
  previewCompliancePack,
  validateAdminPolicyBundle,
  type AdminPolicyRow,
  type CompliancePackRow,
} from '@/lib/api';
import { canViewPolicyAdmin, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

export default function AdminPoliciesPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewPolicyAdmin);
  const [policies, setPolicies] = useState<AdminPolicyRow[]>([]);
  const [bundleVersion, setBundleVersion] = useState('');
  const [packs, setPacks] = useState<CompliancePackRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [validateMsg, setValidateMsg] = useState('');
  const [drawerPolicy, setDrawerPolicy] = useState<AdminPolicyRow | null>(null);
  const [regoText, setRegoText] = useState('');
  const [previewPack, setPreviewPack] = useState<string | null>(null);
  const [previewSummary, setPreviewSummary] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setLoadError('');
    try {
      const [policyRes, packRes] = await Promise.all([
        fetchAdminPolicies(token),
        fetchCompliancePacks(token),
      ]);
      setPolicies(policyRes.policies ?? []);
      setBundleVersion(policyRes.bundle_version ?? '');
      setPacks(packRes.packs ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải catalog OPA thất bại');
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function openRegoDrawer(row: AdminPolicyRow) {
    if (!token) return;
    setDrawerPolicy(row);
    setRegoText(row.rego_preview ?? '');
    try {
      const detail = await fetchAdminPolicy(token, row.id);
      setRegoText(detail.rego_text ?? detail.policy.rego_preview ?? '');
      setDrawerPolicy(detail.policy);
    } catch {
      /* keep preview from list */
    }
  }

  async function toggleEnabled(row: AdminPolicyRow) {
    if (!token) return;
    setBusy(true);
    try {
      await patchAdminPolicy(token, row.id, { enabled: !row.enabled });
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Cập nhật policy thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function runExport() {
    if (!token) return;
    setBusy(true);
    try {
      await exportAdminPolicyBundle(token);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Export bundle thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function runValidate() {
    if (!token) return;
    setBusy(true);
    setValidateMsg('');
    try {
      const out = await validateAdminPolicyBundle(token);
      if (out.ok) {
        setValidateMsg(`Bundle hợp lệ${out.bundle_version ? ` (${out.bundle_version})` : ''}`);
      } else {
        setValidateMsg(out.errors?.join(' · ') ?? 'Bundle không hợp lệ');
      }
    } catch (err) {
      setValidateMsg(err instanceof Error ? err.message : 'Validate thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function runPackPreview(code: string) {
    if (!token) return;
    setBusy(true);
    setPreviewPack(code);
    setPreviewSummary('');
    try {
      const out = await previewCompliancePack(token, code);
      setPreviewSummary(
        `+${out.summary.added} −${out.summary.removed} ~${out.summary.changed} thay đổi ma trận`,
      );
    } catch (err) {
      setPreviewSummary(err instanceof Error ? err.message : 'Preview thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function runPackApply(code: string) {
    if (!token) return;
    setBusy(true);
    try {
      const out = await applyCompliancePack(token, code, { dry_run: false });
      setLoadError('');
      setPreviewSummary(
        out.change_request_id
          ? `Đã tạo change request ${out.change_request_id}`
          : out.applied
            ? 'Đã áp dụng pack'
            : 'Yêu cầu đã gửi',
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Áp dụng pack thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="OPA & Compliance packs"
      subtitle="Catalog policy · export bundle · packs mẫu"
      breadcrumb={[
        { label: 'Quản trị', href: '/admin' },
        { label: 'OPA policies' },
      ]}
      loading={loading}
    >
      <div className="admin-governance-page admin-policy-page">
        {error ? <p className="form-error">{error}</p> : null}
        {loadError ? <p className="form-error">{loadError}</p> : null}

        <div className="admin-audit-filters">
          <span className="muted">
            Bundle {bundleVersion || '—'} · {policies.length} policy
          </span>
          <div className="kpi-page__filters">
            <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void runExport()}>
              Tải bundle ZIP
            </button>
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void runValidate()}>
              Validate
            </button>
            <Link href="/admin/crm/permissions/simulator" className="btn btn-sm btn-ghost">
              Simulator what-if →
            </Link>
          </div>
        </div>
        {validateMsg ? <p className="muted">{validateMsg}</p> : null}

        <table className="table">
          <thead>
            <tr>
              <th>Policy ID</th>
              <th>Trạng thái</th>
              <th>Mô tả</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {policies.map((row) => (
              <tr key={row.id}>
                <td>
                  <code>{row.id}</code>
                </td>
                <td>{row.enabled ? 'Bật' : 'Tắt'}</td>
                <td className="muted">{row.description}</td>
                <td>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => void openRegoDrawer(row)}>
                    Xem Rego
                  </button>{' '}
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={busy}
                    onClick={() => void toggleEnabled(row)}
                  >
                    {row.enabled ? 'Tắt' : 'Bật'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="stack-gap">
          <h2 className="section-title">Compliance packs</h2>
          <div className="hub-module-grid">
            {packs.map((pack) => (
              <div key={pack.code} className="admin-compliance-pack-card">
                <strong>{pack.label}</strong>
                <span className="muted">{pack.description}</span>
                <code className="muted">{pack.code}</code>
                <div className="kpi-page__filters">
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={busy}
                    onClick={() => void runPackPreview(pack.code)}
                  >
                    Preview diff
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={busy}
                    onClick={() => void runPackApply(pack.code)}
                  >
                    Áp dụng
                  </button>
                </div>
                {previewPack === pack.code && previewSummary ? (
                  <p className="muted">{previewSummary}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      {drawerPolicy ? (
        <>
          <button
            type="button"
            className="admin-cp-rail-drawer-backdrop"
            aria-label="Đóng"
            onClick={() => setDrawerPolicy(null)}
          />
          <aside className="admin-audit-drawer" aria-label="Rego preview">
            <div className="admin-cp-rail-drawer-head">
              <strong>{drawerPolicy.id}</strong>
              <button type="button" className="admin-cp-rail-drawer-close" onClick={() => setDrawerPolicy(null)}>
                ×
              </button>
            </div>
            <p className="muted">{drawerPolicy.description}</p>
            <pre className="admin-rego-preview">{regoText || 'Không có nội dung Rego'}</pre>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => void navigator.clipboard.writeText(regoText)}
            >
              Sao chép
            </button>
          </aside>
        </>
      ) : null}
    </AdminPageShell>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { createAccessReviewCampaign } from '@/lib/api';
import { canViewAdminAudit, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';
import { hasCap } from '@/lib/auth';

export default function NewAccessReviewCampaignPage() {
  const router = useRouter();
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewAdminAudit);
  const canConfigure = hasCap(user, 'crm_data_config', 'configure');
  const [title, setTitle] = useState('');
  const [quarter, setQuarter] = useState('');
  const [scopeType, setScopeType] = useState('all');
  const [scopeRef, setScopeRef] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !canConfigure) return;
    setBusy(true);
    setFormError('');
    try {
      const campaign = await createAccessReviewCampaign(token, {
        title: title.trim(),
        quarter: quarter.trim() || undefined,
        scope_type: scopeType,
        scope_ref: scopeRef.trim() || null,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
      });
      router.push(`/admin/audit/access-reviews/${campaign.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Tạo campaign thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!canConfigure && !loading) {
    return (
      <AdminPageShell user={user} onLogout={logout} section="crm-config" title="Tạo campaign" loading={loading}>
        <p className="form-error">Cần quyền crm_data_config.configure</p>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Tạo access review campaign"
      breadcrumb={[
        { label: 'Quản trị', href: '/admin' },
        { label: 'Access reviews', href: '/admin/audit/access-reviews' },
        { label: 'Mới' },
      ]}
      loading={loading}
    >
      <form className="admin-governance-page stack-gap" onSubmit={(e) => void handleSubmit(e)}>
        {error ? <p className="form-error">{error}</p> : null}
        {formError ? <p className="form-error">{formError}</p> : null}
        <label>
          Tiêu đề *
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Quý (2026-Q3)
          <input value={quarter} onChange={(e) => setQuarter(e.target.value)} placeholder="2026-Q3" />
        </label>
        <label>
          Phạm vi
          <select value={scopeType} onChange={(e) => setScopeType(e.target.value)}>
            <option value="all">Toàn công ty</option>
            <option value="team">Team (nhập team id)</option>
            <option value="department">Phòng ban (dept id)</option>
            <option value="permission_set">Permission set (code)</option>
          </select>
        </label>
        {scopeType !== 'all' ? (
          <label>
            Scope ref
            <input value={scopeRef} onChange={(e) => setScopeRef(e.target.value)} />
          </label>
        ) : null}
        <label>
          Hạn duyệt
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </label>
        <div className="toolbar-actions">
          <Link href="/admin/audit/access-reviews" className="btn btn-ghost">
            Huỷ
          </Link>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu nháp'}
          </button>
        </div>
      </form>
    </AdminPageShell>
  );
}

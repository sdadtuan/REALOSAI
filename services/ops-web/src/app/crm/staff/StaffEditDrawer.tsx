'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { WinDrawer } from '@/components/win';
import { WinRbacBadge } from '@/components/win/WinRbacBadge';
import {
  buildOrgOnboardDeepLink,
  buildOrgUsersDeepLink,
  canLinkToOrgAdmin,
  canOnboardFromRoster,
} from '@/lib/admin/staff-bridge';
import { patchCrmStaff, type CrmStaffRow, type StaffOrgUserSummary } from '@/lib/api';
import type { StoredStaffUser } from '@/lib/auth';

type Props = {
  open: boolean;
  staff: CrmStaffRow | null;
  orgUser?: StaffOrgUserSummary | null;
  token: string;
  canEdit: boolean;
  viewer: StoredStaffUser | null;
  onClose: () => void;
  onSaved: (row: CrmStaffRow) => void;
};

export function StaffEditDrawer({
  open,
  staff,
  orgUser,
  token,
  canEdit,
  viewer,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canLink = canLinkToOrgAdmin(viewer);
  const canOnboard = canOnboardFromRoster(viewer);

  useEffect(() => {
    if (!staff) return;
    setName(staff.name ?? '');
    setPhone(staff.phone ?? '');
    setEmail(staff.email ?? '');
    setJobTitle(staff.job_title ?? '');
    setError('');
  }, [staff]);

  async function save() {
    if (!staff || !canEdit) return;
    setBusy(true);
    setError('');
    try {
      const updated = await patchCrmStaff(token, staff.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        job_title: jobTitle.trim(),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!staff) return null;

  const emailTrimmed = email.trim();

  return (
    <WinDrawer
      open={open}
      title={`Sửa hồ sơ — ${staff.name}`}
      onClose={onClose}
      footer={
        canEdit ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              Hủy
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
              Lưu
            </button>
          </>
        ) : null
      }
    >
      {error ? <p className="form-error">{error}</p> : null}
      <div className="staff-edit-drawer__meta">
        <div>
          <span className="muted">Mã nội bộ:</span> {staff.internal_code || '—'}
        </div>
        <div>
          <span className="muted">Phòng ban:</span> {staff.department || '—'}
        </div>
        <div>
          <span className="muted">Trạng thái:</span> {staff.active ? 'Active' : 'Inactive'}
        </div>
        {orgUser ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' }}>
            <span className="muted">RBAC:</span>
            <WinRbacBadge positionCode={orgUser.position_code} jobFunctions={orgUser.job_functions} />
            {canLink && emailTrimmed ? (
              <Link
                href={buildOrgUsersDeepLink(emailTrimmed)}
                className="nav-link"
                style={{ fontSize: '0.85rem' }}
              >
                Cấu hình tài khoản & quyền
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="stack-gap" style={{ gap: '0.35rem' }}>
            <p className="muted" style={{ margin: 0 }}>
              Chưa có tài khoản login.
            </p>
            {canOnboard && emailTrimmed ? (
              <Link
                href={buildOrgOnboardDeepLink({
                  email: emailTrimmed,
                  crmStaffId: staff.id,
                  name: name.trim() || staff.name,
                  phone: phone.trim() || staff.phone,
                  jobTitle: jobTitle.trim() || staff.job_title,
                  internalCode: staff.internal_code,
                })}
                className="btn btn-sm btn-secondary"
              >
                Onboard NV
              </Link>
            ) : null}
          </div>
        )}
      </div>
      <label>
        Họ tên
        <input value={name} onChange={(e) => setName(e.target.value)} readOnly={!canEdit} />
      </label>
      <label>
        SĐT
        <input value={phone} onChange={(e) => setPhone(e.target.value)} readOnly={!canEdit} />
      </label>
      <label>
        Email
        <input value={email} onChange={(e) => setEmail(e.target.value)} readOnly={!canEdit} />
      </label>
      <label>
        Chức danh
        <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} readOnly={!canEdit} />
      </label>
    </WinDrawer>
  );
}

import Link from 'next/link';

export function StaffRosterIdentityCallout() {
  return (
    <div className="staff-roster-callout" role="note">
      <p>
        Hồ sơ nhân viên (<code>crm_staff</code>) khác tài khoản đăng nhập. Tạo login và phân quyền tại{' '}
        <Link href="/admin/crm/org/users">Quản trị → Người dùng</Link>.
      </p>
    </div>
  );
}

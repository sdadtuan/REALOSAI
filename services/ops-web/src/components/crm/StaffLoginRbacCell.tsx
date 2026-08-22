import Link from 'next/link';
import { WinRbacBadge } from '@/components/win/WinRbacBadge';
import type { CrmStaffRow, StaffOrgUserSummary } from '@/lib/api';
import type { StoredStaffUser } from '@/lib/auth';
import {
  buildOrgOnboardDeepLink,
  buildOrgUsersDeepLink,
  canLinkToOrgAdmin,
  canOnboardFromRoster,
  resolveStaffLoginRbac,
} from '@/lib/admin/staff-bridge';

type StaffLoginRbacCellProps = {
  staff: CrmStaffRow;
  orgUser?: StaffOrgUserSummary;
  viewer: StoredStaffUser | null;
};

export function StaffLoginRbacCell({ staff, orgUser, viewer }: StaffLoginRbacCellProps) {
  const row = resolveStaffLoginRbac(staff, orgUser);
  const canLink = canLinkToOrgAdmin(viewer);
  const canOnboard = canOnboardFromRoster(viewer);
  const email = staff.email?.trim();

  return (
    <div className="staff-login-rbac-cell">
      <span className={`staff-login-rbac-badge staff-login-rbac-badge--${row.tone}`}>
        {row.label}
      </span>
      {row.status === 'active' && row.orgUser ? (
        <WinRbacBadge
          positionCode={row.orgUser.position_code}
          jobFunctions={row.orgUser.job_functions}
        />
      ) : null}
      {canLink && row.status === 'active' && email ? (
        <Link href={buildOrgUsersDeepLink(email)} className="nav-link staff-login-rbac-action">
          Cấu hình quyền
        </Link>
      ) : null}
      {canOnboard && row.status === 'no_account' && email ? (
        <Link
          href={buildOrgOnboardDeepLink({
            email,
            crmStaffId: staff.id,
            name: staff.name,
            phone: staff.phone,
            jobTitle: staff.job_title,
            internalCode: staff.internal_code,
          })}
          className="nav-link staff-login-rbac-action"
        >
          Onboard
        </Link>
      ) : null}
    </div>
  );
}

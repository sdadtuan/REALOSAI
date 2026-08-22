'use client';

import Link from 'next/link';
import { EmailPortalShell } from '@/components/email/EmailPortalShell';
import { EmailWidgetsPanel } from '@/components/EmailWidgetsPanel';

export default function PortalEmailDashboardPage() {
  return (
    <EmailPortalShell
      title="Email dashboard"
      subtitle="Campaign performance và approvals"
      actions={
        <Link href="/email/approvals" className="btn btn-secondary btn-sm">
          Approval inbox →
        </Link>
      }
    >
      {({ token, user, emailEnabled }) =>
        emailEnabled ? (
          <EmailWidgetsPanel token={token} showApprovalsLink={user.role === 'approver'} />
        ) : null
      }
    </EmailPortalShell>
  );
}

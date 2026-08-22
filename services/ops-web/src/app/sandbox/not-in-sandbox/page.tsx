'use client';

import Link from 'next/link';
import { StaffPageShell } from '@/components/layout';
import { clearSession, getStoredUser } from '@/lib/auth';

export default function NotInSandboxPage() {
  const user = getStoredUser();

  return (
    <StaffPageShell user={user} onLogout={() => clearSession()}>
      <h1>Not in sandbox</h1>
      <p className="lead">
        This area is not included in your sandbox. Contact sales for full access.
      </p>
      <Link href="/sandbox/leads" className="btn btn-sm">
        Back to sandbox leads
      </Link>
    </StaffPageShell>
  );
}

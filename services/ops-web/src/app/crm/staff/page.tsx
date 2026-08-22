'use client';

import { Suspense } from 'react';
import { CrmHrPageShell } from '@/components/crm/CrmHrPageShell';
import { StaffContent } from './StaffContent';

export default function CrmStaffPage() {
  return (
    <Suspense
      fallback={
        <CrmHrPageShell user={null} onLogout={() => {}} title="Nhân viên" loading>
          <span />
        </CrmHrPageShell>
      }
    >
      <StaffContent />
    </Suspense>
  );
}

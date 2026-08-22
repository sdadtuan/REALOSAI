'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { hasCap } from '@/lib/auth';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';
import { isStaffTicketsFeEnabled } from '@/lib/staff-tickets/flags';

export default function BdsTransactionsPage() {
  const searchParams = useSearchParams();
  const txId = searchParams.get('tx') ?? '';
  const { user, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_transactions', action: 'view' },
  ]);
  const canCreateTicket =
    isStaffTicketsFeEnabled() && hasCap(user, 'staff_tickets', 'create') && txId.trim().length > 0;

  if (notFound) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
      </main>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title="Giao dịch" subtitle="VBTT · HĐMB">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {!loading && !error ? (
          <>
            <p className="muted">Danh sách giao dịch theo dự án — mở chi tiết dự án để thao tác TX.</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link href="/crm/re-projects" className="btn btn-sm btn-secondary">
                Dự án BĐS
              </Link>
              {canCreateTicket ? (
                <Link
                  href={`/crm/work?entity_type=tx&entity_id=${encodeURIComponent(txId)}`}
                  className="btn btn-sm btn-primary"
                >
                  Tạo ticket
                </Link>
              ) : null}
            </div>
          </>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}

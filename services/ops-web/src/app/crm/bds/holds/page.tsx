'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { hasCap } from '@/lib/auth';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';
import { isStaffTicketsFeEnabled } from '@/lib/staff-tickets/flags';

export default function BdsHoldsPage() {
  const searchParams = useSearchParams();
  const holdId = searchParams.get('hold') ?? '';
  const { user, error, loading, notFound, logout } = useBdsPageAuth([{ section: 'bds_holds', action: 'view' }]);
  const canCreateTicket =
    isStaffTicketsFeEnabled() && hasCap(user, 'staff_tickets', 'create') && holdId.trim().length > 0;

  if (notFound) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
      </main>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title="Hold" subtitle="Giữ chỗ · cọc">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {!loading && !error ? (
          <>
            <p className="muted">Hold chờ duyệt hiện trên Tổng quan. Chi tiết theo dự án trên trang Dự án.</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link href="/crm/re-projects" className="btn btn-sm btn-secondary">
                Mở dự án BĐS
              </Link>
              {canCreateTicket ? (
                <Link
                  href={`/crm/work?entity_type=hold&entity_id=${encodeURIComponent(holdId)}`}
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

'use client';

import Link from 'next/link';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

export default function BdsHoldsPage() {
  const { user, error, loading, notFound, logout } = useBdsPageAuth([{ section: 'bds_holds', action: 'view' }]);

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
            <Link href="/crm/re-projects" className="btn btn-sm btn-secondary">
              Mở dự án BĐS
            </Link>
          </>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}

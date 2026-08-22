'use client';

import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

export default function BdsLeadsPage() {
  const { user, error, loading, notFound, logout } = useBdsPageAuth([{ section: 'bds_buyers', action: 'view' }]);

  if (notFound) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
      </main>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title="Lead khách mua" subtitle="BĐS · P6">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {!loading && !error ? (
          <p className="muted">
            Chọn dự án trên trang Dự án để xem lead theo project_id. API: GET /api/v1/bds/leads.
          </p>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}

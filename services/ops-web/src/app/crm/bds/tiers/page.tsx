'use client';

import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

export default function BdsTiersPage() {
  const { user, error, loading, notFound, logout } = useBdsPageAuth([{ section: 'bds_agency_tiers', action: 'view' }]);

  if (notFound) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
      </main>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title="Hạng đại lý" subtitle="Tier P5">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {!loading && !error ? (
          <p className="muted">Cấu hình hạng và override trên từng đại lý trong mục Mạng.</p>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}

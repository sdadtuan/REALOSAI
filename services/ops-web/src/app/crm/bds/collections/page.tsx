'use client';

import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

export default function BdsCollectionsPage() {
  const { user, error, loading, notFound, logout } = useBdsPageAuth([{ section: 'bds_collections', action: 'view' }]);

  if (notFound) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
      </main>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title="Công nợ" subtitle="Thu hồi P4b">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {!loading && !error ? (
          <p className="muted">
            Aging theo dự án qua API collections/aging. Nếu module chưa bật (PTT_BDS_COLLECTION=0), hiển thị «Công nợ chưa bật».
          </p>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}

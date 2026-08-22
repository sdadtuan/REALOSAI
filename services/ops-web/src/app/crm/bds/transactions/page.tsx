'use client';

import Link from 'next/link';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

export default function BdsTransactionsPage() {
  const { user, error, loading, notFound, logout } = useBdsPageAuth([{ section: 'bds_transactions', action: 'view' }]);

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
            <Link href="/crm/re-projects" className="btn btn-sm btn-secondary">
              Dự án BĐS
            </Link>
          </>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}

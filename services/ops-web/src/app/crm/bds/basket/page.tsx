'use client';

import { useEffect, useState } from 'react';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { fetchBdsMeBasket } from '@/lib/bds/api';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

export default function BdsBasketPage() {
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([{ section: 'bds_baskets', action: 'view' }]);
  const [items, setItems] = useState<unknown[] | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!token) return;
    void fetchBdsMeBasket(token)
      .then((out) => setItems(out.items ?? []))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Tải giỏ thất bại'));
  }, [token]);

  if (notFound) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
      </main>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title="Giỏ hàng" subtitle="Sàn nội bộ · basket">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {loadError ? <p className="muted">{loadError}</p> : null}
        {!loading && !error && items && items.length === 0 ? (
          <p className="muted">CĐT chưa cấp căn. Liên hệ AM.</p>
        ) : null}
        {items && items.length > 0 ? (
          <p className="muted">{items.length} căn trong giỏ.</p>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}

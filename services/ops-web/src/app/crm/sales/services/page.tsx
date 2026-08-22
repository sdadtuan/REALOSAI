'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HubPageLayout, StaffPageShell } from '@/components/layout';
import { SalesServiceCatalogPanel } from '@/components/sales/SalesServiceCatalogPanel';
import { fetchCustomers, staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { isOpsDvFeEnabled } from '@/lib/ops-dv-flags';
import { fetchQuoteCatalog, type QuoteCatalogFamily } from '@/lib/quote-api';

function SalesServicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [families, setFamilies] = useState<QuoteCatalogFamily[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: number; name?: string; company_name?: string }>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_board', 'view') && !hasCap(me, 'crm_leads', 'view')) {
        setError('Không có quyền tra cứu catalog bán hàng');
        return null;
      }
      setToken(access);
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      setToken(access);
      return access;
    }
  }, [router]);

  useEffect(() => {
    if (!isOpsDvFeEnabled()) {
      setError('Ops DV chưa bật (NEXT_PUBLIC_OPS_DV=1)');
      setLoading(false);
      return;
    }
    void (async () => {
      const access = await ensureAuth();
      if (!access) {
        setLoading(false);
        return;
      }
      try {
        const [catalog, customerRows] = await Promise.all([
          fetchQuoteCatalog(access),
          fetchCustomers(access, { limit: 200 }),
        ]);
        setFamilies(catalog.families ?? []);
        setCustomers(customerRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải catalog thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth]);

  const initialCustomerId = searchParams.get('customer_id') ?? '';
  const leadIdRaw = searchParams.get('lead_id');
  const leadId = leadIdRaw && Number.isFinite(Number(leadIdRaw)) ? Number(leadIdRaw) : null;

  if (!user && loading) {
    return (
      <StaffPageShell user={null} onLogout={() => router.push('/login')} loading>
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={() => {
        clearSession();
        router.push('/login');
      }}
      width="wide"
      breadcrumb={[
        { label: 'CRM', href: '/crm' },
        { label: 'Bán hàng', href: '/crm/sales' },
        { label: 'Tra cứu dịch vụ' },
      ]}
    >
      <HubPageLayout
        title="Tra cứu dịch vụ"
        subtitle="Sales · tìm DV/SKU · giá tham chiếu SPC · chuyển Quote Builder"
      >
        {loading ? <p className="muted">Đang tải catalog SPC…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {!loading && !error && token ? (
          <SalesServiceCatalogPanel
            token={token}
            families={families}
            customers={customers}
            initialCustomerId={initialCustomerId}
            leadId={leadId}
          />
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}

export default function SalesServicesPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: '2rem' }}>
          <p className="muted">Đang tải…</p>
        </main>
      }
    >
      <SalesServicesContent />
    </Suspense>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HubPageLayout, StaffPageShell } from '@/components/layout';
import { fetchBdsHub, fetchBdsTenantMe, setBdsTenantMode } from '@/lib/bds/api';
import { isBdsUiFeEnabled } from '@/lib/bds/flags';
import { hubHomeHref, type BdsTenantMode } from '@/lib/bds/nav';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';
import type { HubResponse } from '@/lib/bds/types';

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
}

export default function BdsHubPage() {
  const router = useRouter();
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_tenant', action: 'view' },
  ]);
  const [hub, setHub] = useState<HubResponse | null>(null);
  const [mode, setMode] = useState<BdsTenantMode>('developer');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const me = await fetchBdsTenantMe(token);
        setMode(me.mode);
        setBdsTenantMode(me.mode);
        if (me.mode === 'broker') {
          router.replace(hubHomeHref('broker'));
          return;
        }
        setHub(await fetchBdsHub(token));
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Tải hub thất bại');
      }
    })();
  }, [token, router]);

  if (notFound) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
      </main>
    );
  }

  if (loading) {
    return (
      <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
        <p className="muted">Đang tải…</p>
      </StaffPageShell>
    );
  }

  if (error) {
    return (
      <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
        <p className="muted">{error}</p>
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title="BĐS · Tổng quan" subtitle="Hub điều hành SCR-BDS-001">
        {loadError ? <p className="muted">{loadError}</p> : null}
        {hub ? (
          <>
            <section className="hub-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
              <div>
                <p className="muted">Tiêu thụ</p>
                <strong>{hub.kpi.sell_through_pct}%</strong>
              </div>
              <div>
                <p className="muted">GMV HĐ tháng</p>
                <strong>{formatVnd(hub.kpi.gmv_contracted_month_vnd)}</strong>
              </div>
              <div>
                <p className="muted">Quá hạn &gt;30 ngày</p>
                <strong>{hub.kpi.overdue_gt_30d}</strong>
              </div>
              <div>
                <p className="muted">Hold hết hạn 2h</p>
                <strong>{hub.kpi.holds_expiring_2h}</strong>
              </div>
              <Link href="/crm/cskh-board?flow=re_buyer&sla_filter=breach&sla_tier=first_call_15m">
                <p className="muted">CSKH breach 15p</p>
                <strong>{hub.kpi.cskh_breach_15m ?? 0}</strong>
              </Link>
              <Link href="/crm/bds/collections">
                <p className="muted">Phiếu thu hôm nay</p>
                <strong>{hub.kpi.receipts_today_count ?? 0}</strong>
              </Link>
            </section>

            <section style={{ marginTop: '1.5rem' }}>
              <h2>Inbox</h2>
              {hub.inbox.length === 0 ? (
                <p className="muted">Không có việc chờ duyệt.</p>
              ) : (
                <ul>
                  {hub.inbox.map((row) => (
                    <li key={row.id}>
                      <Link href={row.href}>Hold chờ F1 · {row.label}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <h3>Theo tòa</h3>
                {hub.sell_through_by_tower.length === 0 ? (
                  <p className="muted">Chưa có dữ liệu tòa.</p>
                ) : (
                  <table className="table-compact">
                    <tbody>
                      {hub.sell_through_by_tower.map((row) => (
                        <tr key={row.tower_code}>
                          <td>{row.tower_code}</td>
                          <td>{row.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div>
                <h3>Top đại lý tháng</h3>
                {hub.sell_through_by_agency.length === 0 ? (
                  <p className="muted">Chưa có giao dịch contracted.</p>
                ) : (
                  <table className="table-compact">
                    <tbody>
                      {hub.sell_through_by_agency.map((row) => (
                        <tr key={row.agency_id}>
                          <td>{row.name}</td>
                          <td>{row.units} căn</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
              <Link href="/crm/bds/holds" className="btn btn-sm btn-secondary">
                Hold
              </Link>
              <Link href="/crm/bds/collections" className="btn btn-sm btn-secondary">
                Công nợ
              </Link>
            </div>
          </>
        ) : (
          <p className="muted">Đang tải hub… (mode: {mode})</p>
        )}
      </HubPageLayout>
    </StaffPageShell>
  );
}

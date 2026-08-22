'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { fetchHrHubExpirySummary, type HrHubExpirySummaryDto } from '@/lib/hr-employee-file-api';

type Props = {
  token: string;
};

export function HrHubExpiryWidgets({ token }: Props) {
  const [summary, setSummary] = useState<HrHubExpirySummaryDto | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchHrHubExpirySummary(token);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải cảnh báo');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return null;
  if (!summary) return <p className="muted">Đang tải cảnh báo hết hạn…</p>;

  const tiles = [
    { id: 'wallet', label: 'Ví sắp hết hạn', count: summary.wallet_expiring_staff },
    { id: 'wallet_low', label: 'Ví % thấp (<80%)', count: summary.wallet_low_pct_staff },
    { id: 'contract', label: 'HĐ sắp hết hạn', count: summary.contract_expiring_staff },
    { id: 'bhyt', label: 'BHYT sắp hết hạn', count: summary.bhyt_expiring_staff },
  ].filter((t) => t.count > 0);

  if (!tiles.length && !summary.samples.length) return null;

  return (
    <section className="page-card stack-gap" style={{ marginBottom: '1rem' }}>
      <div>
        <h2 className="section-title" style={{ margin: 0 }}>
          Cảnh báo hết hạn
        </h2>
        <p className="muted" style={{ margin: '0.25rem 0 0' }}>
          Tổng hợp công ty — giấy tờ, HĐ, BHYT trong 30 ngày
        </p>
      </div>
      {tiles.length ? (
        <div className="hub-module-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(10rem, 1fr))' }}>
          {tiles.map((tile) => (
            <div key={tile.id} className="summary-card hub-module-card">
              <span className="muted">{tile.label}</span>
              <strong>{tile.count} NV</strong>
            </div>
          ))}
        </div>
      ) : null}
      {summary.samples.length ? (
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
          {summary.samples.map((s, i) => (
            <li key={`${s.staff_id}-${s.kind}-${i}`}>
              <Link href={`/crm/staff/${s.staff_id}`} className="link">
                {s.name || s.internal_code || `#${s.staff_id}`}
              </Link>
              {' — '}
              {s.detail}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

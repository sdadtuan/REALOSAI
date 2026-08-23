'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchBdsSpineBuyer, type BdsSpineBuyer } from '@/lib/bds/api';
import { isHoldTtlOverdue } from '@/lib/bds/cskh-board-re-buyer';
import { isStaffTicketsFeEnabled } from '@/lib/staff-tickets/flags';

export function BdsBuyer360Panel(props: {
  token: string;
  leadId: number;
  canViewPii: boolean;
}) {
  const [data, setData] = useState<BdsSpineBuyer | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setError('');
        const row = await fetchBdsSpineBuyer(props.token, props.leadId);
        if (!cancelled) setData(row);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Tải hành trình khách mua thất bại');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.token, props.leadId]);

  if (loading) return <p className="muted">Đang tải khách mua BĐS…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  const utmParts = [data.utm.source, data.utm.campaign_id, data.utm.ad_id].filter(Boolean);

  return (
    <section className="page-card stack-gap" aria-label="Khách mua BĐS">
      <div className="banner banner-info">
        <strong>Khách mua BĐS</strong>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
          Ads → chạm 15p → xem nhà → hold → cọc. Không Deal Room agency.
        </p>
      </div>

      <div className="grid-2 gap-md">
        <div>
          <h3 style={{ marginTop: 0 }}>Ads / UTM</h3>
          <p className="muted">{utmParts.length ? utmParts.join(' · ') : '—'}</p>
          {data.touched_at ? (
            <p className="muted">Chạm: {data.touched_at.slice(0, 16)}</p>
          ) : null}
        </div>
        <div>
          <h3 style={{ marginTop: 0 }}>Căn &amp; hold</h3>
          <p>
            {data.unit_code ?? '—'}
            {data.hold ? (
              <span className="muted">
                {' '}
                · {data.hold.status}
                {data.hold.expires_at ? (
                  <span className={isHoldTtlOverdue(data.hold.expires_at) ? ' text-danger' : ''}>
                    {' '}
                    TTL {data.hold.expires_at.slice(0, 16)}
                  </span>
                ) : null}
              </span>
            ) : null}
          </p>
          {data.hold ? (
            <Link href={`/crm/bds/holds?hold=${encodeURIComponent(data.hold.id)}`} className="btn btn-sm btn-ghost">
              Mở hold
            </Link>
          ) : null}
        </div>
        <div>
          <h3 style={{ marginTop: 0 }}>Giao dịch</h3>
          <p>{data.tx ? `${data.tx.stage} (${data.tx.id.slice(0, 8)})` : '—'}</p>
          {data.tx ? (
            <Link
              href={`/crm/bds/transactions?tx=${encodeURIComponent(data.tx.id)}`}
              className="btn btn-sm btn-ghost"
            >
              Mở TX
            </Link>
          ) : null}
          {data.tx?.stage === 'contracted' || data.tx?.stage === 'handed_over' || data.tx?.stage === 'title_issued' ? (
            <Link
              href={`/crm/bds/aftersales?tx=${encodeURIComponent(data.tx!.id)}`}
              className="btn btn-sm btn-ghost"
              style={{ marginLeft: '0.5rem' }}
            >
              Sau bán
            </Link>
          ) : null}
        </div>
        <div>
          <h3 style={{ marginTop: 0 }}>Lịch xem nhà</h3>
          {data.visits.length ? (
            <ul className="plain-list">
              {data.visits.map((v, i) => (
                <li key={`${v.scheduled_at}-${i}`} className="muted">
                  {v.scheduled_at.slice(0, 16)} · {v.outcome || 'booked'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Chưa có lịch xem</p>
          )}
        </div>
      </div>

      {isStaffTicketsFeEnabled() ? (
        <div className="row gap-sm">
          <Link
            href={`/crm/work?entity_type=lead&entity_id=${props.leadId}`}
            className="btn btn-sm btn-secondary"
          >
            Việc CSKH
          </Link>
          <Link href={`/crm/cskh-board?flow=re_buyer`} className="btn btn-sm btn-ghost">
            Board CSKH
          </Link>
        </div>
      ) : null}

      {!props.canViewPii ? (
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          SĐT đã mask — thiếu cap `bds_buyers.view_pii`.
        </p>
      ) : null}
    </section>
  );
}

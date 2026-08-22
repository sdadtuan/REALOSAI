'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  approveHrWalletCard,
  fetchHrPendingWalletReview,
  rejectHrWalletCard,
  type HrPendingWalletItemDto,
} from '@/lib/hr-employee-file-api';
import { hasCap, type StoredStaffUser } from '@/lib/auth';

type Props = {
  token: string;
  user: StoredStaffUser | null;
};

export function HrPendingWalletQueue({ token, user }: Props) {
  const [items, setItems] = useState<HrPendingWalletItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canApprove = Boolean(user && hasCap(user, 'crm_hr_docs', 'approve'));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchHrPendingWalletReview(token);
      setItems(out.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(item: HrPendingWalletItemDto) {
    if (!canApprove) return;
    try {
      await approveHrWalletCard(token, item.staff_id, item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duyệt thất bại');
    }
  }

  async function reject(item: HrPendingWalletItemDto) {
    if (!canApprove) return;
    const note = window.prompt('Lý do từ chối (tuỳ chọn):') ?? '';
    try {
      await rejectHrWalletCard(token, item.staff_id, item.id, note);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Từ chối thất bại');
    }
  }

  if (loading) return null;
  if (!items.length) return null;

  return (
    <section className="page-card stack-gap" style={{ marginBottom: '1rem' }}>
      <div>
        <h2 className="section-title" style={{ margin: 0 }}>
          Thẻ chờ duyệt ({items.length})
        </h2>
        <p className="muted" style={{ margin: '0.25rem 0 0' }}>
          NV tự nộp qua «Ví của tôi» — cần cap <code>crm_hr_docs.approve</code>
        </p>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
        {items.map((item) => (
          <li key={item.id} style={{ marginBottom: '0.35rem' }}>
            <Link href={`/crm/staff/${item.staff_id}`} className="link">
              {item.staff_name || item.internal_code}
            </Link>
            {' — '}
            {item.title || item.type_label} ({item.type_code}) · {item.file_count} file
            {canApprove ? (
              <>
                {' '}
                <button type="button" className="btn btn-sm btn-primary" onClick={() => void approve(item)}>
                  Duyệt
                </button>{' '}
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => void reject(item)}>
                  Từ chối
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

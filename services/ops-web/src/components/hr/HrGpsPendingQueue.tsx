'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchHrGpsPendingReview,
  reviewHrAttendancePunch,
  type HrAttendancePunchDto,
} from '@/lib/hr-employee-file-api';
import { hasCap, type StoredStaffUser } from '@/lib/auth';

type Props = {
  token: string;
  user: StoredStaffUser | null;
};

export function HrGpsPendingQueue({ token, user }: Props) {
  const [items, setItems] = useState<HrAttendancePunchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canReview = Boolean(user && hasCap(user, 'crm_hr_attendance', 'review'));

  const load = useCallback(async () => {
    if (!canReview) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const punches = await fetchHrGpsPendingReview(token);
      setItems(punches);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [canReview, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(item: HrAttendancePunchDto, action: 'accept' | 'reject') {
    try {
      await reviewHrAttendancePunch(token, item.id, action);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duyệt thất bại');
    }
  }

  if (loading || !canReview || !items.length) return null;

  return (
    <section className="page-card stack-gap" style={{ marginBottom: '1rem' }}>
      <div>
        <h2 className="section-title" style={{ margin: 0 }}>
          GPS chờ duyệt ({items.length})
        </h2>
        <p className="muted" style={{ margin: '0.25rem 0 0' }}>
          Ngoài geofence hoặc độ chính xác thấp — cap <code>crm_hr_attendance.review</code>
        </p>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
        {items.map((item) => (
          <li key={item.id} style={{ marginBottom: '0.35rem' }}>
            {item.staff_name ? (
              <Link href={`/crm/staff/${item.staff_id}`} className="link">
                {item.staff_name}
              </Link>
            ) : (
              'NV'
            )}
            {' — '}
            {item.direction === 'in' ? 'Vào' : 'Ra'} · {new Date(item.punched_at).toLocaleString('vi-VN')}
            {item.outside_geofence ? ' · ngoài vùng' : ''}
            {' '}
            <button type="button" className="btn btn-sm btn-primary" onClick={() => void review(item, 'accept')}>
              Duyệt
            </button>{' '}
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => void review(item, 'reject')}>
              Từ chối
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

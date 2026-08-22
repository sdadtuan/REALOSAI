'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { fetchHrAttendanceHubSummary } from '@/lib/hr-employee-file-api';

type Props = {
  token: string;
};

export function HrAttendanceHubWidgets({ token }: Props) {
  const [summary, setSummary] = useState<{
    unmapped_pins: number;
    devices_offline: number;
    missing_checkin_today: number;
    gps_pending_review: number;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const out = await fetchHrAttendanceHubSummary(token);
      setSummary(out);
    } catch {
      setSummary(null);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!summary) return null;
  if (!summary.unmapped_pins && !summary.devices_offline && !summary.missing_checkin_today && !summary.gps_pending_review) return null;

  return (
    <section className="page-card stack-gap" style={{ marginBottom: '1rem' }}>
      <div>
        <h2 className="section-title" style={{ margin: 0 }}>
          Chấm công máy
        </h2>
        <p className="muted" style={{ margin: '0.25rem 0 0' }}>
          <Link href="/crm/hr/attendance" className="link">
            Mở trung tâm chấm công →
          </Link>
        </p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {summary.unmapped_pins > 0 ? (
          <span className="hr-expiry-chip hr-expiry-chip--expiring">
            {summary.unmapped_pins} PIN chưa map
          </span>
        ) : null}
        {summary.devices_offline > 0 ? (
          <span className="hr-expiry-chip hr-expiry-chip--expiring">
            {summary.devices_offline} máy offline
          </span>
        ) : null}
        {summary.gps_pending_review > 0 ? (
          <span className="hr-expiry-chip hr-expiry-chip--expiring">
            {summary.gps_pending_review} GPS chờ duyệt
          </span>
        ) : null}
        {summary.missing_checkin_today > 0 ? (
          <span className="hr-expiry-chip hr-expiry-chip--muted">
            {summary.missing_checkin_today} NV chưa chấm hôm nay
          </span>
        ) : null}
      </div>
    </section>
  );
}

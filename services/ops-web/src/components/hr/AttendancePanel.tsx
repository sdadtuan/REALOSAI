'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchHrStaffAttendance,
  type HrAttendanceDayDto,
  type HrAttendancePunchDto,
} from '@/lib/hr-employee-file-api';

type Props = {
  staffId: number;
  token: string;
};

function sourceLabel(source: string): string {
  if (source === 'device') return 'Máy';
  if (source === 'gps') return 'GPS';
  if (source === 'manual') return 'Tay';
  return source;
}

function formatPunchTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

export function AttendancePanel({ staffId, token }: Props) {
  const [punches, setPunches] = useState<HrAttendancePunchDto[]>([]);
  const [days, setDays] = useState<HrAttendanceDayDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const out = await fetchHrStaffAttendance(
        token,
        staffId,
        from.toISOString().slice(0, 10),
        to.toISOString().slice(0, 10),
      );
      setPunches(out.punches);
      setDays(out.days);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải chấm công');
    } finally {
      setLoading(false);
    }
  }, [staffId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section className="page-card">
        <p className="muted">Đang tải chấm công…</p>
      </section>
    );
  }

  return (
    <div className="stack-gap">
      {error ? <p className="error">{error}</p> : null}

      <section className="page-card">
        <h2 className="section-title" style={{ margin: '0 0 0.75rem' }}>
          Rollup ngày (30 ngày)
        </h2>
        {days.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Chưa có ngày công từ máy chấm công.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Vào</th>
                  <th>Ra</th>
                  <th>Punch</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.work_date}>
                    <td className="mono">{d.work_date}</td>
                    <td>{d.check_in || '—'}</td>
                    <td>{d.check_out || '—'}</td>
                    <td>{d.punch_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="page-card">
        <h2 className="section-title" style={{ margin: '0 0 0.75rem' }}>
          Timeline punch
        </h2>
        {punches.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Chưa có punch từ máy. HR import CSV hoặc máy push ADMS.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {punches.map((p) => (
              <li
                key={p.id}
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                  padding: '0.45rem 0',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: '0.875rem',
                }}
              >
                <span className="hr-expiry-chip hr-expiry-chip--muted">{sourceLabel(p.source)}</span>
                <span className="mono">{formatPunchTime(p.punched_at)}</span>
                <span>{p.direction === 'in' ? 'Vào' : p.direction === 'out' ? 'Ra' : 'Auto'}</span>
                {p.device_name ? <span className="muted">{p.device_name}</span> : null}
                {p.site_name ? <span className="muted">@ {p.site_name}</span> : null}
                {p.outside_geofence ? (
                  <span className="hr-expiry-chip hr-expiry-chip--expiring">ngoài vùng</span>
                ) : null}
                {p.status !== 'accepted' ? (
                  <span className="hr-expiry-chip hr-expiry-chip--expiring">{p.status}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

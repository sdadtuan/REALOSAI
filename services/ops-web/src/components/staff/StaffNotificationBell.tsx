'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  fetchStaffNotifications,
  markStaffNotificationRead,
  type StaffNotificationRow,
} from '@/lib/hr-api';

export function StaffNotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [rows, setRows] = useState<StaffNotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchStaffNotifications(token, { limit: 20 });
      setRows(data.notifications);
      setUnread(data.unread);
    } catch {
      setRows([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = window.setInterval(() => void reload(), 60_000);
    return () => window.clearInterval(id);
  }, [reload]);

  async function onMarkRead(id: string) {
    const token = getAccessToken();
    if (!token) return;
    await markStaffNotificationRead(token, id);
    await reload();
  }

  return (
    <div className="staff-notif-bell">
      <button
        type="button"
        className="btn btn-sm btn-secondary staff-notif-bell__trigger"
        aria-label={`Thông báo${unread ? ` (${unread} chưa đọc)` : ''}`}
        onClick={() => {
          setOpen((v) => !v);
          void reload();
        }}
      >
        🔔
        {unread > 0 ? <span className="staff-notif-bell__badge">{unread}</span> : null}
      </button>
      {open ? (
        <div className="staff-notif-bell__panel" role="dialog" aria-label="Thông báo staff">
          <div className="staff-notif-bell__head">
            <strong>Thông báo</strong>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setOpen(false)}>
              Đóng
            </button>
          </div>
          {loading ? <p className="muted">Đang tải…</p> : null}
          <ul className="staff-notif-bell__list">
            {rows.length ? (
              rows.map((n) => (
                <li key={n.id} className={n.read ? 'is-read' : 'is-unread'}>
                  <div>
                    <strong>{n.title}</strong>
                    {n.kind === 'mkt_ai_kpi_drift' ? (
                      <small className="staff-notif-bell__kind"> · KPI drift</small>
                    ) : null}
                    {n.body ? <p>{n.body}</p> : null}
                    <small>{new Date(n.created_at).toLocaleString('vi-VN')}</small>
                  </div>
                  <div className="staff-notif-bell__actions">
                    {n.link_href ? (
                      <Link href={n.link_href} className="btn btn-sm" onClick={() => setOpen(false)}>
                        Mở
                      </Link>
                    ) : null}
                    {!n.read ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => void onMarkRead(n.id)}
                      >
                        Đã đọc
                      </button>
                    ) : null}
                  </div>
                </li>
              ))
            ) : (
              <li className="muted">Không có thông báo.</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

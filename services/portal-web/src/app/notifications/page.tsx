'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageToolbar, SegmentedControl } from '@/components/layout';
import { PortalPageShell } from '@/components/PortalPageShell';
import {
  fetchPortalNotifications,
  markAllPortalNotificationsRead,
  markPortalNotificationRead,
  type PortalNotificationRow,
} from '@/lib/api';
import { useToast } from '@/lib/toast';

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function categoryLabel(category: string): string {
  switch (category) {
    case 'creative_pending':
      return 'Creative';
    case 'email_pending':
      return 'Email';
    case 'seo_pending':
      return 'SEO';
    case 'campaign_milestone':
      return 'Milestone';
    default:
      return 'Hệ thống';
  }
}

export default function NotificationsPage() {
  return (
    <PortalPageShell
      breadcrumb={[{ label: 'Client Portal', href: '/dashboard' }, { label: 'Thông báo' }]}
    >
      {({ token }) => <NotificationsContent token={token} />}
    </PortalPageShell>
  );
}

function NotificationsContent({ token }: { token: string }) {
  const { push } = useToast();
  const [rows, setRows] = useState<PortalNotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [tableReady, setTableReady] = useState(true);
  const unreadOnly = filter === 'unread';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPortalNotifications(token, { unreadOnly, limit: 50 });
      setRows(data.rows);
      setUnread(data.unread);
      setTableReady(data.table_ready);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được thông báo');
    } finally {
      setLoading(false);
    }
  }, [token, unreadOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleMarkRead(row: PortalNotificationRow) {
    if (row.read) return;
    try {
      await markPortalNotificationRead(token, row.id);
      push('Đã đánh dấu đã đọc', 'success');
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Thao tác thất bại', 'error');
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllPortalNotificationsRead(token);
      push('Đã đánh dấu tất cả đã đọc', 'success');
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Thao tác thất bại', 'error');
    }
  }

  return (
    <div className="page-card">
      <PageToolbar
        title="Trung tâm thông báo"
        subtitle={unread > 0 ? `${unread} chưa đọc` : 'Tất cả đã đọc'}
        actions={
          unread > 0 ? (
            <button type="button" className="btn btn-secondary" onClick={() => void handleMarkAllRead()}>
              Đánh dấu tất cả đã đọc
            </button>
          ) : null
        }
      />

      <div className="portal-kpi-strip">
        <div className="portal-kpi-tile">
          <strong>{unread}</strong>
          <span>Chưa đọc</span>
        </div>
        <div className="portal-kpi-tile">
          <strong>{rows.length}</strong>
          <span>{unreadOnly ? 'Chưa đọc (hiển thị)' : 'Tổng (trang này)'}</span>
        </div>
      </div>

      <SegmentedControl
        label="Lọc"
        value={filter}
        onChange={setFilter}
        options={[
          { id: 'all', label: 'Tất cả' },
          { id: 'unread', label: 'Chưa đọc', badge: unread },
        ]}
      />

      {!tableReady ? (
        <p className="portal-callout portal-callout--warn">
          Bảng thông báo chưa sẵn sàng trên môi trường này — liên hệ AM nếu bạn không thấy thông báo sau khi
          AM gửi creative.
        </p>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {loading ? (
        <p className="muted">Đang tải…</p>
      ) : rows.length === 0 ? (
        <div className="card portal-empty-state">
          <p className="portal-empty-state__title">
            Không có thông báo{unreadOnly ? ' chưa đọc' : ''}
          </p>
        </div>
      ) : (
        <ul className="notification-list">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`card notification-card${row.read ? ' notification-card--read' : ' notification-card--unread'}`}
            >
              <div className="notification-card__head">
                <div className="notification-card__body">
                  <p className="badge notification-card__category">{categoryLabel(row.category)}</p>
                  <p
                    className={`notification-card__title${row.read ? ' notification-card__title--read' : ' notification-card__title--unread'}`}
                  >
                    {row.title}
                  </p>
                  {row.body ? <p className="muted">{row.body}</p> : null}
                  <p className="muted notification-card__time">{formatWhen(row.created_at)}</p>
                </div>
                <div className="notification-card__actions">
                  {row.link_url ? (
                    <Link href={row.link_url} className="btn btn-secondary">
                      Mở
                    </Link>
                  ) : null}
                  {!row.read ? (
                    <button type="button" className="btn" onClick={() => void handleMarkRead(row)}>
                      Đã đọc
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

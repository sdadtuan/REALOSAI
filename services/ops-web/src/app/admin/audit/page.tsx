'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import {
  AUDIT_CATEGORY_LABELS,
  AuditSeverityBadge,
} from '@/components/admin/audit/AuditSeverityBadge';
import {
  downloadAdminAuditExport,
  fetchAdminAuditEvent,
  fetchAdminAuditEvents,
  pollAdminAuditExportJob,
  requestAdminAuditExport,
  type AdminAuditEvent,
} from '@/lib/api';
import { canViewAdminAudit, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function AuditCenterContent() {
  const searchParams = useSearchParams();
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewAdminAudit);
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<AdminAuditEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [actor, setActor] = useState('');
  const [subject, setSubject] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState(searchParams.get('category') ?? '');
  const [severity, setSeverity] = useState('');

  const filters = useMemo(
    () => ({ actor, subject, q, category, severity }),
    [actor, subject, q, category, severity],
  );

  const loadPage = useCallback(
    async (nextCursor?: string | null, append = false) => {
      if (!token) return;
      setBusy(true);
      setLoadError('');
      try {
        const res = await fetchAdminAuditEvents(token, {
          ...filters,
          category: filters.category || undefined,
          severity: filters.severity || undefined,
          cursor: nextCursor ?? undefined,
          limit: 50,
        });
        setEvents((prev) => (append ? [...prev, ...res.events] : res.events));
        setCursor(res.next_cursor);
        setHasMore(res.has_more);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Tải audit thất bại');
      } finally {
        setBusy(false);
      }
    },
    [token, filters],
  );

  useEffect(() => {
    if (!token) return;
    void loadPage(null, false);
  }, [token, loadPage]);

  async function openDrawer(event: AdminAuditEvent) {
    setSelected(event);
    setDrawerOpen(true);
    if (!token) return;
    try {
      const detail = await fetchAdminAuditEvent(token, event.id);
      setSelected(detail);
    } catch {
      /* keep list row */
    }
  }

  async function runExport(format: 'csv' | 'json') {
    if (!token) return;
    setBusy(true);
    try {
      const job = await requestAdminAuditExport(token, { format, ...filters });
      for (let i = 0; i < 40; i += 1) {
        await new Promise((r) => setTimeout(r, 500));
        const status = await pollAdminAuditExportJob(token, job.job_id);
        if (status.status === 'completed') {
          await downloadAdminAuditExport(token, job.job_id, format);
          break;
        }
        if (status.status === 'failed') {
          throw new Error(status.error_message ?? 'Export thất bại');
        }
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Export thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      title="Audit Center"
      subtitle="Timeline thay đổi RBAC, org và truy cập PII — export compliance"
      section="crm-config"
      loading={loading}
      actions={
        <div className="admin-audit-export-bar">
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void runExport('csv')}>
            Export CSV
          </button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void runExport('json')}>
            Export JSON
          </button>
        </div>
      }
    >
      {error ? <p className="error">{error}</p> : null}
      {loadError ? <p className="error">{loadError}</p> : null}

      <div className="admin-audit-layout page-card">
        <div className="admin-audit-filters">
          <input
            className="input"
            placeholder="Actor email"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            aria-label="Lọc actor"
          />
          <input
            className="input"
            placeholder="Đối tượng (email, mã CV…)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Lọc đối tượng"
          />
          <input
            className="input"
            placeholder="Tìm tóm tắt…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Tìm kiếm audit"
          />
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Loại sự kiện"
          >
            <option value="">Tất cả loại</option>
            {Object.entries(AUDIT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            aria-label="Mức độ"
          >
            <option value="">Tất cả mức</option>
            <option value="info">Thông tin</option>
            <option value="warning">Cảnh báo</option>
            <option value="critical">Nghiêm trọng</option>
          </select>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void loadPage(null, false)}>
            Lọc
          </button>
        </div>

        <div className="table-wrap admin-audit-table">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Mức</th>
                <th>Loại</th>
                <th>Actor</th>
                <th>Đối tượng</th>
                <th>Tóm tắt</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    {busy ? 'Đang tải…' : 'Chưa có sự kiện audit trong khoảng lọc.'}
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id}>
                    <td>{formatWhen(event.created_at)}</td>
                    <td>
                      <AuditSeverityBadge severity={event.severity} />
                    </td>
                    <td>{AUDIT_CATEGORY_LABELS[event.category] ?? event.category}</td>
                    <td>{event.actor_email || '—'}</td>
                    <td>{event.subject_label ?? '—'}</td>
                    <td>
                      <button type="button" className="link-button" onClick={() => void openDrawer(event)}>
                        {event.summary}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasMore ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => void loadPage(cursor, true)}
          >
            Tải thêm
          </button>
        ) : null}
      </div>

      {drawerOpen && selected ? (
        <>
          <button
            type="button"
            className="admin-cp-rail-drawer-backdrop"
            aria-label="Đóng chi tiết audit"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="admin-audit-drawer" aria-label="Chi tiết audit">
            <div className="admin-cp-rail-drawer-head">
              <strong>Chi tiết sự kiện</strong>
              <button type="button" className="admin-cp-rail-drawer-close" onClick={() => setDrawerOpen(false)}>
                Đóng
              </button>
            </div>
            <dl className="admin-audit-detail">
              <dt>Thời gian</dt>
              <dd>{formatWhen(selected.created_at)}</dd>
              <dt>Mức</dt>
              <dd>
                <AuditSeverityBadge severity={selected.severity} />
              </dd>
              <dt>Actor</dt>
              <dd>{selected.actor_email}</dd>
              <dt>Tóm tắt</dt>
              <dd>{selected.summary}</dd>
            </dl>
            <pre className="admin-audit-diff">{JSON.stringify(selected.diff_json, null, 2)}</pre>
            {selected.category === 'permission_matrix' && selected.subject_id ? (
              <p>
                <Link href={`/admin/crm/permissions`}>Mở ma trận chức vụ →</Link>
              </p>
            ) : null}
            {selected.category === 'org_user' && selected.subject_label?.includes('@') ? (
              <p>
                <Link href={`/admin/crm/org/users?email=${encodeURIComponent(selected.subject_label)}`}>
                  Mở người dùng →
                </Link>
              </p>
            ) : null}
          </aside>
        </>
      ) : null}
    </AdminPageShell>
  );
}

export default function AdminAuditPage() {
  return (
    <Suspense fallback={<p className="muted">Đang tải Audit Center…</p>}>
      <AuditCenterContent />
    </Suspense>
  );
}

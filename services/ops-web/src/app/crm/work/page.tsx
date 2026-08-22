'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { HubPageLayout, StaffPageShell } from '@/components/layout';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  entityHref,
  fetchWorkQueues,
  fetchWorkTickets,
  postWorkAssign,
  postWorkTicket,
  postWorkTransition,
  type WorkQueue,
  type WorkTicket,
} from '@/lib/staff-tickets/api';
import { isStaffTicketsFeEnabled } from '@/lib/staff-tickets/flags';

const INBOX_TABS: Array<{ id: string; label: string }> = [
  { id: 'mine', label: 'Của tôi' },
  { id: 'dept_queue', label: 'Queue ban' },
  { id: 'inbound', label: 'Inbound' },
  { id: 'outbound', label: 'Outbound' },
];

function slaLabel(ticket: WorkTicket): string {
  if (ticket.sla_breached) return 'Quá SLA';
  if (!ticket.sla_due_at) return '—';
  const due = new Date(ticket.sla_due_at);
  if (due.getTime() < Date.now()) return 'Quá hạn';
  return due.toLocaleString('vi-VN');
}

export default function StaffWorkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [inbox, setInbox] = useState('mine');
  const [queueFilter, setQueueFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [queues, setQueues] = useState<WorkQueue[]>([]);
  const [tickets, setTickets] = useState<WorkTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createKind, setCreateKind] = useState<'dept' | 'cross'>('dept');
  const [createQueue, setCreateQueue] = useState('dept_backlog');
  const [createTitle, setCreateTitle] = useState('');
  const [createBody, setCreateBody] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [doneComment, setDoneComment] = useState('');

  const prefillEntityType = searchParams.get('entity_type') ?? '';
  const prefillEntityId = searchParams.get('entity_id') ?? '';
  const prefillTicket = searchParams.get('ticket') ?? '';

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  useEffect(() => {
    if (!isStaffTicketsFeEnabled()) {
      setDisabled(true);
      setLoading(false);
      return;
    }
    void (async () => {
      const access = await ensureAuth();
      if (!access) {
        setLoading(false);
        return;
      }
      setToken(access);
      setLoading(false);
    })();
  }, [ensureAuth]);

  useEffect(() => {
    if (prefillEntityType && prefillEntityId) {
      setShowCreate(true);
      setCreateKind('cross');
      setCreateTitle(`Việc · ${prefillEntityType} ${prefillEntityId.slice(0, 8)}`);
    }
  }, [prefillEntityType, prefillEntityId]);

  useEffect(() => {
    if (prefillTicket) setSelectedId(prefillTicket);
  }, [prefillTicket]);

  useEffect(() => {
    if (!token || disabled) return;
    void fetchWorkQueues(token)
      .then(setQueues)
      .catch(() => setQueues([]));
  }, [token, disabled]);

  useEffect(() => {
    if (!token || disabled) {
      setTickets([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchWorkTickets(token, inbox, {
          queue: queueFilter || undefined,
          overdue: overdueOnly || undefined,
        });
        if (!cancelled) {
          setTickets(next);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof Error && err.message.includes('404')) {
            setDisabled(true);
          } else {
            setError(err instanceof Error ? err.message : 'Tải việc thất bại');
          }
        }
      }
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, inbox, queueFilter, overdueOnly, disabled]);

  const selected = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? null,
    [tickets, selectedId],
  );

  const canAssign = hasCap(user, 'staff_tickets', 'assign');
  const canClose = hasCap(user, 'staff_tickets', 'close');
  const canCreate = hasCap(user, 'staff_tickets', 'create');

  async function reloadTickets() {
    const next = await fetchWorkTickets(token, inbox, {
      queue: queueFilter || undefined,
      overdue: overdueOnly || undefined,
    });
    setTickets(next);
  }

  async function runAction(fn: () => Promise<unknown>) {
    setToast('');
    try {
      await fn();
      await reloadTickets();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thao tác thất bại';
      setToast(msg === 'artifact' || msg === 'system_only' ? `Không thể đóng: ${msg}` : msg);
    }
  }

  async function submitCreate() {
    if (!createTitle.trim()) {
      setToast('Nhập tiêu đề');
      return;
    }
    await runAction(() =>
      postWorkTicket(token, {
        kind: createKind,
        queue_code: createQueue,
        title: createTitle.trim(),
        body: createBody.trim(),
        entity_type: prefillEntityType || null,
        entity_id: prefillEntityId || null,
      }),
    );
    setShowCreate(false);
    setCreateTitle('');
    setCreateBody('');
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  const entityLink = selected ? entityHref(selected) : null;

  if (disabled) {
    return (
      <StaffPageShell user={user} onLogout={logout} loading={false}>
        <HubPageLayout title="Việc" subtitle="Nội bộ">
          <p className="muted">Việc nội bộ chưa bật</p>
        </HubPageLayout>
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title="Việc" subtitle="Queue ban · Liên phòng">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {toast ? <p className="muted">{toast}</p> : null}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
          {INBOX_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`btn btn-sm ${inbox === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setInbox(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <select
            className="input input-sm"
            value={queueFilter}
            onChange={(e) => setQueueFilter(e.target.value)}
            aria-label="Lọc queue"
          >
            <option value="">Tất cả queue</option>
            {queues.map((q) => (
              <option key={q.code} value={q.code}>
                {q.name}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
            />
            Quá SLA
          </label>
          {canCreate ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>
              Tạo ticket
            </button>
          ) : null}
        </div>
        {showCreate ? (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 8 }}>
            <h4>Tạo ticket</h4>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <select className="input input-sm" value={createKind} onChange={(e) => setCreateKind(e.target.value as 'dept' | 'cross')}>
                <option value="dept">Trong ban</option>
                <option value="cross">Liên ban</option>
              </select>
              <select className="input input-sm" value={createQueue} onChange={(e) => setCreateQueue(e.target.value)}>
                {queues.map((q) => (
                  <option key={q.code} value={q.code}>
                    {q.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              className="input"
              placeholder="Tiêu đề"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              style={{ width: '100%', marginBottom: '0.5rem' }}
            />
            <textarea
              className="input"
              rows={3}
              placeholder="Mô tả"
              value={createBody}
              onChange={(e) => setCreateBody(e.target.value)}
              style={{ width: '100%', marginBottom: '0.5rem' }}
            />
            {prefillEntityType && prefillEntityId ? (
              <p className="muted" style={{ fontSize: '0.875rem' }}>
                Gắn: {prefillEntityType} {prefillEntityId}
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => void submitCreate()}>
                Lưu
              </button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowCreate(false)}>
                Hủy
              </button>
            </div>
          </div>
        ) : null}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1fr) minmax(280px, 2fr)',
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          <aside>
            {tickets.length === 0 ? <p className="muted">Chưa có việc.</p> : null}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      marginBottom: '0.25rem',
                      fontWeight: selectedId === t.id ? 700 : 400,
                      color: t.sla_breached ? '#c0392b' : undefined,
                    }}
                    onClick={() => setSelectedId(t.id)}
                  >
                    {t.number} · {t.title}
                    <br />
                    <small>
                      {t.queue_code} · SLA: {slaLabel(t)}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <section>
            {!selected ? (
              <p className="muted">Chọn một ticket để xem chi tiết.</p>
            ) : (
              <>
                <h3>{selected.number}</h3>
                <p>
                  <strong>{selected.title}</strong>
                </p>
                <p className="muted">
                  {selected.queue_code} · {selected.status} · {selected.priority}
                </p>
                {entityLink ? (
                  <p>
                    <Link href={entityLink} className="btn btn-sm btn-secondary">
                      Mở {selected.entity_type}
                    </Link>
                  </p>
                ) : null}
                {selected.room_id ? (
                  <p>
                    <Link href={`/crm/chat?room=${selected.room_id}`} className="btn btn-sm btn-secondary">
                      Mở chat
                    </Link>
                  </p>
                ) : null}
                <p>{selected.hidden ? 'Hồ sơ ẩn' : selected.body || '—'}</p>
                {selected.blocked_reason ? (
                  <p className="muted">Blocked: {selected.blocked_reason}</p>
                ) : null}
                {selected.waiting_on ? <p className="muted">Chờ: {selected.waiting_on}</p> : null}
                {(selected.status === 'blocked' || selected.status === 'waiting') && canClose ? (
                  <input
                    className="input input-sm"
                    placeholder="Lý do / ghi chú"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                  />
                ) : null}
                {selected.queue_code === 'ops_action' && canClose ? (
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Comment khi hoàn thành (tối thiểu 10 ký tự)"
                    value={doneComment}
                    onChange={(e) => setDoneComment(e.target.value)}
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                  />
                ) : null}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {canAssign && !selected.assignee_staff_id && selected.status === 'open' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => void runAction(() => postWorkAssign(token, selected.id))}
                    >
                      Claim
                    </button>
                  ) : null}
                  {canAssign && selected.status === 'open' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() =>
                        void runAction(() => postWorkTransition(token, selected.id, 'in_progress'))
                      }
                    >
                      Bắt đầu
                    </button>
                  ) : null}
                  {canClose && ['in_progress', 'open'].includes(selected.status) ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() =>
                        void runAction(() =>
                          postWorkTransition(token, selected.id, 'waiting', {
                            reason: actionReason.trim() || 'Chờ phản hồi',
                          }),
                        )
                      }
                    >
                      Chờ
                    </button>
                  ) : null}
                  {canClose && ['in_progress', 'open'].includes(selected.status) ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() =>
                        void runAction(() =>
                          postWorkTransition(token, selected.id, 'blocked', {
                            reason: actionReason.trim() || 'Bị chặn',
                          }),
                        )
                      }
                    >
                      Blocked
                    </button>
                  ) : null}
                  {canClose && selected.status === 'in_progress' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() =>
                        void runAction(() =>
                          postWorkTransition(token, selected.id, 'done', {
                            comment: doneComment.trim() || undefined,
                          }),
                        )
                      }
                    >
                      Hoàn thành
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </section>
        </div>
      </HubPageLayout>
    </StaffPageShell>
  );
}

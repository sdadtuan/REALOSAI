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
  downloadWorkExport,
  entityHref,
  fetchWorkComments,
  fetchWorkEvents,
  fetchWorkQueues,
  fetchWorkTickets,
  postWorkAssign,
  postWorkTicket,
  postWorkTransition,
  type WorkComment,
  type WorkEvent,
  type WorkQueue,
  type WorkTicket,
} from '@/lib/staff-tickets/api';
import { isStaffTicketsFeEnabled } from '@/lib/staff-tickets/flags';
import {
  INBOX_EMPTY,
  KIND_LABEL,
  PRIORITY_LABEL,
  STATUS_FLOW,
  STATUS_LABEL,
  entityChipLabel,
  priorityBadgeClass,
  slaVisual,
  statusBadgeClass,
  ticketErrorMessage,
} from '@/lib/staff-tickets/work-ui';

const INBOX_TABS: Array<{ id: string; label: string }> = [
  { id: 'mine', label: 'Của tôi' },
  { id: 'dept_queue', label: 'Queue ban' },
  { id: 'inbound', label: 'Inbound' },
  { id: 'outbound', label: 'Outbound' },
];

const EVENT_LABEL: Record<string, string> = {
  created: 'Tạo',
  handoff: 'Bàn giao',
  assigned: 'Gán',
  transition: 'Chuyển trạng thái',
  sla_breach: 'Quá SLA',
  sla_pause: 'Tạm SLA',
  escalate: 'Leo thang',
  watch: 'Theo dõi',
  patched: 'Cập nhật',
};

function SlaBar({ ticket }: { ticket: WorkTicket }) {
  const sla = slaVisual(ticket);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
        <span className="muted">SLA</span>
        <span className={sla.tone === 'error' ? 'meta-badge meta-badge--error' : 'muted'}>
          {sla.label}
        </span>
      </div>
      <div className="work-sla-bar" aria-hidden>
        <div
          className={`work-sla-bar__fill work-sla-bar__fill--${sla.tone}`}
          style={{ width: `${sla.pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusFlow({ status }: { status: string }) {
  return (
    <div className="work-status-flow" aria-label="Luồng trạng thái">
      {STATUS_FLOW.map((step) => (
        <span
          key={step}
          className={`work-status-step ${status === step ? 'work-status-step--active' : ''}`}
        >
          {STATUS_LABEL[step] ?? step}
        </span>
      ))}
    </div>
  );
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
  const [comments, setComments] = useState<WorkComment[]>([]);
  const [events, setEvents] = useState<WorkEvent[]>([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ tone: 'ok' | 'error'; title: string; code?: string } | null>(
    null,
  );
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createKind, setCreateKind] = useState<'dept' | 'cross'>('dept');
  const [createQueue, setCreateQueue] = useState('dept_backlog');
  const [createTitle, setCreateTitle] = useState('');
  const [createBody, setCreateBody] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [doneComment, setDoneComment] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const prefillEntityType = searchParams.get('entity_type') ?? '';
  const prefillEntityId = searchParams.get('entity_id') ?? '';
  const prefillTicket = searchParams.get('ticket') ?? '';

  const queueNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of queues) map.set(q.code, q.name);
    return map;
  }, [queues]);

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

  const reloadTickets = useCallback(async () => {
    const next = await fetchWorkTickets(token, inbox, {
      queue: queueFilter || undefined,
      overdue: overdueOnly || undefined,
    });
    setTickets(next);
    setLastRefresh(new Date());
  }, [token, inbox, queueFilter, overdueOnly]);

  useEffect(() => {
    if (!token || disabled) {
      setTickets([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        await reloadTickets();
        if (!cancelled) setError('');
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
  }, [token, disabled, reloadTickets]);

  const selected = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? null,
    [tickets, selectedId],
  );

  useEffect(() => {
    if (!token || !selected) {
      setComments([]);
      setEvents([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [c, e] = await Promise.all([
          fetchWorkComments(token, selected.id),
          fetchWorkEvents(token, selected.id),
        ]);
        if (!cancelled) {
          setComments(c);
          setEvents(e);
        }
      } catch {
        if (!cancelled) {
          setComments([]);
          setEvents([]);
        }
      }
    })();
  }, [token, selected?.id]);

  useEffect(() => {
    setActionReason('');
    setDoneComment('');
  }, [selected?.id]);

  const canAssign = hasCap(user, 'staff_tickets', 'assign');
  const canClose = hasCap(user, 'staff_tickets', 'close');
  const canCreate = hasCap(user, 'staff_tickets', 'create');
  const canExport = hasCap(user, 'staff_tickets', 'export');

  async function runAction(fn: () => Promise<unknown>, okMessage?: string) {
    setToast(null);
    try {
      await fn();
      await reloadTickets();
      if (okMessage) setToast({ tone: 'ok', title: okMessage });
    } catch (err) {
      const code = err instanceof Error ? err.message : 'error';
      const mapped = ticketErrorMessage(code);
      setToast({ tone: 'error', title: mapped.title, code: mapped.code });
    }
  }

  async function submitCreate() {
    if (!createTitle.trim()) {
      setToast({ tone: 'error', title: 'Nhập tiêu đề ticket.', code: 'title' });
      return;
    }
    await runAction(
      () =>
        postWorkTicket(token, {
          kind: createKind,
          queue_code: createQueue,
          title: createTitle.trim(),
          body: createBody.trim(),
          entity_type: prefillEntityType || null,
          entity_id: prefillEntityId || null,
        }),
      'Đã tạo ticket.',
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
  const chipLabel = selected ? entityChipLabel(selected) : null;
  const emptyCopy = INBOX_EMPTY[inbox] ?? 'Chưa có việc.';

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
      <HubPageLayout title="Việc" subtitle="Queue ban · Liên phòng · SCR-BDS-120">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {toast ? (
          <div className={`work-toast work-toast--${toast.tone}`} role="status">
            {toast.title}
            {toast.code ? <span className="work-toast__code">{toast.code}</span> : null}
          </div>
        ) : null}

        <div className="work-toolbar">
          {INBOX_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`btn btn-sm ${inbox === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setInbox(tab.id)}
            >
              {tab.label}
              {inbox === tab.id && tickets.length > 0 ? (
                <span style={{ marginLeft: '0.35rem', opacity: 0.85 }}>({tickets.length})</span>
              ) : null}
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
          {canExport ? (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() =>
                void runAction(
                  () =>
                    downloadWorkExport(token, {
                      inbox,
                      queue: queueFilter || undefined,
                      overdue: overdueOnly || undefined,
                    }),
                  'Đã tải CSV.',
                )
              }
            >
              Xuất CSV
            </button>
          ) : null}
          {lastRefresh ? (
            <span className="work-toolbar__poll">
              Cập nhật {lastRefresh.toLocaleTimeString('vi-VN')} · 5s
            </span>
          ) : null}
        </div>

        {showCreate ? (
          <div className="work-create-panel">
            <h4 style={{ marginTop: 0 }}>Tạo ticket</h4>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <select
                className="input input-sm"
                value={createKind}
                onChange={(e) => setCreateKind(e.target.value as 'dept' | 'cross')}
              >
                <option value="dept">{KIND_LABEL.dept}</option>
                <option value="cross">{KIND_LABEL.cross}</option>
              </select>
              <select
                className="input input-sm"
                value={createQueue}
                onChange={(e) => setCreateQueue(e.target.value)}
              >
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
                Gắn entity: {prefillEntityType} {prefillEntityId.slice(0, 8)}
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

        <div className="work-layout">
          <aside className="work-panel">
            <p className="work-panel__title">Danh sách</p>
            {tickets.length === 0 ? <p className="muted">{emptyCopy}</p> : null}
            <ul className="work-ticket-list">
              {tickets.map((t) => {
                const overdue = t.sla_breached || slaVisual(t).tone === 'error';
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={`work-ticket-row ${selectedId === t.id ? 'work-ticket-row--selected' : ''} ${overdue ? 'work-ticket-row--overdue' : ''}`}
                      onClick={() => setSelectedId(t.id)}
                    >
                      <div className="work-ticket-row__title">
                        {t.number} · {t.title}
                      </div>
                      <div className="work-ticket-row__meta">
                        <span className={statusBadgeClass(t.status)}>
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                        <span>{queueNameByCode.get(t.queue_code) ?? t.queue_code}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="work-panel">
            <p className="work-panel__title">Chi tiết</p>
            {!selected ? (
              <p className="muted">Chọn một ticket để xem chi tiết.</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                  <strong>{selected.number}</strong>
                  <span className={statusBadgeClass(selected.status)}>
                    {STATUS_LABEL[selected.status] ?? selected.status}
                  </span>
                  <span className={priorityBadgeClass(selected.priority)}>
                    {PRIORITY_LABEL[selected.priority] ?? selected.priority}
                  </span>
                  <span className="meta-badge meta-badge--muted">
                    {KIND_LABEL[selected.kind] ?? selected.kind}
                  </span>
                </div>
                <h3 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.05rem' }}>{selected.title}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {queueNameByCode.get(selected.queue_code) ?? selected.queue_code}
                </p>

                <StatusFlow status={selected.status} />
                <SlaBar ticket={selected} />

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '0.75rem 0' }}>
                  {chipLabel && entityLink ? (
                    <Link href={entityLink} className="work-entity-chip">
                      {chipLabel}
                    </Link>
                  ) : chipLabel ? (
                    <span className="work-entity-chip">{chipLabel}</span>
                  ) : null}
                  {selected.room_id ? (
                    <Link href={`/crm/chat?room=${selected.room_id}`} className="btn btn-sm btn-secondary">
                      Mở chat
                    </Link>
                  ) : null}
                </div>

                <p className="work-detail-body">
                  {selected.hidden ? 'Hồ sơ ẩn' : selected.body || '—'}
                </p>
                {selected.blocked_reason ? (
                  <p className="muted">
                    <strong>Bị chặn:</strong> {selected.blocked_reason}
                  </p>
                ) : null}
                {selected.waiting_on ? (
                  <p className="muted">
                    <strong>Đang chờ:</strong> {selected.waiting_on}
                  </p>
                ) : null}

                {['in_progress', 'open', 'waiting', 'blocked'].includes(selected.status) && canClose ? (
                  <input
                    className="input input-sm"
                    placeholder="Lý do (Chờ / Bị chặn)"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                  />
                ) : null}
                {selected.queue_code === 'ops_action' && canClose ? (
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Ghi chú khi hoàn thành (tối thiểu 10 ký tự)"
                    value={doneComment}
                    onChange={(e) => setDoneComment(e.target.value)}
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                  />
                ) : null}

                <div className="work-detail-actions">
                  {canAssign && !selected.assignee_staff_id && selected.status === 'open' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => void runAction(() => postWorkAssign(token, selected.id), 'Đã nhận việc.')}
                    >
                      Nhận việc
                    </button>
                  ) : null}
                  {canAssign && selected.status === 'open' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() =>
                        void runAction(
                          () => postWorkTransition(token, selected.id, 'in_progress'),
                          'Đã bắt đầu.',
                        )
                      }
                    >
                      Bắt đầu
                    </button>
                  ) : null}
                  {canClose && ['waiting', 'blocked'].includes(selected.status) ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() =>
                        void runAction(
                          () => postWorkTransition(token, selected.id, 'in_progress'),
                          'Đã tiếp tục.',
                        )
                      }
                    >
                      Tiếp tục
                    </button>
                  ) : null}
                  {canClose && ['in_progress', 'open'].includes(selected.status) ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() =>
                        void runAction(
                          () =>
                            postWorkTransition(token, selected.id, 'waiting', {
                              reason: actionReason.trim() || undefined,
                            }),
                          'Đã chuyển sang Chờ.',
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
                        void runAction(
                          () =>
                            postWorkTransition(token, selected.id, 'blocked', {
                              reason: actionReason.trim() || undefined,
                            }),
                          'Đã đánh dấu bị chặn.',
                        )
                      }
                    >
                      Bị chặn
                    </button>
                  ) : null}
                  {canClose && selected.status === 'in_progress' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() =>
                        void runAction(
                          () =>
                            postWorkTransition(token, selected.id, 'done', {
                              comment: doneComment.trim() || undefined,
                            }),
                          'Đã hoàn thành.',
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

          <aside className="work-panel">
            <p className="work-panel__title">Nhật ký</p>
            {!selected ? (
              <p className="muted">Chọn ticket để xem comment và sự kiện.</p>
            ) : (
              <>
                {comments.length > 0 ? (
                  <>
                    <h4 style={{ fontSize: '0.85rem', margin: '0 0 0.35rem' }}>Comment</h4>
                    <ul className="work-timeline">
                      {comments.map((c) => (
                        <li key={c.id}>
                          <strong>#{c.author_staff_id}</strong> ·{' '}
                          {new Date(c.created_at).toLocaleString('vi-VN')}
                          <div>{c.body}</div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="muted" style={{ fontSize: '0.85rem' }}>
                    Chưa có comment.
                  </p>
                )}
                <h4 style={{ fontSize: '0.85rem', margin: '0.75rem 0 0.35rem' }}>Sự kiện</h4>
                {events.length === 0 ? (
                  <p className="muted" style={{ fontSize: '0.85rem' }}>
                    Chưa có sự kiện.
                  </p>
                ) : (
                  <ul className="work-timeline">
                    {events.map((e) => (
                      <li key={e.id}>
                        <strong>{EVENT_LABEL[e.kind] ?? e.kind}</strong>
                        {e.actor_staff_id != null ? ` · #${e.actor_staff_id}` : ''} ·{' '}
                        {new Date(e.created_at).toLocaleString('vi-VN')}
                        {e.kind === 'transition' && e.payload.to != null ? (
                          <div className="muted">→ {String(e.payload.to)}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </aside>
        </div>
      </HubPageLayout>
    </StaffPageShell>
  );
}

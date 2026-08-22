'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  fetchWorkTickets,
  postWorkAssign,
  postWorkTransition,
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
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [inbox, setInbox] = useState('mine');
  const [tickets, setTickets] = useState<WorkTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);

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
    if (!token || disabled) {
      setTickets([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchWorkTickets(token, inbox);
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
  }, [token, inbox, disabled]);

  const selected = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? null,
    [tickets, selectedId],
  );

  const canAssign = hasCap(user, 'staff_tickets', 'assign');
  const canClose = hasCap(user, 'staff_tickets', 'close');

  async function runAction(fn: () => Promise<unknown>) {
    setToast('');
    try {
      await fn();
      const next = await fetchWorkTickets(token, inbox);
      setTickets(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thao tác thất bại';
      setToast(msg === 'artifact' || msg === 'system_only' ? `Không thể đóng: ${msg}` : msg);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

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
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
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
        </div>
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
                    <small>{t.queue_code} · SLA: {slaLabel(t)}</small>
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
                <p>{selected.hidden ? 'Hồ sơ ẩn' : selected.body || '—'}</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {canAssign && !selected.assignee_staff_id && selected.status === 'open' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() =>
                        void runAction(() => postWorkAssign(token, selected.id))
                      }
                    >
                      Claim
                    </button>
                  ) : null}
                  {canAssign && selected.status === 'open' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() =>
                        void runAction(() =>
                          postWorkTransition(token, selected.id, 'in_progress'),
                        )
                      }
                    >
                      Bắt đầu
                    </button>
                  ) : null}
                  {canClose && selected.status === 'in_progress' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() =>
                        void runAction(() => postWorkTransition(token, selected.id, 'done'))
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

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
  fetchChatMessages,
  fetchChatRooms,
  postChatMessage,
  type ChatMessage,
  type ChatRoom,
} from '@/lib/staff-chat/api';
import { isStaffChatFeEnabled } from '@/lib/staff-chat/flags';

const KIND_LABEL: Record<ChatRoom['kind'], string> = {
  dept: 'Phòng tôi',
  cross: 'Liên phòng',
  huddle: 'Huddle',
  dm: 'DM',
};

function groupRooms(rooms: ChatRoom[]): Array<{ kind: ChatRoom['kind']; items: ChatRoom[] }> {
  const order: ChatRoom['kind'][] = ['dept', 'cross', 'huddle', 'dm'];
  return order
    .map((kind) => ({ kind, items: rooms.filter((r) => r.kind === kind) }))
    .filter((g) => g.items.length > 0);
}

export default function StaffChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
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
    if (!isStaffChatFeEnabled()) {
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
      try {
        setRooms(await fetchChatRooms(access));
      } catch (err) {
        if (err instanceof Error && err.message.includes('404')) {
          setDisabled(true);
        } else {
          setError(err instanceof Error ? err.message : 'Tải phòng thất bại');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth]);

  const selected = rooms.find((r) => r.id === selectedId) ?? null;
  const canPost = hasCap(user, 'staff_chat', 'post') && selected?.status === 'active';

  useEffect(() => {
    if (!token || !selected || selected.status !== 'active') {
      setMessages([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchChatMessages(token, selected.id);
        if (!cancelled) setMessages(next.slice().reverse());
      } catch (err) {
        if (!cancelled && err instanceof Error && err.message.includes('404')) {
          setDisabled(true);
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
  }, [token, selected]);

  const groups = useMemo(() => groupRooms(rooms), [rooms]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const send = async () => {
    if (!token || !selected || !draft.trim()) return;
    try {
      await postChatMessage(token, selected.id, draft.trim());
      setDraft('');
      const next = await fetchChatMessages(token, selected.id);
      setMessages(next.slice().reverse());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi thất bại');
    }
  };

  if (disabled) {
    return (
      <StaffPageShell user={user} onLogout={logout} loading={false}>
        <HubPageLayout title="Chat" subtitle="Nội bộ">
          <p className="muted">Chat nội bộ chưa bật</p>
        </HubPageLayout>
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title="Chat" subtitle="Phòng tôi · Liên phòng · Huddle">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(180px, 1fr) minmax(240px, 2fr) minmax(200px, 1fr)',
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          <aside>
            {groups.length === 0 && !loading ? <p className="muted">Chưa có phòng.</p> : null}
            {groups.map((g) => (
              <div key={g.kind} style={{ marginBottom: '1rem' }}>
                <h4>{KIND_LABEL[g.kind]}</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {g.items.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          marginBottom: '0.25rem',
                          fontWeight: selectedId === r.id ? 700 : 400,
                        }}
                        onClick={() => setSelectedId(r.id)}
                      >
                        {r.name}
                        {r.status === 'archived' ? ' · lưu trữ' : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>
          <section>
            {selected ? (
              <>
                <h3>{selected.name}</h3>
                {selected.sensitivity === 'restricted' ? (
                  <p className="muted">Không chuyển tiếp</p>
                ) : null}
                <ul style={{ listStyle: 'none', padding: 0, minHeight: '12rem' }}>
                  {messages.map((m) => (
                    <li key={m.id} style={{ marginBottom: '0.5rem' }}>
                      {m.hidden ? <em>Hồ sơ ẩn</em> : m.body}
                    </li>
                  ))}
                  {messages.length === 0 ? <li className="muted">Chưa có tin.</li> : null}
                </ul>
              </>
            ) : (
              <p className="muted">Chọn một phòng.</p>
            )}
          </section>
          <aside>
            {selected && canPost ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <textarea
                  className="input"
                  rows={4}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Nhắn…"
                  style={{ width: '100%' }}
                />
                <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>
                  Gửi
                </button>
              </form>
            ) : selected ? (
              <p className="muted">Chỉ xem.</p>
            ) : null}
          </aside>
        </div>
      </HubPageLayout>
    </StaffPageShell>
  );
}

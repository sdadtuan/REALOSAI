'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HubPageLayout, StaffPageShell } from '@/components/layout';
import {
  fetchB2bConversation,
  postB2bConversationMessage,
  type B2bConversationThread,
} from '@/lib/b2b-conversation-api';
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

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function B2bConversationThreadPage({ params }: { params: { leadId: string } }) {
  const leadId = Number(params.leadId);
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [thread, setThread] = useState<B2bConversationThread | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

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
      if (!hasCap(me, 'crm_leads', 'view')) {
        setError('Không có quyền xem hội thoại');
        return null;
      }
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

  const load = useCallback(async () => {
    if (!Number.isFinite(leadId) || leadId <= 0) {
      setError('Lead không hợp lệ');
      setLoading(false);
      return;
    }
    const access = await ensureAuth();
    if (!access) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchB2bConversation(access, leadId);
      setThread(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải hội thoại thất bại');
    } finally {
      setLoading(false);
    }
  }, [ensureAuth, leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const access = getAccessToken();
    if (!access) return;
    setSending(true);
    setError('');
    try {
      const data = await postB2bConversationMessage(access, leadId, text);
      setThread(data);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi tin thất bại');
    } finally {
      setSending(false);
    }
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={() => {
        clearSession();
        router.replace('/login');
      }}
      breadcrumb={[
        { label: 'CRM', href: '/crm' },
        { label: 'Inbox B2B', href: '/crm/b2b-inbox' },
        { label: `Lead #${leadId}`, href: `/crm/leads/${leadId}` },
        { label: 'Zalo thread', href: `/crm/b2b-inbox/thread/${leadId}` },
      ]}
      loading={!user && !error}
    >
      <HubPageLayout
        title={`Hội thoại Zalo — Lead #${leadId}`}
        subtitle="Tin nhắn hai chiều OA (visibility C)"
      >
        <div className="b2b-thread-actions">
          <Link href={`/crm/leads/${leadId}`} className="btn btn-sm btn-secondary">
            Mở lead
          </Link>
          <Link href="/crm/b2b-inbox" className="btn btn-sm btn-ghost">
            ← Inbox
          </Link>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {loading ? <p className="muted">Đang tải…</p> : null}

        {!loading && thread && !thread.thread_id ? (
          <p className="muted" data-testid="b2b-thread-empty">
            Chưa có thread Zalo cho lead này.
          </p>
        ) : null}

        {thread?.messages?.length ? (
          <ul className="b2b-thread-messages" data-testid="b2b-thread-messages">
            {thread.messages.map((msg) => (
              <li
                key={msg.id}
                className={`b2b-thread-msg b2b-thread-msg--${msg.direction}`}
              >
                <div className="b2b-thread-msg__meta">
                  <span>{msg.direction === 'inbound' ? 'KH' : 'OA/NV'}</span>
                  <time className="muted">{formatWhen(msg.created_at)}</time>
                </div>
                <p className="b2b-thread-msg__body">{msg.body}</p>
              </li>
            ))}
          </ul>
        ) : null}

        <form className="b2b-thread-compose" onSubmit={(e) => void handleSend(e)}>
          <textarea
            className="input"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nhập tin trả lời OA…"
            data-testid="b2b-thread-compose"
          />
          <button type="submit" className="btn btn-primary" disabled={sending || !draft.trim()}>
            {sending ? 'Đang gửi…' : 'Gửi'}
          </button>
        </form>
      </HubPageLayout>
    </StaffPageShell>
  );
}

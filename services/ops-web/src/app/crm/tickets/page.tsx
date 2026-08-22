'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import {
  addCrmTicketMessage,
  createCrmTicket,
  fetchCrmStaffList,
  fetchCrmTicket,
  fetchCrmTicketMessages,
  fetchCrmTickets,
  fetchCustomers,
  patchCrmTicket,
  staffMe,
  staffRefresh,
  type CrmTicketMessageRow,
  type CrmTicketRow,
} from '@/lib/api';
import { postTicketSentiment, type TicketSentimentScoreResponse } from '@/lib/ai-api';
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

const TICKET_TYPES = [
  { value: 'phan_nan', label: 'Phàn nàn' },
  { value: 'phan_anh', label: 'Phản ánh' },
  { value: 'khieu_nai', label: 'Khiếu nại' },
  { value: 'ho_tro_ky_thuat', label: 'Hỗ trợ kỹ thuật' },
  { value: 'yeu_cau_dich_vu', label: 'Yêu cầu dịch vụ' },
  { value: 'khac', label: 'Khác' },
];

const TICKET_STATUSES = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'moi', label: 'Mới' },
  { value: 'dang_xu_ly', label: 'Đang xử lý' },
  { value: 'cho_khach', label: 'Chờ phản hồi KH' },
  { value: 'da_xu_ly', label: 'Đã xử lý' },
  { value: 'dong', label: 'Đóng' },
];

const TICKET_PRIORITIES = [
  { value: 'thap', label: 'Thấp' },
  { value: 'binh_thuong', label: 'Bình thường' },
  { value: 'cao', label: 'Cao' },
  { value: 'khan_cap', label: 'Khẩn cấp' },
];

const TICKET_CHANNELS = [
  { value: 'dien_thoai', label: 'Điện thoại' },
  { value: 'email', label: 'Email' },
  { value: 'zalo', label: 'Zalo' },
  { value: 'truc_tiep', label: 'Trực tiếp' },
  { value: 'khac', label: 'Khác' },
];

const TICKET_SENTIMENTS = [
  { value: '', label: 'Tất cả sentiment' },
  { value: 'negative', label: 'Tiêu cực' },
  { value: 'neutral', label: 'Trung lập' },
  { value: 'positive', label: 'Tích cực' },
  { value: 'unscored', label: 'Chưa chấm' },
];

function sentimentLabel(label: string | null | undefined): string {
  if (!label) return '—';
  if (label === 'negative') return 'Tiêu cực';
  if (label === 'positive') return 'Tích cực';
  return 'Trung lập';
}

function SentimentChip({ label }: { label: string | null | undefined }) {
  if (!label) {
    return <span className="crm-tickets-sentiment crm-tickets-sentiment--none">Chưa chấm</span>;
  }
  return (
    <span className={`crm-tickets-sentiment crm-tickets-sentiment--${label}`}>
      {sentimentLabel(label)}
    </span>
  );
}

export default function CrmTicketsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<CrmTicketRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CrmTicketRow | null>(null);
  const [messages, setMessages] = useState<CrmTicketMessageRow[]>([]);
  const [sentimentDetail, setSentimentDetail] = useState<TicketSentimentScoreResponse['data'] | null>(
    null,
  );
  const [messageDraft, setMessageDraft] = useState('');
  const [customers, setCustomers] = useState<Array<{ id: number; name: string }>>([]);
  const [staffOptions, setStaffOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    customer_id: '',
    ticket_type: 'phan_anh',
    priority: 'binh_thuong',
    channel: 'khac',
    title: '',
    description: '',
    assigned_staff_id: '',
  });

  const canEdit = hasCap(user, 'crm_board', 'edit');

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
      if (!hasCap(me, 'crm_board', 'view')) {
        setError('Không có quyền xem ticket CS');
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

  const reload = useCallback(
    async (access: string) => {
      const data = await fetchCrmTickets(access, {
        q: query || undefined,
        status: statusFilter || undefined,
        sentiment: sentimentFilter || undefined,
        limit: 100,
      });
      setRows(data.tickets);
      setTotal(data.total);
    },
    [query, statusFilter, sentimentFilter],
  );

  const loadDetail = useCallback(async (access: string, ticketId: number) => {
    const [ticket, msgOut] = await Promise.all([
      fetchCrmTicket(access, ticketId),
      fetchCrmTicketMessages(access, ticketId),
    ]);
    setDetail(ticket);
    setMessages(msgOut.messages);
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        const [cust, staff] = await Promise.all([
          fetchCustomers(access, { limit: 200 }),
          fetchCrmStaffList(access),
        ]);
        setCustomers(cust.map((c) => ({ id: c.id, name: c.name ?? `#${c.id}` })));
        setStaffOptions(
          (staff.staff ?? []).map((s) => ({ id: s.id, name: s.name ?? `#${s.id}` })),
        );
        await reload(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải tickets thất bại');
      }
    })();
  }, [ensureAuth, reload]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !canEdit) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const created = await createCrmTicket(access, {
        customer_id: Number(form.customer_id),
        ticket_type: form.ticket_type,
        priority: form.priority,
        channel: form.channel,
        title: form.title,
        description: form.description,
        assigned_staff_id: form.assigned_staff_id ? Number(form.assigned_staff_id) : null,
      });
      try {
        await postTicketSentiment(access, { ticket_id: created.id });
      } catch {
        /* sentiment optional on create */
      }
      setForm({
        customer_id: '',
        ticket_type: 'phan_anh',
        priority: 'binh_thuong',
        channel: 'khac',
        title: '',
        description: '',
        assigned_staff_id: '',
      });
      await reload(access);
      setMsg('Đã tạo ticket');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo ticket thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(row: CrmTicketRow) {
    const access = getAccessToken();
    if (!access) return;
    setSelectedId(row.id);
    setError('');
    setMessageDraft('');
    try {
      await loadDetail(access, row.id);
      try {
        const out = await postTicketSentiment(access, { ticket_id: row.id });
        setSentimentDetail(out.data);
      } catch {
        setSentimentDetail(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải chi tiết ticket thất bại');
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setMessages([]);
    setSentimentDetail(null);
    setMessageDraft('');
  }

  async function rescoreTicket(force = true) {
    const access = getAccessToken();
    if (!access || !detail) return;
    setBusy(true);
    setError('');
    try {
      const out = await postTicketSentiment(access, { ticket_id: detail.id, force });
      setSentimentDetail(out.data);
      await loadDetail(access, detail.id);
      await reload(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chấm sentiment thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function submitMessage(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !detail || !messageDraft.trim()) return;
    setBusy(true);
    setError('');
    try {
      await addCrmTicketMessage(access, detail.id, { body: messageDraft.trim() });
      setMessageDraft('');
      const out = await postTicketSentiment(access, { ticket_id: detail.id, force: true });
      setSentimentDetail(out.data);
      await loadDetail(access, detail.id);
      await reload(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi tin nhắn thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(row: CrmTicketRow, status: string) {
    const access = getAccessToken();
    if (!access || !canEdit) return;
    setBusy(true);
    setError('');
    try {
      await patchCrmTicket(access, row.id, { status });
      await reload(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật ticket thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={() => { clearSession(); router.push('/login'); }} loading>
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={() => {
        clearSession();
        router.push('/login');
      }}
      breadcrumb={[
        { label: 'CRM', href: '/crm' },
        { label: 'CSKH', href: '/crm/tickets' },
        { label: 'Tickets' },
      ]}
    >
      <PageToolbar
        title="Ticket CS lite"
        subtitle={`Quản lý phản ánh / hỗ trợ khách hàng · ${total} ticket`}
      />

      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="muted">{msg}</p> : null}

        <div className="kpi-page__filters">
          <input
            className="kpi-input"
            placeholder="Tìm title / KH / mô tả"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="kpi-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {TICKET_STATUSES.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className="kpi-select"
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
          >
            {TICKET_SENTIMENTS.map((item) => (
              <option key={item.value || 'all-sentiment'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setQuery(q)}>
            Lọc
          </button>
        </div>

        {canEdit ? (
          <form onSubmit={(e) => void handleCreate(e)} className="admin-crm-form">
            <h3 className="kpi-section-title">Tạo ticket mới</h3>
            <div className="admin-crm-form__grid">
              <select
                className="kpi-select"
                value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                required
              >
                <option value="">Chọn khách hàng</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="kpi-select"
                value={form.ticket_type}
                onChange={(e) => setForm({ ...form, ticket_type: e.target.value })}
              >
                {TICKET_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                className="kpi-select"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {TICKET_PRIORITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                className="kpi-select"
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
              >
                {TICKET_CHANNELS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                className="kpi-input"
                placeholder="Tiêu đề ticket"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <select
                className="kpi-select"
                value={form.assigned_staff_id}
                onChange={(e) => setForm({ ...form, assigned_staff_id: e.target.value })}
              >
                <option value="">Chưa gán</option>
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="kpi-input"
              placeholder="Mô tả"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              style={{ width: '100%', marginBottom: '0.75rem' }}
            />
            <button type="submit" className="btn btn-sm" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Tạo ticket'}
            </button>
          </form>
        ) : (
          <p className="muted">Chế độ chỉ xem — cần quyền crm_board edit để tạo/sửa.</p>
        )}

        <div className="crm-leads-table-wrap" style={{ marginTop: '1.25rem' }}>
          <table className="perf-table crm-tickets-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>KH</th>
                <th>Tiêu đề</th>
                <th>Loại</th>
                <th>Ưu tiên</th>
                <th>Trạng thái</th>
                <th>Sentiment</th>
                <th>Owner</th>
                <th>Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    Chưa có ticket
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={selectedId === row.id ? 'crm-tickets-table__row--active' : undefined}
                    onClick={() => void openDetail(row)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{row.id}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Link href={`/crm/customers/${row.customer_id}`}>{row.customer_name}</Link>
                    </td>
                    <td>{row.title}</td>
                    <td>{row.ticket_type_label}</td>
                    <td>{row.priority_label}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {canEdit ? (
                        <select
                          className="kpi-select crm-tickets-table__status"
                          value={row.status}
                          disabled={busy}
                          onChange={(e) => void updateStatus(row, e.target.value)}
                        >
                          {TICKET_STATUSES.filter((item) => item.value).map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        row.status_label
                      )}
                    </td>
                    <td>
                      <SentimentChip label={row.sentiment_label} />
                    </td>
                    <td>{row.assigned_staff_name}</td>
                    <td className="muted">{row.updated_at || row.created_at}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {detail ? (
          <div className="crm-tickets-drawer card">
            <div className="crm-tickets-drawer__head">
              <div>
                <h3 className="kpi-section-title" style={{ margin: 0 }}>
                  Ticket #{detail.id} — {detail.title}
                </h3>
                <p className="muted" style={{ margin: '0.35rem 0 0' }}>
                  {detail.customer_name} · {detail.ticket_type_label} · {detail.status_label}
                </p>
              </div>
              <button type="button" className="btn btn-sm btn-secondary" onClick={closeDetail}>
                Đóng
              </button>
            </div>

            <div className="crm-tickets-drawer__meta">
              <SentimentChip label={detail.sentiment_label} />
              {detail.sentiment_score != null ? (
                <span className="muted">
                  Score {detail.sentiment_score.toFixed(2)}
                  {detail.sentiment_confidence != null
                    ? ` · conf ${(detail.sentiment_confidence * 100).toFixed(0)}%`
                    : ''}
                </span>
              ) : null}
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy}
                onClick={() => void rescoreTicket(true)}
              >
                Chấm lại sentiment
              </button>
              {detail.agency_client_id ? (
                <Link
                  href={`/agency/clients/${detail.agency_client_id}?tab=health`}
                  className="btn btn-sm btn-secondary"
                >
                  Xem health KH
                </Link>
              ) : (
                <Link href="/crm/health" className="btn btn-sm btn-secondary">
                  Dashboard health
                </Link>
              )}
            </div>

            {sentimentDetail && sentimentDetail.factors.length > 0 ? (
              <div className="crm-tickets-drawer__factors">
                <h4 className="kpi-section-title">Yếu tố sentiment</h4>
                <ul className="crm-tickets-factor-list">
                  {sentimentDetail.factors.map((f) => (
                    <li key={f.key}>
                      {f.sign}
                      {Math.abs(f.delta).toFixed(2)} — {f.label}
                    </li>
                  ))}
                </ul>
                {sentimentDetail.flags.length > 0 ? (
                  <p className="muted">Flags: {sentimentDetail.flags.join(', ')}</p>
                ) : null}
              </div>
            ) : null}

            <div className="crm-tickets-drawer__messages">
              <h4 className="kpi-section-title">Luồng tin nhắn</h4>
              {messages.length === 0 ? (
                <p className="muted">Chưa có tin nhắn</p>
              ) : (
                <ul className="crm-tickets-message-list">
                  {messages.map((m) => (
                    <li key={m.id} className="crm-tickets-message">
                      <div className="crm-tickets-message__meta muted">
                        {m.author_staff_name || 'Hệ thống'} · {m.created_at}
                        {m.is_internal ? ' · nội bộ' : ''}
                      </div>
                      <div>{m.body}</div>
                    </li>
                  ))}
                </ul>
              )}
              {canEdit ? (
                <form onSubmit={(e) => void submitMessage(e)} className="crm-tickets-message-form">
                  <textarea
                    className="kpi-input"
                    rows={2}
                    placeholder="Thêm ghi chú / phản hồi"
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                  />
                  <button type="submit" className="btn btn-sm" disabled={busy || !messageDraft.trim()}>
                    Gửi & chấm lại
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </StaffPageShell>
  );
}

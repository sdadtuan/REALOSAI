'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { ReviewQueueMetricsBanner } from '@/components/crm/ReviewQueueMetricsBanner';
import {
  fetchCrmStaffList,
  fetchReviewQueueAiSummaries,
  fetchReviewQueueLeads,
  releaseLeadReviewQueue,
  staffMe,
  staffRefresh,
  type CrmStaffRow,
  type ReviewQueueAiSummary,
} from '@/lib/api';
import { canUseAiCopilot } from '@/lib/ai-flags';
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

type ReviewRow = {
  id: number;
  full_name: string;
  phone: string;
  status?: string;
  review_queue: {
    message?: string;
    hours_waiting?: number | null;
    deadline_hours?: number;
  };
};

export default function CrmReviewQueuePage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [aiSummaries, setAiSummaries] = useState<Record<number, ReviewQueueAiSummary>>({});
  const [staffList, setStaffList] = useState<CrmStaffRow[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [releaseLeadId, setReleaseLeadId] = useState<number | null>(null);
  const [releaseMode, setReleaseMode] = useState<'auto' | 'manual'>('auto');
  const [releaseOwnerId, setReleaseOwnerId] = useState('');
  const [releaseNote, setReleaseNote] = useState('GDKD release ops-web');
  const [releasing, setReleasing] = useState(false);

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
      if (!hasCap(me, 'crm_leads', 'assign')) {
        setError('Chỉ GDKD / Sales Lead (cap assign) mới xem inbox Phải tra soát');
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

  const reload = useCallback(async (access: string, staffUser: StoredStaffUser | null) => {
    const useLlm = canUseAiCopilot(staffUser?.id, staffUser?.caps);
    const [queueOut, staffOut, aiOut] = await Promise.all([
      fetchReviewQueueLeads(access),
      fetchCrmStaffList(access),
      fetchReviewQueueAiSummaries(access, 50, useLlm ? 'llm' : 'rules').catch(() => ({
        summaries: [] as ReviewQueueAiSummary[],
        ok: false,
        total: 0,
      })),
    ]);
    setRows(queueOut.leads ?? []);
    setStaffList(staffOut.staff ?? []);
    const map: Record<number, ReviewQueueAiSummary> = {};
    for (const s of aiOut.summaries ?? []) {
      map[s.lead_id] = s;
    }
    setAiSummaries(map);
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) {
        setLoading(false);
        return;
      }
      try {
        await reload(access, getStoredUser());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải inbox thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, reload]);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  function openReleaseModal(leadId: number) {
    setReleaseLeadId(leadId);
    setReleaseMode('auto');
    setReleaseOwnerId('');
    setReleaseNote('GDKD release ops-web');
    setError('');
  }

  function closeReleaseModal() {
    setReleaseLeadId(null);
  }

  async function submitRelease() {
    const access = getAccessToken();
    if (!access || releaseLeadId == null) return;
    setReleasing(true);
    setError('');
    setMessage('');
    try {
      const body: { mode: 'auto' | 'manual'; owner_id?: number; note?: string } = {
        mode: releaseMode,
        note: releaseNote.trim() || undefined,
      };
      if (releaseMode === 'manual') {
        const ownerId = Number(releaseOwnerId);
        if (!Number.isFinite(ownerId) || ownerId <= 0) {
          setError('Chọn AM để gán lại (manual).');
          return;
        }
        body.owner_id = ownerId;
      }
      await releaseLeadReviewQueue(access, releaseLeadId, body);
      setMessage(`Đã release lead #${releaseLeadId}`);
      closeReleaseModal();
      await reload(access, user ?? getStoredUser());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Release thất bại');
    } finally {
      setReleasing(false);
    }
  }

  const accessToken = getAccessToken();

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      loading={!user && loading}
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Leads', href: '/crm/leads' },
        { label: 'Inbox Phải tra soát' },
      ]}
    >
      <PageToolbar
        title="Inbox Phải tra soát"
        subtitle="Lead quá hạn 24h chưa Liên hệ OK — FR-CRM-04"
        actions={
          <Link href="/crm/leads?tab=review" className="btn btn-sm btn-ghost">
            Xem tab trên danh sách →
          </Link>
        }
      />

      <div className="page-card stack-gap">
        {accessToken ? <ReviewQueueMetricsBanner token={accessToken} /> : null}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}
        {loading ? (
          <p className="muted">Đang tải…</p>
        ) : rows.length === 0 ? (
          <p className="muted">Không có lead trong review queue.</p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Điện thoại</th>
                  <th>Trạng thái</th>
                  <th>Chờ (h)</th>
                  <th>Ưu tiên</th>
                  <th>Lý do</th>
                  <th>AI summary</th>
                  <th>Gợi ý owner</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/crm/leads/${row.id}`}>{row.full_name || `#${row.id}`}</Link>
                    </td>
                    <td>{row.phone || '—'}</td>
                    <td>{row.status || '—'}</td>
                    <td>
                      {row.review_queue.hours_waiting != null
                        ? `${row.review_queue.hours_waiting}h`
                        : '—'}
                    </td>
                    <td>
                      {aiSummaries[row.id]?.priority_score ? (
                        <span
                          className={`review-queue-priority review-queue-priority--p${aiSummaries[row.id]?.priority_score}`}
                          title={aiSummaries[row.id]?.workload_note || aiSummaries[row.id]?.triage_source}
                        >
                          P{aiSummaries[row.id]?.priority_score}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td style={{ maxWidth: 320 }}>{row.review_queue.message || '—'}</td>
                    <td style={{ maxWidth: 280 }} className="muted">
                      {aiSummaries[row.id]?.summary_line ?? '—'}
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      {aiSummaries[row.id]?.suggested_owner_name ? (
                        <span
                          className="review-queue-suggested-owner"
                          title={aiSummaries[row.id]?.suggest_reason}
                        >
                          {aiSummaries[row.id]?.suggested_owner_name}
                          {aiSummaries[row.id]?.workload_note ? (
                            <span className="muted review-queue-workload-note">
                              {' '}
                              · {aiSummaries[row.id]?.workload_note}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="btn btn-sm" onClick={() => openReleaseModal(row.id)}>
                        Release…
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {releaseLeadId != null ? (
        <div
          className="email-modal-backdrop"
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50 }}
        >
          <div className="card stack-gap" style={{ maxWidth: 420, margin: '2rem auto', padding: '1.25rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Release lead #{releaseLeadId}</h2>
            <label>
              Chế độ
              <select
                className="kpi-select"
                value={releaseMode}
                onChange={(e) => setReleaseMode(e.target.value as 'auto' | 'manual')}
                style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
              >
                <option value="auto">Auto — gán lại AM trước đó</option>
                <option value="manual">Manual — chọn AM</option>
              </select>
            </label>
            {releaseMode === 'manual' ? (
              <label>
                AM mới
                <select
                  className="kpi-select"
                  value={releaseOwnerId}
                  onChange={(e) => setReleaseOwnerId(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
                >
                  <option value="">— Chọn AM —</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name || s.internal_code || `#${s.id}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              Ghi chú
              <input
                type="text"
                className="kpi-input"
                value={releaseNote}
                onChange={(e) => setReleaseNote(e.target.value)}
                style={{ width: '100%', marginTop: '0.25rem' }}
              />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-sm" disabled={releasing} onClick={closeReleaseModal}>
                Huỷ
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={releasing}
                onClick={() => void submitRelease()}
              >
                Release
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </StaffPageShell>
  );
}

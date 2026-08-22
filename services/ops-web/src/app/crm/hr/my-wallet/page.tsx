'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmHrPageShell } from '@/components/crm/CrmHrPageShell';
import { WalletCard } from '@/components/hr/WalletCard';
import {
  fetchHrMyWallet,
  fetchHrMyWalletSubmitTypes,
  openHrMyWalletFile,
  submitHrMyWalletCard,
  uploadHrMyWalletFile,
  type HrDocTypeDto,
  type HrDocWalletCardDto,
} from '@/lib/hr-employee-file-api';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

const SELF_CATEGORIES = new Set(['education', 'cert', 'license', 'medical', 'family', 'other']);

function MyWalletPanel({ token }: { token: string }) {
  const [cards, setCards] = useState<HrDocWalletCardDto[]>([]);
  const [types, setTypes] = useState<HrDocTypeDto[]>([]);
  const [walletPct, setWalletPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ type_code: 'cert_other', title: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [uploadCardId, setUploadCardId] = useState<number | null>(null);

  const selfTypes = useMemo(
    () => types.filter((t) => SELF_CATEGORIES.has(String(t.category))),
    [types],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [typeOut, walletOut] = await Promise.all([
        fetchHrMyWalletSubmitTypes(token),
        fetchHrMyWallet(token),
      ]);
      setTypes(typeOut.types);
      setCards(walletOut.cards);
      setWalletPct(walletOut.wallet_pct);
      if (!draft.type_code && selfTypes[0]) {
        setDraft((d) => ({ ...d, type_code: selfTypes[0].type_code }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải ví');
    } finally {
      setLoading(false);
    }
  }, [draft.type_code, selfTypes, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const card = await submitHrMyWalletCard(token, draft);
      setCards((prev) => [card, ...prev]);
      setUploadCardId(card.id);
      setDraft({ type_code: selfTypes[0]?.type_code ?? 'cert_other', title: '', notes: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nộp thẻ thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpload(cardId: number, file: File) {
    setError('');
    try {
      await uploadHrMyWalletFile(token, cardId, file);
      await load();
      setUploadCardId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload thất bại');
    }
  }

  if (loading) return <p className="muted">Đang tải ví giấy tờ…</p>;

  return (
    <div className="stack-gap">
      {error ? <p className="error">{error}</p> : null}
      <p className="muted">Ví % (giấy bắt buộc onboard): {walletPct}% — thẻ nộp sẽ ở trạng thái «Chờ HR duyệt».</p>

      <section className="page-card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Thẻ của tôi</h2>
        {cards.length === 0 ? (
          <p className="muted">Chưa có thẻ nào.</p>
        ) : (
          <div className="wallet-card-grid">
            {cards.map((card) => (
              <div key={card.id} className="stack-gap" style={{ gap: '0.35rem' }}>
                <WalletCard card={card} />
                {card.status === 'pending_review' && card.file_count === 0 ? (
                  <label className="btn btn-sm btn-secondary" style={{ cursor: 'pointer', width: 'fit-content' }}>
                    Upload file
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUpload(card.id, f);
                      }}
                    />
                  </label>
                ) : null}
                {card.file_count > 0 && card.files?.[0]?.id ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() =>
                      void openHrMyWalletFile(token, card.id, card.files![0].id).catch((err) =>
                        setError(err instanceof Error ? err.message : 'Không mở file'),
                      )
                    }
                  >
                    Xem file
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="page-card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Nộp giấy tờ mới</h2>
        <form onSubmit={(e) => void handleSubmit(e)} className="form-grid form-grid--2">
          <label className="form-field">
            <span className="form-label">Loại giấy tờ</span>
            <select
              className="form-input"
              value={draft.type_code}
              onChange={(e) => setDraft((d) => ({ ...d, type_code: e.target.value }))}
            >
              {selfTypes.map((t) => (
                <option key={t.type_code} value={t.type_code}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">Tiêu đề</span>
            <input
              className="form-input"
              required
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </label>
          <label className="form-field" style={{ gridColumn: '1 / -1' }}>
            <span className="form-label">Ghi chú</span>
            <input
              className="form-input"
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </label>
          <footer>
            <button type="submit" className="btn btn-sm btn-primary" disabled={submitting}>
              {submitting ? 'Đang gửi…' : 'Gửi chờ duyệt'}
            </button>
          </footer>
        </form>
        {uploadCardId ? (
          <p className="muted" style={{ marginTop: '0.65rem' }}>
            Thẻ #{uploadCardId} đã tạo — hãy upload file scan ở trên.
          </p>
        ) : null}
      </section>
    </div>
  );
}

export default function MyWalletPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    void (async () => {
      let access = getAccessToken();
      if (!access) {
        router.replace('/login');
        return;
      }
      try {
        const me = await staffMe(access);
        setUser(me);
        updateStoredUser(me);
        setToken(access);
      } catch {
        const refresh = getRefreshToken();
        if (!refresh) {
          clearSession();
          router.replace('/login');
          return;
        }
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        access = out.access_token;
        const me = await staffMe(access);
        setUser(me);
        updateStoredUser(me);
        setToken(access);
      }
    })();
  }, [router]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  return (
    <CrmHrPageShell
      user={user ?? getStoredUser()}
      onLogout={logout}
      title="Ví giấy tờ của tôi"
      subtitle="Nộp bằng cấp / chứng chỉ — HR duyệt trước khi vào hồ sơ chính thức"
    >
      {token ? <MyWalletPanel token={token} /> : <p className="muted">Đang xác thực…</p>}
    </CrmHrPageShell>
  );
}

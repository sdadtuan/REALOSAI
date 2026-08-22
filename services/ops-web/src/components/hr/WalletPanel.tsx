'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WinDrawer } from '@/components/win';
import { WalletCard } from '@/components/hr/WalletCard';
import {
  createHrWalletCard,
  fetchHrDocTypes,
  fetchHrStaffWallet,
  hrWalletFileUrl,
  patchHrWalletCard,
  uploadHrWalletFile,
  type HrDocTypeDto,
  type HrDocWalletCardDto,
} from '@/lib/hr-employee-file-api';

type Props = {
  staffId: number;
  token: string;
  canEdit: boolean;
  onWalletChange?: (walletPct: number, expiringCount: number) => void;
};

type FilterKey = 'all' | 'expiring' | 'education' | 'missing';

export function WalletPanel({ staffId, token, canEdit, onWalletChange }: Props) {
  const [cards, setCards] = useState<HrDocWalletCardDto[]>([]);
  const [types, setTypes] = useState<HrDocTypeDto[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'view'>('view');
  const [activeCard, setActiveCard] = useState<HrDocWalletCardDto | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [typeOut, walletOut] = await Promise.all([
        fetchHrDocTypes(token),
        fetchHrStaffWallet(token, staffId, {
          expiring_only: filter === 'expiring',
          education_only: filter === 'education',
          missing_files: filter === 'missing',
        }),
      ]);
      setTypes(typeOut.types);
      setCards(walletOut.cards);
      onWalletChange?.(walletOut.wallet_pct, walletOut.expiring_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải ví');
    } finally {
      setLoading(false);
    }
  }, [filter, onWalletChange, staffId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const typeOptions = useMemo(
    () => types.filter((t) => t.category !== 'other' || t.type_code === 'other'),
    [types],
  );

  function openCreate() {
    setDrawerMode('create');
    setActiveCard(null);
    setDraft({ type_code: typeOptions[0]?.type_code ?? 'other', title: '' });
    setDrawerOpen(true);
  }

  function openCard(card: HrDocWalletCardDto) {
    setDrawerMode('view');
    setActiveCard(card);
    setDraft({
      title: card.title ?? '',
      doc_no: card.doc_no ?? '',
      issuer: card.issuer ?? '',
      expires_on: card.expires_on ?? '',
      notes: card.notes ?? '',
      level: card.education?.level ?? '',
      major: card.education?.major ?? '',
      school: card.education?.school ?? '',
    });
    setDrawerOpen(true);
  }

  async function saveCard() {
    setSaving(true);
    setError('');
    try {
      if (drawerMode === 'create') {
        await createHrWalletCard(token, staffId, {
          type_code: draft.type_code,
          title: draft.title,
          doc_no: draft.doc_no,
          issuer: draft.issuer,
          expires_on: draft.expires_on || null,
          notes: draft.notes,
          education:
            types.find((t) => t.type_code === draft.type_code)?.category === 'education' ||
            types.find((t) => t.type_code === draft.type_code)?.category === 'cert'
              ? { level: draft.level, major: draft.major, school: draft.school }
              : undefined,
        });
      } else if (activeCard) {
        await patchHrWalletCard(token, staffId, activeCard.id, {
          title: draft.title,
          doc_no: draft.doc_no,
          issuer: draft.issuer,
          expires_on: draft.expires_on || null,
          notes: draft.notes,
          education:
            activeCard.type_category === 'education' || activeCard.type_category === 'cert'
              ? { level: draft.level, major: draft.major, school: draft.school }
              : undefined,
        });
      }
      setDrawerOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thẻ thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onUpload(file: File) {
    if (!activeCard) return;
    setUploading(true);
    try {
      await uploadHrWalletFile(token, staffId, activeCard.id, file);
      await load();
      const refreshed = (await fetchHrStaffWallet(token, staffId)).cards.find((c) => c.id === activeCard.id);
      if (refreshed) setActiveCard(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload thất bại');
    } finally {
      setUploading(false);
    }
  }

  async function removeCard() {
    if (!activeCard || !canEdit) return;
    setSaving(true);
    try {
      await patchHrWalletCard(token, staffId, activeCard.id, { deleted: true });
      setDrawerOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa thẻ thất bại');
    } finally {
      setSaving(false);
    }
  }

  const showEducationFields =
    drawerMode === 'create'
      ? ['education', 'cert'].includes(types.find((t) => t.type_code === draft.type_code)?.category ?? '')
      : activeCard?.type_category === 'education' || activeCard?.type_category === 'cert';

  return (
    <div className="stack-gap">
      <div className="wallet-toolbar">
        <div className="wallet-filters">
          {(
            [
              ['all', 'Tất cả'],
              ['expiring', 'Sắp hết hạn'],
              ['education', 'Bằng cấp'],
              ['missing', 'Thiếu file'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`employee-file-tabs__btn${filter === key ? ' employee-file-tabs__btn--active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {canEdit ? (
          <button type="button" className="btn btn-sm btn-primary" onClick={openCreate}>
            + Thẻ ví
          </button>
        ) : null}
      </div>
      {loading ? <p className="muted">Đang tải ví…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && cards.length === 0 ? (
        <div className="page-card">
          <p className="muted" style={{ margin: 0 }}>
            Chưa có giấy tờ trong ví.
          </p>
          {canEdit ? (
            <button type="button" className="btn btn-sm btn-secondary" style={{ marginTop: '0.65rem' }} onClick={openCreate}>
              Thêm giấy tờ đầu tiên
            </button>
          ) : null}
        </div>
      ) : (
        <div className="wallet-card-grid">
          {cards.map((card) => (
            <WalletCard key={card.id} card={card} onClick={() => openCard(card)} />
          ))}
        </div>
      )}

      <WinDrawer
        open={drawerOpen}
        title={drawerMode === 'create' ? 'Thêm thẻ ví' : 'Chi tiết thẻ'}
        onClose={() => setDrawerOpen(false)}
      >
        <div className="stack-gap">
          {drawerMode === 'create' ? (
            <label className="form-field">
              <span className="form-label">Loại giấy tờ</span>
              <select
                className="form-input"
                value={draft.type_code ?? ''}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, type_code: e.target.value }))}
              >
                {typeOptions.map((t) => (
                  <option key={t.type_code} value={t.type_code}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="form-field">
            <span className="form-label">Tiêu đề</span>
            <input
              className="form-input"
              value={draft.title ?? ''}
              disabled={!canEdit}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </label>
          <div className="form-grid form-grid--2">
            <label className="form-field">
              <span className="form-label">Số giấy / văn bằng</span>
              <input
                className="form-input"
                value={draft.doc_no ?? ''}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, doc_no: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Cơ quan cấp</span>
              <input
                className="form-input"
                value={draft.issuer ?? ''}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, issuer: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Hết hạn</span>
              <input
                type="date"
                className="form-input"
                value={draft.expires_on ?? ''}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, expires_on: e.target.value }))}
              />
            </label>
          </div>
          {showEducationFields ? (
            <div className="form-grid form-grid--2">
              <label className="form-field">
                <span className="form-label">Bậc</span>
                <input className="form-input" value={draft.level ?? ''} disabled={!canEdit} onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value }))} />
              </label>
              <label className="form-field">
                <span className="form-label">Chuyên ngành</span>
                <input className="form-input" value={draft.major ?? ''} disabled={!canEdit} onChange={(e) => setDraft((d) => ({ ...d, major: e.target.value }))} />
              </label>
              <label className="form-field">
                <span className="form-label">Trường</span>
                <input className="form-input" value={draft.school ?? ''} disabled={!canEdit} onChange={(e) => setDraft((d) => ({ ...d, school: e.target.value }))} />
              </label>
            </div>
          ) : null}
          {drawerMode === 'view' && activeCard ? (
            <section>
              <h4 style={{ margin: '0 0 0.5rem' }}>File đính kèm</h4>
              {activeCard.files?.length ? (
                <ul className="wallet-file-list">
                  {activeCard.files.map((f) => (
                    <li key={f.id}>
                      <a
                        href={hrWalletFileUrl(staffId, activeCard.id, f.id)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => {
                          e.preventDefault();
                          void fetch(hrWalletFileUrl(staffId, activeCard.id, f.id), {
                            headers: { Authorization: `Bearer ${token}` },
                          })
                            .then((r) => r.blob())
                            .then((blob) => {
                              const url = URL.createObjectURL(blob);
                              window.open(url, '_blank', 'noopener,noreferrer');
                            });
                        }}
                      >
                        {f.original_name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Chưa có file.</p>
              )}
              {canEdit ? (
                <label className="btn btn-sm btn-secondary" style={{ marginTop: '0.5rem', display: 'inline-block' }}>
                  {uploading ? 'Đang upload…' : 'Upload file (PDF/JPG)'}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                    hidden
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void onUpload(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              ) : null}
            </section>
          ) : null}
          {canEdit ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => void saveCard()}>
                {saving ? 'Đang lưu…' : drawerMode === 'create' ? 'Tạo thẻ' : 'Lưu thẻ'}
              </button>
              {drawerMode === 'view' ? (
                <button type="button" className="btn btn-sm btn-ghost" disabled={saving} onClick={() => void removeCard()}>
                  Xóa thẻ
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </WinDrawer>
    </div>
  );
}

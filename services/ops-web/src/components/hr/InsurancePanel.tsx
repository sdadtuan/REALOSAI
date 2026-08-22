'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WinDrawer } from '@/components/win';
import { HrExpiryChip } from '@/components/hr/HrExpiryChip';
import {
  createHrInsurancePeriod,
  fetchHrStaffInsurance,
  fetchHrStaffWallet,
  putHrStaffInsurance,
  type HrDocWalletCardDto,
  type HrInsurancePeriodDto,
  type HrInsuranceSummaryDto,
  type HrStaffInsuranceDto,
} from '@/lib/hr-employee-file-api';

type Props = {
  staffId: number;
  token: string;
  canEdit: boolean;
  canViewPii: boolean;
  canEditPii: boolean;
  onInsuranceChange?: (summary: HrInsuranceSummaryDto | null) => void;
};

const STATUS_OPTIONS = [
  ['active', 'Đang đóng'],
  ['paused', 'Tạm dừng'],
  ['closed', 'Chốt'],
] as const;

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find(([k]) => k === status)?.[1] ?? status;
}

function formatSalary(amount: number | null | undefined, masked?: boolean): string {
  if (masked || amount == null) return '••••••';
  return `${amount.toLocaleString('vi-VN')} VND`;
}

export function InsurancePanel({
  staffId,
  token,
  canEdit,
  canViewPii,
  canEditPii,
  onInsuranceChange,
}: Props) {
  const [register, setRegister] = useState<HrStaffInsuranceDto | null>(null);
  const [periods, setPeriods] = useState<HrInsurancePeriodDto[]>([]);
  const [walletCards, setWalletCards] = useState<HrDocWalletCardDto[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [periodDrawer, setPeriodDrawer] = useState(false);
  const [periodDraft, setPeriodDraft] = useState<Record<string, string>>({});

  const insuranceWalletCards = useMemo(
    () =>
      walletCards.filter(
        (c) => c.type_category === 'insurance' || ['bhxh_book', 'bhyt_card', 'bhtn'].includes(c.type_code),
      ),
    [walletCards],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [insOut, walletOut] = await Promise.all([
        fetchHrStaffInsurance(token, staffId),
        fetchHrStaffWallet(token, staffId, { category: 'insurance' }),
      ]);
      setRegister(insOut.register);
      setPeriods(insOut.periods);
      setWalletCards(walletOut.cards);
      onInsuranceChange?.(insOut.summary);
      setDraft({
        bhxh_book_no: insOut.register.bhxh_book_no ?? '',
        bhxh_joined_on: insOut.register.bhxh_joined_on ?? '',
        bhxh_status: insOut.register.bhxh_status ?? 'active',
        bhxh_document_id: insOut.register.bhxh_document_id != null ? String(insOut.register.bhxh_document_id) : '',
        bhyt_card_no: insOut.register.bhyt_card_no ?? '',
        bhyt_valid_from: insOut.register.bhyt_valid_from ?? '',
        bhyt_valid_to: insOut.register.bhyt_valid_to ?? '',
        bhyt_clinic_name: insOut.register.bhyt_clinic_name ?? '',
        bhyt_document_id: insOut.register.bhyt_document_id != null ? String(insOut.register.bhyt_document_id) : '',
        bhtn_joined_on: insOut.register.bhtn_joined_on ?? '',
        bhtn_status: insOut.register.bhtn_status ?? 'active',
        bhtn_document_id: insOut.register.bhtn_document_id != null ? String(insOut.register.bhtn_document_id) : '',
        notes: insOut.register.notes ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải sổ bảo hiểm');
    } finally {
      setLoading(false);
    }
  }, [onInsuranceChange, staffId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRegister() {
    setSaving(true);
    setError('');
    try {
      const out = await putHrStaffInsurance(token, staffId, {
        bhxh_book_no: draft.bhxh_book_no,
        bhxh_joined_on: draft.bhxh_joined_on || null,
        bhxh_status: draft.bhxh_status,
        bhxh_document_id: draft.bhxh_document_id ? Number(draft.bhxh_document_id) : null,
        bhyt_card_no: draft.bhyt_card_no,
        bhyt_valid_from: draft.bhyt_valid_from || null,
        bhyt_valid_to: draft.bhyt_valid_to || null,
        bhyt_clinic_name: draft.bhyt_clinic_name,
        bhyt_document_id: draft.bhyt_document_id ? Number(draft.bhyt_document_id) : null,
        bhtn_joined_on: draft.bhtn_joined_on || null,
        bhtn_status: draft.bhtn_status,
        bhtn_document_id: draft.bhtn_document_id ? Number(draft.bhtn_document_id) : null,
        notes: draft.notes,
      });
      setRegister(out.register);
      onInsuranceChange?.(out.summary);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu sổ BH thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function savePeriod() {
    setSaving(true);
    setError('');
    try {
      await createHrInsurancePeriod(token, staffId, {
        kind: periodDraft.kind || 'bhxh',
        period_year: Number(periodDraft.period_year),
        period_month: Number(periodDraft.period_month),
        salary_base: periodDraft.salary_base ? Number(periodDraft.salary_base) : null,
        notes: periodDraft.notes,
      });
      setPeriodDrawer(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm kỳ đóng thất bại');
    } finally {
      setSaving(false);
    }
  }

  function walletOptions(typeCode: string) {
    return insuranceWalletCards.filter((c) => c.type_code === typeCode || c.type_category === 'insurance');
  }

  if (loading && !register) {
    return <p className="muted">Đang tải sổ bảo hiểm…</p>;
  }

  return (
    <div className="stack-gap">
      <div className="wallet-toolbar">
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Sổ BH register — không kê khai XML. Scan qua thẻ ví loại bảo hiểm (BR-HR-140).
        </p>
        {canEdit ? (
          <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => void saveRegister()}>
            {saving ? 'Đang lưu…' : 'Lưu sổ BH'}
          </button>
        ) : null}
      </div>
      {error ? <p className="error">{error}</p> : null}

      <div className="insurance-grid">
        <section className="page-card insurance-card">
          <h3 className="insurance-card__title">BHXH</h3>
          <div className="form-grid form-grid--2">
            <label className="form-field">
              <span className="form-label">Số sổ BHXH</span>
              <input
                className="form-input mono"
                value={draft.bhxh_book_no ?? ''}
                disabled={!canEdit || (!canEditPii && Boolean(register?.bhxh_book_no_masked))}
                onChange={(e) => setDraft((d) => ({ ...d, bhxh_book_no: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Ngày tham gia</span>
              <input
                type="date"
                className="form-input"
                value={draft.bhxh_joined_on ?? ''}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, bhxh_joined_on: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Trạng thái</span>
              <select
                className="form-input"
                value={draft.bhxh_status ?? 'active'}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, bhxh_status: e.target.value }))}
              >
                {STATUS_OPTIONS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Thẻ ví (sổ BHXH)</span>
              <select
                className="form-input"
                value={draft.bhxh_document_id ?? ''}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, bhxh_document_id: e.target.value }))}
              >
                <option value="">— Không chọn —</option>
                {walletOptions('bhxh_book').map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title || c.type_label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {register?.bhxh_status ? (
            <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
              {statusLabel(register.bhxh_status)}
            </p>
          ) : null}
        </section>

        <section className="page-card insurance-card">
          <div className="insurance-card__head">
            <h3 className="insurance-card__title">BHYT</h3>
            <HrExpiryChip
              status={
                register?.bhyt_valid_to
                  ? new Date(`${register.bhyt_valid_to}T00:00:00`) < new Date()
                    ? 'expired'
                    : 'valid'
                  : 'valid'
              }
              expiresOn={register?.bhyt_valid_to}
            />
          </div>
          <div className="form-grid form-grid--2">
            <label className="form-field">
              <span className="form-label">Số thẻ BHYT</span>
              <input
                className="form-input mono"
                value={draft.bhyt_card_no ?? ''}
                disabled={!canEdit || (!canEditPii && Boolean(register?.bhyt_card_no_masked))}
                onChange={(e) => setDraft((d) => ({ ...d, bhyt_card_no: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Nơi KCB</span>
              <input
                className="form-input"
                value={draft.bhyt_clinic_name ?? ''}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, bhyt_clinic_name: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Hiệu lực từ</span>
              <input
                type="date"
                className="form-input"
                value={draft.bhyt_valid_from ?? ''}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, bhyt_valid_from: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Hết hạn</span>
              <input
                type="date"
                className="form-input"
                value={draft.bhyt_valid_to ?? ''}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, bhyt_valid_to: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Thẻ ví (BHYT)</span>
              <select
                className="form-input"
                value={draft.bhyt_document_id ?? ''}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, bhyt_document_id: e.target.value }))}
              >
                <option value="">— Không chọn —</option>
                {walletOptions('bhyt_card').map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title || c.type_label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="page-card insurance-card">
          <h3 className="insurance-card__title">BHTN</h3>
          <div className="form-grid form-grid--2">
            <label className="form-field">
              <span className="form-label">Ngày tham gia</span>
              <input
                type="date"
                className="form-input"
                value={draft.bhtn_joined_on ?? ''}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, bhtn_joined_on: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Trạng thái</span>
              <select
                className="form-input"
                value={draft.bhtn_status ?? 'active'}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, bhtn_status: e.target.value }))}
              >
                {STATUS_OPTIONS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Thẻ ví (BHTN)</span>
              <select
                className="form-input"
                value={draft.bhtn_document_id ?? ''}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, bhtn_document_id: e.target.value }))}
              >
                <option value="">— Không chọn —</option>
                {walletOptions('bhtn').map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title || c.type_label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      </div>

      <section className="page-card">
        <div className="wallet-toolbar">
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Lịch sử đóng (BHXH / BHTN)</h3>
          {canEdit ? (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => {
                const now = new Date();
                setPeriodDraft({
                  kind: 'bhxh',
                  period_year: String(now.getFullYear()),
                  period_month: String(now.getMonth() + 1),
                  salary_base: '',
                  notes: '',
                });
                setPeriodDrawer(true);
              }}
            >
              + Kỳ đóng
            </button>
          ) : null}
        </div>
        {periods.length === 0 ? (
          <p className="muted" style={{ margin: '0.65rem 0 0' }}>
            Chưa có kỳ đóng.
          </p>
        ) : (
          <table className="data-table" style={{ marginTop: '0.65rem' }}>
            <thead>
              <tr>
                <th>Loại</th>
                <th>Tháng/Năm</th>
                <th>Mức lương đóng</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.kind.toUpperCase()}</td>
                  <td>
                    {String(p.period_month).padStart(2, '0')}/{p.period_year}
                  </td>
                  <td>{formatSalary(p.salary_base, p.salary_masked)}</td>
                  <td>{p.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <WinDrawer open={periodDrawer} title="Thêm kỳ đóng BH" onClose={() => setPeriodDrawer(false)}>
        <div className="stack-gap">
          <div className="form-grid form-grid--2">
            <label className="form-field">
              <span className="form-label">Loại</span>
              <select
                className="form-input"
                value={periodDraft.kind ?? 'bhxh'}
                disabled={!canEdit}
                onChange={(e) => setPeriodDraft((d) => ({ ...d, kind: e.target.value }))}
              >
                <option value="bhxh">BHXH</option>
                <option value="bhtn">BHTN</option>
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Năm</span>
              <input
                type="number"
                className="form-input"
                value={periodDraft.period_year ?? ''}
                disabled={!canEdit}
                onChange={(e) => setPeriodDraft((d) => ({ ...d, period_year: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Tháng</span>
              <input
                type="number"
                min={1}
                max={12}
                className="form-input"
                value={periodDraft.period_month ?? ''}
                disabled={!canEdit}
                onChange={(e) => setPeriodDraft((d) => ({ ...d, period_month: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Mức lương đóng</span>
              <input
                type="number"
                className="form-input mono"
                value={periodDraft.salary_base ?? ''}
                disabled={!canEdit || !canEditPii}
                onChange={(e) => setPeriodDraft((d) => ({ ...d, salary_base: e.target.value }))}
              />
            </label>
          </div>
          <label className="form-field">
            <span className="form-label">Ghi chú</span>
            <input
              className="form-input"
              value={periodDraft.notes ?? ''}
              disabled={!canEdit}
              onChange={(e) => setPeriodDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </label>
          {canEdit ? (
            <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => void savePeriod()}>
              {saving ? 'Đang lưu…' : 'Thêm kỳ'}
            </button>
          ) : null}
        </div>
      </WinDrawer>
    </div>
  );
}

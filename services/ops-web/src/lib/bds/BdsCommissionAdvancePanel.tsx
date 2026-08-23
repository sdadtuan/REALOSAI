'use client';

import { useState } from 'react';
import { postCommissionAdvance } from '@/lib/bds/api';
import { w3ActionCopy } from '@/lib/bds/w3-copy';

const LOCKED_STATUSES = new Set(['locked', 'approved', 'paid']);

export function BdsCommissionAdvancePanel(props: {
  token: string;
  agencyId: string;
  periodMonth: string;
  canPayout: boolean;
  statementStatus: string;
  onSuccess: () => void;
}) {
  const { token, agencyId, periodMonth, canPayout, statementStatus, onSuccess } = props;
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const periodLocked = LOCKED_STATUSES.has(statementStatus);

  const onSubmit = async () => {
    if (!agencyId || !periodMonth || !canPayout) return;
    if (periodLocked) {
      setActionError('Kỳ đã khóa — không thêm tạm ứng.');
      return;
    }
    const amountVnd = Number(amount);
    if (!Number.isFinite(amountVnd) || amountVnd <= 0) {
      setActionError('Nhập đại lý, kỳ và số tiền hợp lệ.');
      return;
    }
    setBusy(true);
    setActionError('');
    setSuccessMsg('');
    try {
      await postCommissionAdvance(token, {
        agency_id: agencyId,
        amount_vnd: amountVnd,
        period_month: periodMonth,
        note: note.trim() || undefined,
      });
      setAmount('');
      setNote('');
      setSuccessMsg('Đã ghi tạm ứng.');
      onSuccess();
    } catch (err) {
      setActionError(w3ActionCopy(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  if (!agencyId) {
    return <p className="muted">Chọn đại lý trước khi ghi tạm ứng.</p>;
  }

  if (!canPayout) {
    return <p className="muted">Không có quyền ghi tạm ứng.</p>;
  }

  return (
    <div>
      {periodLocked ? (
        <p className="muted">Kỳ đã khóa — không thêm tạm ứng.</p>
      ) : (
        <p className="muted">Ghi tạm ứng trước khi khóa kỳ (tab Kỳ).</p>
      )}
      {actionError ? <p className="error">{actionError}</p> : null}
      {successMsg ? <p className="muted">{successMsg}</p> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '24rem' }}>
        <label>
          Số tiền (VND){' '}
          <input
            type="number"
            min={1}
            value={amount}
            disabled={busy || periodLocked}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Ghi chú{' '}
          <input
            value={note}
            disabled={busy || periodLocked}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || periodLocked}
          onClick={() => void onSubmit()}
        >
          Ghi tạm ứng
        </button>
      </div>
    </div>
  );
}

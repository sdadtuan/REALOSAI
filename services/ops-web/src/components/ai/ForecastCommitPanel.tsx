'use client';

import { useState } from 'react';
import { formatVnd } from '@/lib/kpi/format';
import type { ForecastMapePriorMonth } from '@/lib/ai-api';

export function ForecastCommitPanel({
  snapshotId,
  suggestedAmount,
  canCommit,
  isCommitted,
  committedAmount,
  committedBy,
  committedAt,
  mapePriorMonth,
  saving,
  onSave,
}: {
  snapshotId: string | null;
  suggestedAmount: number;
  canCommit: boolean;
  isCommitted: boolean;
  committedAmount: number;
  committedBy: string | null;
  committedAt: string | null;
  mapePriorMonth: ForecastMapePriorMonth | null;
  saving: boolean;
  onSave: (amount: number, acknowledgeMapeWarning: boolean) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState('');
  const [ackMape, setAckMape] = useState(false);
  const [error, setError] = useState('');

  const displayAmount = amountText || (suggestedAmount > 0 ? String(suggestedAmount) : '');

  async function handleSave() {
    setError('');
    const amount = Number(displayAmount.replace(/[^\d]/g, ''));
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Nhập số cam kết VND hợp lệ');
      return;
    }
    if (!snapshotId) {
      setError('Chưa có snapshot — chờ cron RNOS-17 hoặc chạy snapshot thủ công.');
      return;
    }
    if (mapePriorMonth?.warn && !ackMape) {
      setError('MAPE tháng trước >20% — tick xác nhận trước khi lưu.');
      return;
    }
    try {
      await onSave(amount, ackMape);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu cam kết thất bại');
    }
  }

  return (
    <section className="forecast-commit-panel" data-testid="forecast-commit-panel">
      <h3 className="kpi-section-title">Cam kết GDKD</h3>

      {mapePriorMonth?.warn ? (
        <div className="forecast-commit-panel__banner forecast-commit-panel__banner--warn" role="alert">
          MAPE {mapePriorMonth.month}: {mapePriorMonth.mape_pct?.toFixed(1)}% (&gt;20%) — cam kết{' '}
          {formatVnd(mapePriorMonth.committed_vnd)} vs actual {formatVnd(mapePriorMonth.actual_vnd)}.
        </div>
      ) : null}

      {isCommitted ? (
        <div className="forecast-commit-panel__committed">
          <p>
            Đã cam kết <strong>{formatVnd(committedAmount)}</strong>
          </p>
          <p className="muted">
            bởi {committedBy ?? '—'} · {committedAt ? new Date(committedAt).toLocaleString('vi-VN') : '—'}
          </p>
        </div>
      ) : (
        <>
          <label className="forecast-commit-panel__field">
            <span>Cam kết VND</span>
            <input
              type="text"
              inputMode="numeric"
              className="kpi-input forecast-commit-panel__input"
              value={displayAmount}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder={suggestedAmount > 0 ? String(suggestedAmount) : '0'}
              disabled={!canCommit || saving}
              data-testid="forecast-commit-input"
            />
          </label>
          {mapePriorMonth?.warn ? (
            <label className="forecast-commit-panel__ack">
              <input
                type="checkbox"
                checked={ackMape}
                onChange={(e) => setAckMape(e.target.checked)}
                disabled={!canCommit || saving}
                data-testid="forecast-mape-ack"
              />
              Tôi hiểu MAPE tháng trước vượt ngưỡng và vẫn muốn cam kết
            </label>
          ) : null}
          <button
            type="button"
            className="btn btn-primary forecast-commit-panel__save"
            onClick={() => void handleSave()}
            disabled={!canCommit || saving}
            data-testid="forecast-commit-save"
          >
            {saving ? 'Đang lưu…' : 'Lưu cam kết'}
          </button>
        </>
      )}

      {error ? <p className="forecast-commit-panel__error">{error}</p> : null}
    </section>
  );
}

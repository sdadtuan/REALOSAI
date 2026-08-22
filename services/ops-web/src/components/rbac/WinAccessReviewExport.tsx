'use client';

import { useState } from 'react';
import { downloadStaffAccessReviewZip } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export function WinAccessReviewExport({ disabled }: { disabled?: boolean }) {
  const [quarter, setQuarter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload() {
    const access = getAccessToken();
    if (!access) return;
    setBusy(true);
    setError('');
    try {
      await downloadStaffAccessReviewZip(access, quarter || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải access review thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="win-access-review-export stack-gap" data-testid="win-access-review-export">
      <label className="stack-gap" style={{ gap: '0.25rem' }}>
        <span className="muted">Quý (tuỳ chọn)</span>
        <input
          type="text"
          value={quarter}
          onChange={(e) => setQuarter(e.target.value)}
          placeholder="2026-Q3"
          className="kpi-input"
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="button" className="btn btn-secondary" disabled={disabled || busy} onClick={() => void handleDownload()}>
        {busy ? 'Đang tạo ZIP…' : 'Access review ZIP'}
      </button>
    </div>
  );
}

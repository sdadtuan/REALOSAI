'use client';

import { useEffect, useState } from 'react';
import {
  postCommissionStatementApprove,
  postCommissionStatementLock,
  postCommissionStatementPay,
} from '@/lib/bds/api';
import type { BdsCommissionStatement } from '@/lib/bds/types';
import { w3ActionCopy } from '@/lib/bds/w3-copy';

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
}

function statementStorageKey(agencyId: string, periodMonth: string): string {
  return `bds-w3-statement-${agencyId}-${periodMonth}`;
}

function readStoredStatement(
  agencyId: string,
  periodMonth: string,
): BdsCommissionStatement | null {
  if (typeof window === 'undefined' || !agencyId || !periodMonth) return null;
  try {
    const raw = window.sessionStorage.getItem(statementStorageKey(agencyId, periodMonth));
    if (!raw) return null;
    return JSON.parse(raw) as BdsCommissionStatement;
  } catch {
    return null;
  }
}

function writeStoredStatement(stmt: BdsCommissionStatement | null, agencyId: string, periodMonth: string) {
  if (typeof window === 'undefined') return;
  const key = statementStorageKey(agencyId, periodMonth);
  if (!stmt) {
    window.sessionStorage.removeItem(key);
    return;
  }
  window.sessionStorage.setItem(key, JSON.stringify(stmt));
}

export function BdsCommissionPeriodPanel(props: {
  token: string;
  agencyId: string;
  periodMonth: string;
  canApprove: boolean;
  canPayout: boolean;
  statement: BdsCommissionStatement | null;
  onStatementChange: (stmt: BdsCommissionStatement | null) => void;
  onPaid: () => void;
}) {
  const { token, agencyId, periodMonth, canApprove, canPayout, statement, onStatementChange, onPaid } =
    props;
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!agencyId || !periodMonth) {
      onStatementChange(null);
      return;
    }
    onStatementChange(readStoredStatement(agencyId, periodMonth));
  }, [agencyId, periodMonth, onStatementChange]);

  const persist = (stmt: BdsCommissionStatement) => {
    writeStoredStatement(stmt, agencyId, periodMonth);
    onStatementChange(stmt);
  };

  const onLock = async () => {
    if (!agencyId || !periodMonth || !canApprove) return;
    setBusy(true);
    setActionError('');
    try {
      const stmt = await postCommissionStatementLock(token, {
        agency_id: agencyId,
        period_month: periodMonth,
      });
      persist(stmt);
    } catch (err) {
      setActionError(w3ActionCopy(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const onApprove = async () => {
    if (!statement?.id || !canApprove) return;
    setBusy(true);
    setActionError('');
    try {
      const stmt = await postCommissionStatementApprove(token, statement.id);
      persist(stmt);
    } catch (err) {
      setActionError(w3ActionCopy(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const onPay = async () => {
    if (!statement?.id || !canPayout) return;
    setBusy(true);
    setActionError('');
    try {
      const stmt = await postCommissionStatementPay(token, statement.id);
      persist(stmt);
      onPaid();
    } catch (err) {
      setActionError(w3ActionCopy(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  if (!agencyId) {
    return <p className="muted">Chọn đại lý để đối soát kỳ.</p>;
  }

  const status = statement?.status ?? '';

  return (
    <div>
      <p className="muted">±0đ với Kênh — net hiển thị sau khóa kỳ.</p>
      {actionError ? <p className="error">{actionError}</p> : null}

      {statement ? (
        <div style={{ marginBottom: '1rem' }}>
          <p>
            Trạng thái: <span className="chip">{statement.status}</span>
          </p>
          <ul className="muted">
            <li>Gross: {formatVnd(statement.gross_vnd)}</li>
            <li>Tạm ứng: {formatVnd(statement.advance_vnd)}</li>
            <li>Clawback: {formatVnd(statement.clawback_vnd)}</li>
            <li>
              <strong>Net: {formatVnd(statement.net_vnd)}</strong>
            </li>
          </ul>
        </div>
      ) : (
        <p className="muted">Chưa khóa kỳ — ledger accrued sẽ gom khi bấm Khóa kỳ.</p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {!status && canApprove ? (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void onLock()}>
            Khóa kỳ
          </button>
        ) : null}
        {status === 'locked' && canApprove ? (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void onApprove()}>
            Duyệt
          </button>
        ) : null}
        {status === 'approved' && canPayout ? (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void onPay()}>
            Chi
          </button>
        ) : null}
        {status === 'paid' ? <p className="muted">Đã chi.</p> : null}
      </div>
    </div>
  );
}

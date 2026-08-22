'use client';

import { useEffect, useState } from 'react';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { hasCap } from '@/lib/auth';
import {
  fetchBdsAftersales,
  postDefect,
  postHandover,
  postHandoverCheck,
  postTitle,
  type AftersalesBoardRow,
} from '@/lib/bds/api';
import { HANDOVER_CHECK_CODES } from '@/lib/bds/aftersales-labels';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

const CHECK_LABELS: Record<string, string> = {
  water: 'Nước',
  electric: 'Điện',
  interior: 'Nội thất',
  minutes: 'Biên bản',
};

const TITLE_NEXT: Record<string, string> = {
  not_started: 'submitted',
  submitted: 'issued',
  issued: 'handed_to_buyer',
};

const TITLE_ACTION_LABEL: Record<string, string> = {
  submitted: 'Nộp sổ',
  issued: 'Cấp sổ',
  handed_to_buyer: 'Giao KH',
};

function titleActionLabel(current: string): string | null {
  const next = TITLE_NEXT[current];
  return next ? (TITLE_ACTION_LABEL[next] ?? next) : null;
}

function errorMessage(code: string): string {
  if (code === 'handover_checklist') return 'Thiếu checklist bàn giao (4 mục pass hoặc waive).';
  if (code === 'handover_waive') return 'Waive cần quyền duyệt và lý do ≥ 3 ký tự.';
  if (code === 'not_handed_over') return 'Chỉ mở defect sau bàn giao.';
  return code;
}

export default function BdsAftersalesPage() {
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_aftersales', action: 'view' },
  ]);
  const [rows, setRows] = useState<AftersalesBoardRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const canApprove = hasCap(user, 'bds_aftersales', 'approve');

  const reload = async (accessToken: string) => {
    setRows(await fetchBdsAftersales(accessToken));
  };

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        await reload(token);
      } catch (err) {
        setLoadError(
          err instanceof Error && err.message.includes('404')
            ? 'Sau bán chưa bật (PTT_BDS_AFTERSALES=0).'
            : err instanceof Error
              ? err.message
              : 'Tải sau bán thất bại',
        );
      }
    })();
  }, [token]);

  const selected = rows.find((r) => r.transaction_id === selectedId) ?? null;

  const runAction = async (fn: () => Promise<unknown>) => {
    if (!token) return;
    setActionError('');
    try {
      await fn();
      await reload(token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thao tác thất bại';
      setActionError(errorMessage(msg));
    }
  };

  if (notFound) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
      </main>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title="Sau bán" subtitle="Bàn giao · sổ hồng · bảo hành (SCR-BDS-100)">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {loadError ? <p className="muted">{loadError}</p> : null}
        {actionError ? <p className="muted">{actionError}</p> : null}
        {!loading && !error && !loadError && rows.length === 0 ? (
          <p className="muted">Chưa có giao dịch HĐMB chờ bàn giao.</p>
        ) : null}
        {rows.length > 0 ? (
          <table className="table-compact">
            <thead>
              <tr>
                <th>HĐ</th>
                <th>Stage</th>
                <th>Checklist</th>
                <th>Sổ hồng</th>
                <th>Hẹn BG</th>
                <th>Defect</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.transaction_id}
                  onClick={() => setSelectedId(row.transaction_id)}
                  style={{ cursor: 'pointer', background: selectedId === row.transaction_id ? '#f5f5f5' : undefined }}
                >
                  <td>{row.contract_no || row.transaction_id.slice(0, 8)}</td>
                  <td>{row.stage}</td>
                  <td>
                    {row.checks_passed}/{row.checks_total}
                  </td>
                  <td>{row.title_status}</td>
                  <td>{row.appointment_due ? '≤15N' : '—'}</td>
                  <td>{row.open_defects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {selected && token ? (
          <section style={{ marginTop: '1.5rem' }}>
            <h3>Giao dịch {selected.contract_no || selected.transaction_id.slice(0, 8)}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {HANDOVER_CHECK_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    void runAction(() => postHandoverCheck(token, selected.transaction_id, code, 'pass'))
                  }
                >
                  ✓ {CHECK_LABELS[code] ?? code}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void runAction(() => postHandover(token, selected.transaction_id))}
              >
                Bàn giao
              </button>
              {canApprove ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const reason = window.prompt('Lý do waive bàn giao (≥3 ký tự):');
                    if (!reason) return;
                    void runAction(() =>
                      postHandover(token, selected.transaction_id, true, reason),
                    );
                  }}
                >
                  Waive checklist
                </button>
              ) : null}
              {titleActionLabel(selected.title_status) ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const next = TITLE_NEXT[selected.title_status];
                    if (!next) return;
                    void runAction(() => postTitle(token, selected.transaction_id, next));
                  }}
                >
                  {titleActionLabel(selected.title_status)}
                </button>
              ) : null}
              {selected.stage === 'handed_over' || selected.stage === 'title_issued' ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const title = window.prompt('Tiêu đề defect (≥3 ký tự):');
                    if (!title) return;
                    void runAction(() => postDefect(token, selected.transaction_id, title));
                  }}
                >
                  + Defect
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}

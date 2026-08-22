'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  createLeadContract,
  fetchLeadContractReadiness,
  patchLeadContract,
  submitLeadContract,
  type ContractApprovalRow,
  type ContractReadinessCheck,
  type LeadContractRow,
} from '@/lib/api';
import { hasCap, type StoredStaffUser } from '@/lib/auth';
import type { LeadContractFlowSummary } from '@/components/LeadB2bSalesFlowBar';

interface Props {
  token: string;
  leadId: number;
  user: StoredStaffUser | null;
  refreshToken?: number;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
  onLoaded?: (summary: LeadContractFlowSummary) => void;
}

export function LeadContractPanel({
  token,
  leadId,
  user,
  refreshToken = 0,
  onMessage,
  onError,
  onLoaded,
}: Props) {
  const [checks, setChecks] = useState<ContractReadinessCheck[]>([]);
  const [contract, setContract] = useState<LeadContractRow | null>(null);
  const [approval, setApproval] = useState<ContractApprovalRow | null>(null);
  const [lifecycleId, setLifecycleId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [submitNotes, setSubmitNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [panelError, setPanelError] = useState('');

  const canEdit = hasCap(user, 'crm_leads', 'edit');

  const reload = useCallback(async () => {
    setLoading(true);
    setPanelError('');
    try {
      const data = await fetchLeadContractReadiness(token, leadId);
      setChecks(data.checks);
      setContract(data.contract);
      setApproval(data.approval);
      const lifecycle =
        data.lifecycle_id != null && data.lifecycle_id > 0 ? data.lifecycle_id : null;
      setLifecycleId(lifecycle);
      if (data.contract?.amount_vnd) setAmount(String(data.contract.amount_vnd));
      onLoaded?.({
        hasContract: Boolean(data.contract),
        contractStatus: data.contract?.status ?? null,
        pendingApproval: data.approval?.status === 'pending',
        lifecycleId: lifecycle,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Tải HĐ thất bại';
      setPanelError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, leadId, onLoaded]);

  useEffect(() => {
    void reload();
  }, [reload, refreshToken]);

  async function onCreateDraft() {
    if (!canEdit) return;
    setBusy(true);
    try {
      const row = await createLeadContract(token, leadId, {
        amount_vnd: amount ? Number(amount) : 0,
      });
      setContract(row);
      onMessage?.('Đã tạo HĐ draft');
      await reload();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tạo HĐ thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    if (!canEdit || !contract) return;
    setBusy(true);
    try {
      await submitLeadContract(token, leadId, contract.id, { notes: submitNotes.trim() });
      onMessage?.('Đã gửi GDKD duyệt — chờ phê duyệt');
      await reload();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Submit thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveAmount() {
    if (!canEdit || !contract) return;
    setBusy(true);
    try {
      const row = await patchLeadContract(token, leadId, contract.id, {
        amount_vnd: amount ? Number(amount) : 0,
      });
      setContract(row);
      onMessage?.('Đã cập nhật HĐ draft');
      await reload();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Cập nhật HĐ thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Đang tải hợp đồng…</p>;

  const submitReady = checks.filter((c) => c.key !== 'no_pending_approval').every((c) => c.ok);
  const pending = approval?.status === 'pending';

  return (
    <section
      id="lead-contract"
      style={{
        marginTop: '1.25rem',
        padding: '1rem',
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--bg-subtle, rgba(255,255,255,0.02))',
      }}
    >
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Hợp đồng → Service Delivery</h3>
      {panelError ? (
        <div className="lead-alert lead-alert--error" role="alert" style={{ marginBottom: '0.75rem' }}>
          {panelError}
        </div>
      ) : null}
      <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
        AM tạo draft → submit → GDKD duyệt → lifecycle Onboard (2 bước phê duyệt)
      </p>

      <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem', fontSize: '0.9rem' }}>
        {checks.map((c) => (
          <li key={c.key} style={{ color: c.ok ? 'var(--success, #16a34a)' : 'var(--error, #dc2626)' }}>
            {c.ok ? '✓' : '○'} {c.label}
            {c.message && !c.ok ? ` — ${c.message}` : ''}
          </li>
        ))}
      </ul>

      {contract ? (
        <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>
          <strong>{contract.title}</strong>
          <div className="muted">
            #{contract.id} · {contract.status}
            {approval ? ` · approval: ${approval.status}` : ''}
          </div>
        </div>
      ) : null}

      {canEdit && !contract && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span className="muted">Giá trị HĐ (VND)</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </label>
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void onCreateDraft()}>
            Tạo HĐ draft
          </button>
        </div>
      )}

      {canEdit && contract?.status === 'draft' && !pending && (
        <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span className="muted">Giá trị HĐ (VND)</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </label>
          <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void onSaveAmount()}>
            Lưu draft
          </button>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span className="muted">Ghi chú gửi GDKD</span>
            <textarea
              value={submitNotes}
              onChange={(e) => setSubmitNotes(e.target.value)}
              rows={2}
              style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </label>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={busy || !submitReady}
            onClick={() => void onSubmit()}
          >
            Gửi GDKD duyệt
          </button>
        </div>
      )}

      {pending ? (
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Đang chờ GDKD duyệt (approval #{approval?.id}).{' '}
          <Link href="/crm/hub" className="nav-link">
            Hub · HĐ chờ duyệt →
          </Link>
        </p>
      ) : null}

      {contract?.status === 'active' ? (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.65rem 0.85rem',
            borderRadius: 8,
            border: '1px solid var(--accent, #16a34a)',
            background: 'rgba(22, 163, 74, 0.08)',
          }}
        >
          <strong>HĐ đã ký Active</strong>
          {lifecycleId ? (
            <p style={{ margin: '0.35rem 0 0' }}>
              Lifecycle #{lifecycleId} ·{' '}
              <Link href={`/crm/service-delivery/${lifecycleId}`} className="nav-link">
                Mở workflow triển khai →
              </Link>
              {' · '}
              <Link href="/agency/clients/new" className="nav-link">
                Tạo Agency Client →
              </Link>
            </p>
          ) : (
            <p className="muted" style={{ margin: '0.35rem 0 0' }}>
              Đang promote… refresh trang hoặc xem{' '}
              <Link href="/crm/service-delivery" className="nav-link">
                Service Delivery
              </Link>
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

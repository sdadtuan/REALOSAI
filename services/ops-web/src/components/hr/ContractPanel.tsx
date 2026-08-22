'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WinDrawer } from '@/components/win';
import { HrExpiryChip } from '@/components/hr/HrExpiryChip';
import {
  createHrLaborAppendix,
  createHrLaborContract,
  fetchHrLaborContracts,
  fetchHrStaffWallet,
  patchHrLaborContract,
  type HrActiveContractSummaryDto,
  type HrDocWalletCardDto,
  type HrLaborAppendixDto,
  type HrLaborContractDto,
} from '@/lib/hr-employee-file-api';

type Props = {
  staffId: number;
  token: string;
  canEdit: boolean;
  canViewPii: boolean;
  canEditPii: boolean;
  onActiveContractChange?: (active: HrActiveContractSummaryDto | null) => void;
};

const KIND_OPTIONS = [
  ['probation', 'Thử việc'],
  ['fixed', 'Xác định thời hạn'],
  ['indefinite', 'Không xác định'],
  ['seasonal', 'Thời vụ'],
  ['service', 'Dịch vụ'],
] as const;

const STATUS_OPTIONS = [
  ['draft', 'Nháp'],
  ['active', 'Hiệu lực'],
  ['terminated', 'Chấm dứt'],
  ['expired', 'Hết hạn'],
  ['superseded', 'Thay thế'],
] as const;

function kindLabel(kind: string): string {
  return KIND_OPTIONS.find(([k]) => k === kind)?.[1] ?? kind;
}

function formatSalary(amount: number | null | undefined, currency: string, masked?: boolean): string {
  if (masked || amount == null) return '••••••';
  return `${amount.toLocaleString('vi-VN')} ${currency || 'VND'}`;
}

export function ContractPanel({
  staffId,
  token,
  canEdit,
  canViewPii,
  canEditPii,
  onActiveContractChange,
}: Props) {
  const [contracts, setContracts] = useState<HrLaborContractDto[]>([]);
  const [walletCards, setWalletCards] = useState<HrDocWalletCardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'appendix'>('create');
  const [activeContract, setActiveContract] = useState<HrLaborContractDto | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const contractWalletCards = useMemo(
    () => walletCards.filter((c) => c.type_category === 'contract' || c.type_code === 'labor_contract'),
    [walletCards],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [contractOut, walletOut] = await Promise.all([
        fetchHrLaborContracts(token, staffId),
        fetchHrStaffWallet(token, staffId, { category: 'contract' }),
      ]);
      setContracts(contractOut.contracts);
      setWalletCards(walletOut.cards);
      onActiveContractChange?.(contractOut.active_contract ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải hợp đồng');
    } finally {
      setLoading(false);
    }
  }, [onActiveContractChange, staffId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setDrawerMode('create');
    setActiveContract(null);
    setDraft({
      kind: 'fixed',
      status: 'draft',
      currency: 'VND',
      contract_no: '',
      work_place: '',
      job_title_legal: '',
    });
    setDrawerOpen(true);
  }

  function openEdit(contract: HrLaborContractDto) {
    setDrawerMode('edit');
    setActiveContract(contract);
    setDraft({
      contract_no: contract.contract_no ?? '',
      kind: contract.kind ?? 'fixed',
      status: contract.status ?? 'draft',
      signed_on: contract.signed_on ?? '',
      effective_on: contract.effective_on ?? '',
      expires_on: contract.expires_on ?? '',
      salary_gross: contract.salary_gross != null ? String(contract.salary_gross) : '',
      currency: contract.currency ?? 'VND',
      work_place: contract.work_place ?? '',
      job_title_legal: contract.job_title_legal ?? '',
      document_id: contract.document_id != null ? String(contract.document_id) : '',
      notes: contract.notes ?? '',
    });
    setDrawerOpen(true);
  }

  function openAppendix(contract: HrLaborContractDto) {
    setDrawerMode('appendix');
    setActiveContract(contract);
    setDraft({ appendix_no: '', summary: '', signed_on: '', effective_on: '', salary_gross: '', document_id: '' });
    setDrawerOpen(true);
  }

  async function saveContract() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        contract_no: draft.contract_no,
        kind: draft.kind,
        status: draft.status,
        signed_on: draft.signed_on || null,
        effective_on: draft.effective_on || null,
        expires_on: draft.kind === 'indefinite' ? null : draft.expires_on || null,
        salary_gross: draft.salary_gross ? Number(draft.salary_gross) : null,
        currency: draft.currency || 'VND',
        work_place: draft.work_place,
        job_title_legal: draft.job_title_legal,
        document_id: draft.document_id ? Number(draft.document_id) : null,
        notes: draft.notes,
      };
      if (drawerMode === 'create') {
        await createHrLaborContract(token, staffId, payload);
      } else if (activeContract) {
        await patchHrLaborContract(token, staffId, activeContract.id, payload);
      }
      setDrawerOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu hợp đồng thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function saveAppendix() {
    if (!activeContract) return;
    setSaving(true);
    setError('');
    try {
      await createHrLaborAppendix(token, staffId, activeContract.id, {
        appendix_no: draft.appendix_no,
        summary: draft.summary,
        signed_on: draft.signed_on || null,
        effective_on: draft.effective_on || null,
        salary_gross: draft.salary_gross ? Number(draft.salary_gross) : null,
        document_id: draft.document_id ? Number(draft.document_id) : null,
      });
      setDrawerOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu phụ lục thất bại');
    } finally {
      setSaving(false);
    }
  }

  const drawerTitle =
    drawerMode === 'create' ? 'Thêm hợp đồng' : drawerMode === 'appendix' ? 'Thêm phụ lục' : 'Sửa hợp đồng';

  return (
    <div className="stack-gap">
      <div className="wallet-toolbar">
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Timeline HĐLĐ — phụ lục gắn trên cùng hợp đồng (BR-HR-112). Scan qua thẻ ví loại hợp đồng.
        </p>
        {canEdit ? (
          <button type="button" className="btn btn-sm btn-primary" onClick={openCreate}>
            + Hợp đồng
          </button>
        ) : null}
      </div>
      {loading ? <p className="muted">Đang tải hợp đồng…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && contracts.length === 0 ? (
        <div className="page-card">
          <p className="muted" style={{ margin: 0 }}>
            Chưa có hợp đồng lao động.
          </p>
          {canEdit ? (
            <button type="button" className="btn btn-sm btn-secondary" style={{ marginTop: '0.65rem' }} onClick={openCreate}>
              Tạo hợp đồng đầu tiên
            </button>
          ) : null}
        </div>
      ) : (
        <div className="contract-timeline">
          {contracts.map((contract) => (
            <article key={contract.id} className="contract-timeline__item page-card">
              <header className="contract-timeline__head">
                <div>
                  <h3 className="contract-timeline__title">
                    <span className="mono">{contract.contract_no || `#${contract.id}`}</span>
                    <span className="muted"> · {kindLabel(contract.kind)}</span>
                  </h3>
                  <p className="contract-timeline__meta muted">
                    {contract.effective_on ? `Hiệu lực ${contract.effective_on}` : 'Chưa có ngày hiệu lực'}
                    {contract.job_title_legal ? ` · ${contract.job_title_legal}` : ''}
                    {contract.work_place ? ` · ${contract.work_place}` : ''}
                  </p>
                </div>
                <div className="contract-timeline__badges">
                  <HrExpiryChip status={contract.status} expiresOn={contract.expires_on} />
                  {contract.document_title ? (
                    <span className="hr-expiry-chip hr-expiry-chip--muted">📎 {contract.document_title}</span>
                  ) : null}
                </div>
              </header>
              <div className="contract-timeline__body">
                <div className="contract-timeline__facts">
                  <span>Lương: {formatSalary(contract.salary_gross, contract.currency, contract.salary_masked)}</span>
                  {contract.signed_on ? <span>Ký {contract.signed_on}</span> : null}
                </div>
                {canEdit ? (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => openEdit(contract)}>
                      Sửa
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => openAppendix(contract)}>
                      + Phụ lục
                    </button>
                  </div>
                ) : null}
              </div>
              {contract.appendices?.length ? (
                <ul className="contract-appendix-list">
                  {contract.appendices.map((ap: HrLaborAppendixDto) => (
                    <li key={ap.id}>
                      <strong className="mono">{ap.appendix_no || `PL-${ap.id}`}</strong>
                      {ap.effective_on ? ` · ${ap.effective_on}` : ''}
                      {ap.summary ? ` — ${ap.summary}` : ''}
                      {ap.salary_gross != null || ap.salary_masked ? (
                        <span className="muted">
                          {' '}
                          · Lương {formatSalary(ap.salary_gross, 'VND', ap.salary_masked)}
                        </span>
                      ) : null}
                      {ap.document_title ? <span className="muted"> · 📎 {ap.document_title}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <WinDrawer open={drawerOpen} title={drawerTitle} onClose={() => setDrawerOpen(false)}>
        <div className="stack-gap">
          {drawerMode !== 'appendix' ? (
            <>
              <div className="form-grid form-grid--2">
                <label className="form-field">
                  <span className="form-label">Số HĐ</span>
                  <input
                    className="form-input mono"
                    value={draft.contract_no ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => setDraft((d) => ({ ...d, contract_no: e.target.value }))}
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Loại</span>
                  <select
                    className="form-input"
                    value={draft.kind ?? 'fixed'}
                    disabled={!canEdit}
                    onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}
                  >
                    {KIND_OPTIONS.map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">Trạng thái</span>
                  <select
                    className="form-input"
                    value={draft.status ?? 'draft'}
                    disabled={!canEdit}
                    onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                  >
                    {STATUS_OPTIONS.map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">Chức danh (HĐ)</span>
                  <input
                    className="form-input"
                    value={draft.job_title_legal ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => setDraft((d) => ({ ...d, job_title_legal: e.target.value }))}
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Ngày ký</span>
                  <input
                    type="date"
                    className="form-input"
                    value={draft.signed_on ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => setDraft((d) => ({ ...d, signed_on: e.target.value }))}
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Hiệu lực</span>
                  <input
                    type="date"
                    className="form-input"
                    value={draft.effective_on ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => setDraft((d) => ({ ...d, effective_on: e.target.value }))}
                  />
                </label>
                {draft.kind !== 'indefinite' ? (
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
                ) : null}
                <label className="form-field">
                  <span className="form-label">Nơi làm việc</span>
                  <input
                    className="form-input"
                    value={draft.work_place ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => setDraft((d) => ({ ...d, work_place: e.target.value }))}
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Lương gross</span>
                  <input
                    type="number"
                    className="form-input mono"
                    value={draft.salary_gross ?? ''}
                    disabled={!canEdit || !canEditPii}
                    placeholder={canViewPii ? '' : '••••••'}
                    onChange={(e) => setDraft((d) => ({ ...d, salary_gross: e.target.value }))}
                  />
                </label>
              </div>
              <label className="form-field">
                <span className="form-label">Thẻ ví (scan HĐ)</span>
                <select
                  className="form-input"
                  value={draft.document_id ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => setDraft((d) => ({ ...d, document_id: e.target.value }))}
                >
                  <option value="">— Không chọn —</option>
                  {contractWalletCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title || c.type_label} {c.doc_no ? `(${c.doc_no})` : ''}
                    </option>
                  ))}
                </select>
                {contractWalletCards.length === 0 ? (
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    Thêm thẻ loại hợp đồng trong tab Ví giấy tờ trước.
                  </span>
                ) : null}
              </label>
              <label className="form-field">
                <span className="form-label">Ghi chú</span>
                <textarea
                  className="form-input"
                  rows={2}
                  value={draft.notes ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                />
              </label>
              {canEdit ? (
                <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => void saveContract()}>
                  {saving ? 'Đang lưu…' : drawerMode === 'create' ? 'Tạo HĐ' : 'Lưu HĐ'}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <div className="form-grid form-grid--2">
                <label className="form-field">
                  <span className="form-label">Số phụ lục</span>
                  <input
                    className="form-input mono"
                    value={draft.appendix_no ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => setDraft((d) => ({ ...d, appendix_no: e.target.value }))}
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Ngày ký</span>
                  <input
                    type="date"
                    className="form-input"
                    value={draft.signed_on ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => setDraft((d) => ({ ...d, signed_on: e.target.value }))}
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Hiệu lực</span>
                  <input
                    type="date"
                    className="form-input"
                    value={draft.effective_on ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => setDraft((d) => ({ ...d, effective_on: e.target.value }))}
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Lương mới (nếu có)</span>
                  <input
                    type="number"
                    className="form-input mono"
                    value={draft.salary_gross ?? ''}
                    disabled={!canEdit || !canEditPii}
                    onChange={(e) => setDraft((d) => ({ ...d, salary_gross: e.target.value }))}
                  />
                </label>
              </div>
              <label className="form-field">
                <span className="form-label">Tóm tắt thay đổi</span>
                <textarea
                  className="form-input"
                  rows={2}
                  value={draft.summary ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                />
              </label>
              <label className="form-field">
                <span className="form-label">Thẻ ví (scan phụ lục)</span>
                <select
                  className="form-input"
                  value={draft.document_id ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => setDraft((d) => ({ ...d, document_id: e.target.value }))}
                >
                  <option value="">— Không chọn —</option>
                  {contractWalletCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title || c.type_label} {c.doc_no ? `(${c.doc_no})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {canEdit ? (
                <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => void saveAppendix()}>
                  {saving ? 'Đang lưu…' : 'Thêm phụ lục'}
                </button>
              ) : null}
            </>
          )}
        </div>
      </WinDrawer>
    </div>
  );
}

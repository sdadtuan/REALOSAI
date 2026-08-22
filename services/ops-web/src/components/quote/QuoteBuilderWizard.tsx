'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createQuoteProposal,
  exportQuoteProposal,
  fetchQuoteCatalog,
  patchQuoteStatus,
  putQuoteLines,
  QUOTE_TIER_LABEL,
  skuForDvTier,
  tierFromSku,
  type QuoteCatalogFamily,
  type QuoteLineItem,
  type QuoteProposalDetail,
} from '@/lib/quote-api';
import type { CustomerRow } from '@/lib/api';
import type { StoredStaffUser } from '@/lib/auth';

type WizardStep = 1 | 2 | 3 | 4;

type DraftLine = {
  dv_code: string;
  sku_code: string;
  package_tier: 'basic' | 'standard' | 'premium';
  final_price_vnd: number;
  reference_min: number;
  reference_max: number;
  scope_notes: string;
};

type Props = {
  token: string;
  user: StoredStaffUser;
  customers: CustomerRow[];
  initialCustomerId: string;
  initialSelectedDv?: string[];
  onDone: () => Promise<void>;
};

function familyByDv(families: QuoteCatalogFamily[], dvCode: string) {
  return families.find((f) => f.dv_code === dvCode);
}

function offerScopeSummary(family: QuoteCatalogFamily | undefined, skuCode: string): string {
  const offer = family?.offers.find((o) => o.sku_code === skuCode);
  if (!offer) return '';
  if (offer.lines?.length) {
    return offer.lines.map((l) => l.label_vi).join('; ');
  }
  return offer.scope_summary_vi ?? '';
}

export function QuoteBuilderWizard({
  token,
  user,
  customers,
  initialCustomerId,
  initialSelectedDv = [],
  onDone,
}: Props) {
  const [step, setStep] = useState<WizardStep>(1);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [families, setFamilies] = useState<QuoteCatalogFamily[]>([]);
  const [comboWarnings, setComboWarnings] = useState<Array<{ dv_code: string; message_vi: string }>>([]);
  const [selectedDv, setSelectedDv] = useState<string[]>([]);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [proposal, setProposal] = useState<QuoteProposalDetail | null>(null);
  const [adjustReason, setAdjustReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchQuoteCatalog(token)
      .then((data) => {
        setFamilies(data.families ?? []);
        setComboWarnings(data.combo_warnings ?? []);
        if (initialSelectedDv.length) {
          const valid = initialSelectedDv.filter((dv) =>
            (data.families ?? []).some((f) => f.dv_code === dv),
          );
          if (valid.length) {
            setSelectedDv(valid);
            setStep(2);
          }
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Tải catalog thất bại'));
  }, [token, initialSelectedDv]);

  const total = useMemo(() => lines.reduce((s, l) => s + l.final_price_vnd, 0), [lines]);

  function toggleDv(code: string) {
    setSelectedDv((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function buildLinesFromSelection() {
    setBusy(true);
    setError('');
    try {
      const draftLines: DraftLine[] = selectedDv.map((dvCode) => {
        const family = familyByDv(families, dvCode);
        const sku = family?.default_sku_code ?? skuForDvTier(dvCode, 'standard');
        return {
          dv_code: dvCode,
          sku_code: sku,
          package_tier: tierFromSku(sku),
          final_price_vnd: 0,
          reference_min: 0,
          reference_max: 0,
          scope_notes: offerScopeSummary(family, sku),
        };
      });
      const created = await createQuoteProposal(token, {
        customer_id: Number(customerId),
        lines: draftLines.map((l) => ({
          sku_code: l.sku_code,
          dv_code: l.dv_code,
          package_tier: l.package_tier,
        })),
        notes: notes.trim() || undefined,
      });
      const hydrated: DraftLine[] = (created.lines ?? []).map((line) => ({
        dv_code: line.dv_code,
        sku_code: line.sku_code ?? skuForDvTier(line.dv_code, line.package_tier),
        package_tier: (line.package_tier as DraftLine['package_tier']) ?? 'standard',
        final_price_vnd: line.final_price_vnd,
        reference_min: line.reference_price_min ?? 0,
        reference_max: line.reference_price_max ?? 0,
        scope_notes: line.scope_notes ?? '',
      }));
      setLines(hydrated.length ? hydrated : draftLines);
      setProposal(created);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo báo giá thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function saveLinesAndAdvance() {
    if (!proposal) return;
    setBusy(true);
    setError('');
    try {
      const payload: QuoteLineItem[] = lines.map((l) => ({
        dv_code: l.dv_code,
        sku_code: l.sku_code,
        package_tier: l.package_tier,
        final_price_vnd: l.final_price_vnd,
        scope_notes: l.scope_notes,
      }));
      const out = await putQuoteLines(token, proposal.id, {
        lines: payload,
        price_adjustment_reason: adjustReason.trim() || undefined,
      });
      setProposal({ ...proposal, total_vnd: out.total_vnd, lines: out.lines });
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu dòng báo giá thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onExport(format: 'pdf' | 'docx') {
    if (!proposal) return;
    setBusy(true);
    setError('');
    try {
      const blob = await exportQuoteProposal(token, proposal.id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ptt-quote-${proposal.id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      if (proposal.status === 'draft') {
        await patchQuoteStatus(token, proposal.id, { status: 'sent' });
        setProposal({ ...proposal, status: 'sent' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onAccept() {
    if (!proposal) return;
    if (!window.confirm('Chốt báo giá và tạo lifecycle cho từng DV?')) return;
    setBusy(true);
    setError('');
    try {
      const out = (await patchQuoteStatus(token, proposal.id, {
        status: 'accepted',
        spawn_week: true,
        price_adjustment_reason: adjustReason.trim() || undefined,
      })) as { proposal?: QuoteProposalDetail; lifecycles?: Array<{ lifecycle_id: number }> };
      setProposal(out.proposal ?? { ...proposal, status: 'accepted' });
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chốt báo giá thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="muted">
        Bước {step}/4 — {step === 1 ? 'Khách hàng' : step === 2 ? 'Chọn DV + SKU' : step === 3 ? 'Chỉnh giá' : 'Export / Chốt'}
      </div>
      {error ? <p className="error">{error}</p> : null}
      {comboWarnings.length ? (
        <div className="page-card" style={{ borderLeft: '4px solid #d97706' }}>
          {comboWarnings.map((w) => (
            <div key={w.dv_code} className="muted">
              {w.message_vi}
            </div>
          ))}
        </div>
      ) : null}

      {step === 1 ? (
        <section style={{ display: 'grid', gap: '0.5rem', maxWidth: 480 }}>
          <label className="muted">Khách hàng</label>
          <select className="kpi-select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            {customers.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name} {c.company ? `· ${c.company}` : ''}
              </option>
            ))}
          </select>
          <textarea
            className="kpi-input"
            rows={2}
            placeholder="Ghi chú báo giá"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button type="button" className="btn btn-sm" disabled={!customerId} onClick={() => setStep(2)}>
            Tiếp — chọn dịch vụ
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <section>
          <p className="muted">Chọn DV — mặc định SKU Tiêu chuẩn (TC) từ SPC catalog.</p>
          <div style={{ display: 'grid', gap: '0.35rem', maxHeight: 320, overflow: 'auto' }}>
            {families.map((svc) => (
              <label key={svc.dv_code} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedDv.includes(svc.dv_code)}
                  onChange={() => toggleDv(svc.dv_code)}
                />
                <span>
                  <strong>{svc.dv_code}</strong> {svc.name_vi}
                  <span className="muted"> · default {svc.default_sku_code}</span>
                  {(svc.components?.length ?? 0) > 0 ? (
                    <span className="muted"> · {svc.components.length} dịch vụ con</span>
                  ) : null}
                  {svc.readiness !== 'ready' ? <span className="muted"> · {svc.readiness}</span> : null}
                </span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStep(1)}>
              Quay lại
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy || selectedDv.length === 0}
              onClick={() => void buildLinesFromSelection()}
            >
              Tiếp — chỉnh giá
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 && proposal ? (
        <section style={{ display: 'grid', gap: '0.65rem' }}>
          {lines.map((line, index) => {
            const family = familyByDv(families, line.dv_code);
            const offer = family?.offers.find((o) => o.sku_code === line.sku_code);
            return (
              <div
                key={line.dv_code}
                style={{
                  border: '1px solid var(--border, #ddd)',
                  borderRadius: 6,
                  padding: '0.65rem',
                  display: 'grid',
                  gap: '0.35rem',
                }}
              >
                <div>
                  <strong>{line.sku_code}</strong> · {line.dv_code} {family?.name_vi}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {(['basic', 'standard', 'premium'] as const).map((tier) => (
                    <label key={tier} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <input
                        type="radio"
                        name={`tier-${line.dv_code}`}
                        checked={line.package_tier === tier}
                        onChange={() => {
                          const sku = skuForDvTier(line.dv_code, tier);
                          const fam = familyByDv(families, line.dv_code);
                          setLines((prev) => {
                            const next = [...prev];
                            next[index] = {
                              ...next[index],
                              package_tier: tier,
                              sku_code: sku,
                              scope_notes: offerScopeSummary(fam, sku),
                            };
                            return next;
                          });
                        }}
                      />
                      {QUOTE_TIER_LABEL[tier]}
                    </label>
                  ))}
                </div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  Tham khảo SPC: {line.reference_min.toLocaleString('vi-VN')} – {line.reference_max.toLocaleString('vi-VN')} VND
                </div>
                {offer?.lines?.length ? (
                  <ul className="muted" style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
                    {offer.lines.map((scopeLine) => (
                      <li key={scopeLine.line_code}>
                        {scopeLine.component_code ? (
                          <strong>{scopeLine.component_code}</strong>
                        ) : null}
                        {scopeLine.component_code ? ' · ' : ''}
                        {scopeLine.label_vi}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <input
                  className="kpi-input"
                  type="number"
                  value={line.final_price_vnd}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLines((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index], final_price_vnd: Number.isFinite(val) ? val : 0 };
                      return next;
                    });
                  }}
                />
              </div>
            );
          })}
          <input
            className="kpi-input"
            placeholder="Lý do điều chỉnh giá (nếu lệch tham khảo)"
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
          />
          <div className="muted">Tổng: {total.toLocaleString('vi-VN')} VND · Proposal #{proposal.id}</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStep(2)}>
              Quay lại
            </button>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void saveLinesAndAdvance()}>
              Tiếp — export / chốt
            </button>
          </div>
        </section>
      ) : null}

      {step === 4 && proposal ? (
        <section style={{ display: 'grid', gap: '0.65rem' }}>
          <p>
            Báo giá <strong>#{proposal.id}</strong> · {proposal.total_vnd.toLocaleString('vi-VN')} VND ·{' '}
            {proposal.status}
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {(proposal.lines ?? lines).map((l) => (
              <li key={`${l.dv_code}-${l.sku_code ?? l.package_tier}`}>
                {l.sku_code ?? l.dv_code} ({QUOTE_TIER_LABEL[l.package_tier] ?? l.package_tier}):{' '}
                {l.final_price_vnd.toLocaleString('vi-VN')} VND
                {'lifecycle_id' in l && l.lifecycle_id ? (
                  <span className="muted"> · lifecycle #{l.lifecycle_id}</span>
                ) : null}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void onExport('pdf')}>
              Export PDF
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void onExport('docx')}>
              Export DOCX
            </button>
            {proposal.status !== 'accepted' ? (
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void onAccept()}>
                Chốt → Lifecycle
              </button>
            ) : (
              <span className="muted">Đã chốt — lifecycle đã tạo.</span>
            )}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void onDone()}>
            Xong — về danh sách
          </button>
        </section>
      ) : null}
    </div>
  );
}

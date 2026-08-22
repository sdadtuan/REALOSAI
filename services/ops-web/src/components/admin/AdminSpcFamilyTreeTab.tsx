'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchSpcFamilyTree,
  formatPricingModel,
  importSpcDocBundle,
  type SpcFamilyTreeResponse,
} from '@/lib/spc-api';

export function AdminSpcFamilyTreeTab({
  dvCode,
  token,
  canImport,
  onImported,
}: {
  dvCode: string;
  token: string;
  canImport: boolean;
  onImported: () => void;
}) {
  const [tree, setTree] = useState<SpcFamilyTreeResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const reload = useCallback(async () => {
    setLoadError('');
    try {
      setTree(await fetchSpcFamilyTree(token, dvCode));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải tree thất bại');
    }
  }, [token, dvCode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function runImport() {
    if (!confirm(`Import components + bundle từ doc PTT cho ${dvCode}?`)) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await importSpcDocBundle(token, dvCode);
      setMsg(`Đã import ${res.imported} DV từ ${res.source_doc ?? 'doc PTT'}`);
      await reload();
      onImported();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Import thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <p className="error">{loadError}</p>;
  if (!tree) return <p className="muted">Đang tải tree…</p>;

  return (
    <div className="stack-gap" style={{ gap: '1rem' }}>
      <div className="page-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: '0 0 0.35rem' }}>
              {tree.dv_code} — {tree.name_vi}
            </h3>
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
              {tree.component_count} dịch vụ con · nguồn: {tree.source_doc ?? 'spc-chuan-hoa-bundle.json'}
            </p>
          </div>
          {canImport ? (
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void runImport()}>
              Import doc PTT
            </button>
          ) : null}
        </div>
        {msg ? <p style={{ margin: '0.75rem 0 0' }}>{msg}</p> : null}
      </div>

      <div className="page-card">
        <h4 style={{ margin: '0 0 0.75rem' }}>L0.5 — Dịch vụ con</h4>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {tree.components.map((c) => (
            <li key={c.component_code} style={{ marginBottom: '0.65rem' }}>
              <strong>{c.component_code}</strong> · {c.name_vi}
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                {c.deliverable_vi || c.description_vi || '—'} · {formatPricingModel(c.pricing_model)}
              </div>
            </li>
          ))}
        </ul>
        {tree.components.length === 0 ? (
          <p className="muted">Chưa có component — import doc PTT hoặc thêm ở tab Components.</p>
        ) : null}
      </div>

      <div className="page-card">
        <h4 style={{ margin: '0 0 0.75rem' }}>Gói SKU → bundle</h4>
        {tree.offers.map((offer) => (
          <div
            key={offer.sku_code}
            style={{
              borderTop: '1px solid var(--border, #e5e7eb)',
              paddingTop: '0.75rem',
              marginTop: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <strong>{offer.sku_code}</strong> · {offer.label_vi}
                <div className="muted" style={{ fontSize: '0.85rem' }}>{offer.scope_summary_vi}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="muted">Giá gói</div>
                <div>{formatPricingModel(offer.pricing_model)}</div>
              </div>
            </div>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
              {offer.bundle.length ? (
                offer.bundle.map((b) => (
                  <li key={b.component_code} style={{ marginBottom: '0.35rem' }}>
                    ✓ {b.component_code} · {b.name_vi}
                  </li>
                ))
              ) : (
                <li className="muted">Chưa map bundle</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

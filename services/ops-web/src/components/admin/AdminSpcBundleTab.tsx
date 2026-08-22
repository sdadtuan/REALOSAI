'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchSpcComponents,
  fetchSpcOfferBundle,
  fetchSpcOfferBundleAudit,
  formatPricingModel,
  putSpcOfferBundle,
  type SpcBundlePriceAudit,
  type SpcComponentRow,
  type SpcOfferRow,
} from '@/lib/spc-api';

function formatVnd(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value) + ' ₫';
}

function auditBadgeClass(status: SpcBundlePriceAudit['status']) {
  if (status === 'ok') return 'badge badge-ok';
  if (status === 'no_components') return 'badge badge-warn';
  return 'badge badge-warn';
}

export function AdminSpcBundleTab({
  dvCode,
  offers,
  token,
  canEdit,
}: {
  dvCode: string;
  offers: SpcOfferRow[];
  token: string;
  canEdit: boolean;
}) {
  const [components, setComponents] = useState<SpcComponentRow[]>([]);
  const [selectedSku, setSelectedSku] = useState('');
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [audit, setAudit] = useState<SpcBundlePriceAudit | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [loadError, setLoadError] = useState('');

  const skus = useMemo(() => offers.map((o) => o.sku_code), [offers]);
  const selectedOffer = useMemo(
    () => offers.find((o) => o.sku_code === selectedSku),
    [offers, selectedSku],
  );

  useEffect(() => {
    if (skus.length && !selectedSku) setSelectedSku(skus[0]);
  }, [skus, selectedSku]);

  const reloadComponents = useCallback(async () => {
    try {
      const res = await fetchSpcComponents(token, dvCode);
      setComponents(res.items.filter((c) => c.active));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải components thất bại');
    }
  }, [token, dvCode]);

  const reloadBundle = useCallback(async () => {
    if (!selectedSku) return;
    try {
      const bundle = await fetchSpcOfferBundle(token, selectedSku);
      const map: Record<string, boolean> = {};
      for (const c of components) map[c.component_code] = false;
      for (const item of bundle.items) {
        if (item.included) map[item.component_code] = true;
      }
      setIncluded(map);
    } catch {
      const map: Record<string, boolean> = {};
      for (const c of components) map[c.component_code] = false;
      setIncluded(map);
    }
  }, [token, selectedSku, components]);

  const reloadAudit = useCallback(async () => {
    if (!selectedSku) return;
    try {
      setAudit(await fetchSpcOfferBundleAudit(token, selectedSku));
    } catch {
      setAudit(null);
    }
  }, [token, selectedSku]);

  useEffect(() => {
    void reloadComponents();
  }, [reloadComponents]);

  useEffect(() => {
    if (components.length && selectedSku) void reloadBundle();
  }, [components, selectedSku, reloadBundle]);

  useEffect(() => {
    if (selectedSku) void reloadAudit();
  }, [selectedSku, reloadAudit]);

  async function saveBundle() {
    if (!selectedSku) return;
    setBusy(true);
    setMsg('');
    try {
      const items = components.map((c, i) => ({
        component_code: c.component_code,
        included: Boolean(included[c.component_code]),
        qty: 1,
        sort_order: i + 1,
      }));
      await putSpcOfferBundle(token, selectedSku, items);
      setMsg(`Đã lưu bundle ${selectedSku}`);
      await reloadBundle();
      await reloadAudit();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Lưu bundle thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-gap" style={{ gap: '1rem' }}>
      {loadError ? <p className="error">{loadError}</p> : null}
      {msg ? <p>{msg}</p> : null}

      <div className="page-card">
        <label>
          Gói SKU{' '}
          <select
            value={selectedSku}
            onChange={(e) => setSelectedSku(e.target.value)}
            style={{ marginLeft: '0.5rem' }}
          >
            {skus.map((sku) => (
              <option key={sku} value={sku}>
                {sku}
              </option>
            ))}
          </select>
        </label>
        <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.88rem' }}>
          Tick dịch vụ con gồm trong gói {selectedSku || '—'}.
        </p>
      </div>

      {audit ? (
        <div className="page-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <strong>Audit giá bundle</strong>
              <p className="muted" style={{ margin: '0.35rem 0 0' }}>
                {audit.message_vi}
              </p>
            </div>
            <span className={auditBadgeClass(audit.status)}>{audit.status}</span>
          </div>
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              marginTop: '0.75rem',
            }}
          >
            <div>
              <div className="muted">Giá gói (min–max)</div>
              <div>
                {formatVnd(audit.offer_min_vnd)} – {formatVnd(audit.offer_max_vnd)}
              </div>
              {selectedOffer ? (
                <div className="muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {formatPricingModel(selectedOffer.pricing_model)}
                </div>
              ) : null}
            </div>
            <div>
              <div className="muted">Tổng component (min–max)</div>
              <div>
                {formatVnd(audit.components_min_sum_vnd)} – {formatVnd(audit.components_max_sum_vnd)}
              </div>
            </div>
            <div>
              <div className="muted">Delta (gói − tổng)</div>
              <div>
                min {formatVnd(audit.delta_min_vnd)} · max {formatVnd(audit.delta_max_vnd)}
              </div>
            </div>
          </div>
          {audit.items.length ? (
            <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.25rem', fontSize: '0.88rem' }}>
              {audit.items.map((item) => (
                <li key={item.component_code}>
                  {item.component_code} · {item.name_vi}: {formatVnd(item.min_vnd)} – {formatVnd(item.max_vnd)}
                  {item.qty > 1 ? ` × ${item.qty}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {components.map((c) => (
        <label
          key={c.component_code}
          className="page-card"
          style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: canEdit ? 'pointer' : 'default' }}
        >
          <input
            type="checkbox"
            checked={Boolean(included[c.component_code])}
            disabled={!canEdit || busy}
            onChange={(e) => setIncluded((prev) => ({ ...prev, [c.component_code]: e.target.checked }))}
            style={{ marginTop: '0.25rem' }}
          />
          <div>
            <strong>{c.component_code}</strong> · {c.name_vi}
            <div className="muted" style={{ fontSize: '0.85rem' }}>{formatPricingModel(c.pricing_model)}</div>
          </div>
        </label>
      ))}

      {components.length === 0 ? (
        <p className="muted">Thêm dịch vụ con ở tab Components trước khi lắp bundle.</p>
      ) : null}

      {canEdit && components.length > 0 ? (
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !selectedSku} onClick={() => void saveBundle()}>
          Lưu bundle {selectedSku}
        </button>
      ) : null}
    </div>
  );
}

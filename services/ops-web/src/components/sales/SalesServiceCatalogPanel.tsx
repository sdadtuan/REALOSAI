'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  fetchQuoteCatalog,
  type QuoteCatalogFamily,
} from '@/lib/quote-api';
import {
  filterSalesCatalog,
  flattenQuoteCatalog,
  groupSkusByFamily,
  readinessLabel,
  type SalesCatalogSkuRow,
} from '@/lib/sales-service-catalog';

type CartItem = {
  sku_code: string;
  dv_code: string;
  name_vi: string;
  service_slug: string;
};

type Props = {
  token: string;
  families: QuoteCatalogFamily[];
  customers: Array<{ id: number; name?: string; company_name?: string }>;
  initialCustomerId?: string;
  leadId?: number | null;
};

export function SalesServiceCatalogPanel({
  token,
  families: initialFamilies,
  customers,
  initialCustomerId = '',
  leadId,
}: Props) {
  const router = useRouter();
  const [families, setFamilies] = useState(initialFamilies);
  const [query, setQuery] = useState('');
  const [readiness, setReadiness] = useState<'all' | 'ready' | 'partial' | 'gap'>('all');
  const [tier, setTier] = useState<'all' | 'CB' | 'TC' | 'CS'>('all');
  const [view, setView] = useState<'family' | 'sku'>('family');
  const [selectedDv, setSelectedDv] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [reloadError, setReloadError] = useState('');

  const allRows = useMemo(() => flattenQuoteCatalog(families), [families]);
  const filtered = useMemo(
    () => filterSalesCatalog(allRows, { query, readiness, tier }),
    [allRows, query, readiness, tier],
  );
  const grouped = useMemo(() => groupSkusByFamily(filtered), [filtered]);
  const familyList = useMemo(() => {
    const codes = [...grouped.keys()];
    return codes
      .map((code) => {
        const skus = grouped.get(code) ?? [];
        return { dv_code: code, name_vi: skus[0]?.name_vi ?? code, skus };
      })
      .sort((a, b) => a.dv_code.localeCompare(b.dv_code));
  }, [grouped]);

  const detailFamily = selectedDv
    ? familyList.find((f) => f.dv_code === selectedDv) ?? null
    : familyList[0] ?? null;

  function toggleCart(row: SalesCatalogSkuRow) {
    setCart((prev) => {
      const exists = prev.find((c) => c.sku_code === row.sku_code);
      if (exists) return prev.filter((c) => c.sku_code !== row.sku_code);
      return [
        ...prev,
        {
          sku_code: row.sku_code,
          dv_code: row.dv_code,
          name_vi: row.name_vi,
          service_slug: row.service_slug,
        },
      ];
    });
  }

  function buildQuoteHref(dvCodes: string[], slugs: string[]) {
    const params = new URLSearchParams();
    params.set('wizard', '1');
    if (customerId) params.set('customer_id', customerId);
    if (leadId && leadId > 0) params.set('lead_id', String(leadId));
    if (dvCodes.length) params.set('prefill_dv', [...new Set(dvCodes)].join(','));
    if (slugs.length) params.set('service_slugs', [...new Set(slugs)].join(','));
    const notes = cart.map((c) => c.sku_code).join(', ');
    if (notes) params.set('notes', `SKU: ${notes}`);
    return `/crm/proposals?${params.toString()}`;
  }

  function openQuoteBuilder(rows: SalesCatalogSkuRow[]) {
    if (!customerId && customers.length) {
      setCustomerId(String(customers[0].id));
    }
    const dvCodes = rows.map((r) => r.dv_code);
    const slugs = rows.map((r) => r.service_slug);
    router.push(buildQuoteHref(dvCodes, slugs));
  }

  async function reloadCatalog() {
    setReloadError('');
    try {
      const data = await fetchQuoteCatalog(token);
      setFamilies(data.families ?? []);
    } catch (err) {
      setReloadError(err instanceof Error ? err.message : 'Tải catalog thất bại');
    }
  }

  return (
    <div className="stack-gap" style={{ gap: '1rem' }}>
      <div className="page-card" style={{ padding: '1rem' }}>
        <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem' }}>Tra cứu dịch vụ bán hàng</h2>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Tìm theo tên, mã DV, SKU, phạm vi (logo, Facebook, SEO…). Giá tham chiếu từ SPC — AM chốt trên Quote Builder.
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginTop: '0.85rem',
            alignItems: 'center',
          }}
        >
          <input
            type="search"
            autoFocus
            placeholder="Tìm dịch vụ: logo, brand, content, DV02, quảng cáo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: '1 1 280px',
              padding: '0.6rem 0.75rem',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
            }}
          />
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            style={{
              minWidth: 200,
              padding: '0.55rem 0.65rem',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
            }}
          >
            <option value="">Chọn khách hàng (báo giá)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} · {c.company_name || c.name || 'Khách'}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void reloadCatalog()}>
            Tải lại
          </button>
        </div>
        {reloadError ? <p className="error" style={{ marginTop: '0.5rem' }}>{reloadError}</p> : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.65rem' }}>
          {(['all', 'ready', 'partial'] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={readiness === r ? 'btn btn-sm' : 'btn btn-sm btn-secondary'}
              onClick={() => setReadiness(r)}
            >
              {r === 'all' ? 'Mọi readiness' : readinessLabel(r)}
            </button>
          ))}
          {(['all', 'CB', 'TC', 'CS'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={tier === t ? 'btn btn-sm' : 'btn btn-sm btn-secondary'}
              onClick={() => setTier(t)}
            >
              {t === 'all' ? 'Mọi gói' : t}
            </button>
          ))}
          <button
            type="button"
            className={view === 'family' ? 'btn btn-sm' : 'btn btn-sm btn-secondary'}
            onClick={() => setView('family')}
          >
            Theo DV
          </button>
          <button
            type="button"
            className={view === 'sku' ? 'btn btn-sm' : 'btn btn-sm btn-secondary'}
            onClick={() => setView('sku')}
          >
            Theo SKU
          </button>
        </div>
        <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
          {filtered.length} SKU · {familyList.length} DV · {allRows.length} tổng catalog
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 1fr)',
          gap: '1rem',
          alignItems: 'start',
        }}
      >
        <div className="page-card" style={{ padding: 0, overflow: 'hidden' }}>
          {view === 'sku' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem 0.75rem' }}>SKU</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Dịch vụ</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Gói</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Giá ref.</th>
                  <th style={{ padding: '0.6rem 0.75rem' }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const inCart = cart.some((c) => c.sku_code === row.sku_code);
                  return (
                    <tr
                      key={row.sku_code}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: inCart ? 'rgba(37, 99, 235, 0.06)' : undefined,
                      }}
                    >
                      <td style={{ padding: '0.55rem 0.75rem' }}>
                        <strong>{row.sku_code}</strong>
                      </td>
                      <td style={{ padding: '0.55rem 0.75rem' }}>
                        <div>{row.name_vi}</div>
                        <div className="muted" style={{ fontSize: '0.8rem' }}>{row.scope_summary_vi}</div>
                      </td>
                      <td style={{ padding: '0.55rem 0.75rem' }}>{row.tier_label}</td>
                      <td style={{ padding: '0.55rem 0.75rem', fontSize: '0.82rem' }}>{row.pricing_label}</td>
                      <td style={{ padding: '0.55rem 0.75rem' }}>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => toggleCart(row)}>
                          {inCart ? 'Bỏ' : '+ Giỏ'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div>
              {familyList.map((fam) => (
                <div key={fam.dv_code} style={{ borderBottom: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedDv(fam.dv_code)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.75rem 1rem',
                      border: 'none',
                      background:
                        detailFamily?.dv_code === fam.dv_code ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                      color: 'var(--text)',
                      cursor: 'pointer',
                    }}
                  >
                    <strong>{fam.dv_code}</strong> · {fam.name_vi}
                    <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                      {fam.skus.length} gói · {readinessLabel(fam.skus[0]?.readiness ?? '')}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
          {filtered.length === 0 ? (
            <p className="muted" style={{ padding: '1rem' }}>Không tìm thấy dịch vụ phù hợp.</p>
          ) : null}
        </div>

        <aside className="page-card" style={{ padding: '1rem' }}>
          {detailFamily ? (
            <>
              <h3 style={{ margin: '0 0 0.35rem' }}>
                {detailFamily.dv_code} · {detailFamily.name_vi}
              </h3>
              <p className="muted" style={{ margin: '0 0 0.75rem', fontSize: '0.85rem' }}>
                Slug: {detailFamily.skus[0]?.service_slug}
                {detailFamily.skus[0]?.depends_on_dv?.length ? (
                  <> · Phụ thuộc: {detailFamily.skus[0].depends_on_dv.join(', ')}</>
                ) : null}
              </p>
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                {detailFamily.skus.map((row) => {
                  const inCart = cart.some((c) => c.sku_code === row.sku_code);
                  return (
                    <div
                      key={row.sku_code}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '0.65rem 0.75rem',
                        background: inCart ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <strong>{row.sku_code}</strong>
                        <span className="muted">{row.tier_label}</span>
                      </div>
                      <div style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>{row.scope_summary_vi}</div>
                      <div className="muted" style={{ fontSize: '0.82rem', marginTop: '0.35rem' }}>
                        {row.pricing_label}
                      </div>
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => toggleCart(row)}>
                          {inCart ? 'Đã chọn' : 'Chọn gói'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => openQuoteBuilder([row])}
                        >
                          Báo giá
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '0.75rem', width: '100%' }}
                onClick={() => openQuoteBuilder(detailFamily.skus)}
              >
                Báo giá cả {detailFamily.dv_code} (3 gói)
              </button>
            </>
          ) : (
            <p className="muted">Chọn một DV để xem gói CB / TC / CS.</p>
          )}
        </aside>
      </div>

      {cart.length > 0 ? (
        <div
          className="page-card"
          style={{
            padding: '0.85rem 1rem',
            position: 'sticky',
            bottom: '0.5rem',
            border: '1px solid var(--accent, #2563eb)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          <strong>Giỏ báo giá ({cart.length})</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', margin: '0.5rem 0' }}>
            {cart.map((item) => (
              <span
                key={item.sku_code}
                style={{
                  fontSize: '0.85rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 999,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                }}
              >
                {item.sku_code}
                <button
                  type="button"
                  aria-label={`Xóa ${item.sku_code}`}
                  onClick={() => setCart((prev) => prev.filter((c) => c.sku_code !== item.sku_code))}
                  style={{
                    marginLeft: '0.35rem',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--muted)',
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link
              href={buildQuoteHref(
                cart.map((c) => c.dv_code),
                cart.map((c) => c.service_slug),
              )}
              className="btn btn-sm"
            >
              Mở Quote Builder ({cart.length} SKU)
            </Link>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setCart([])}>
              Xóa giỏ
            </button>
          </div>
          {!customerId ? (
            <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.82rem' }}>
              Chọn khách hàng phía trên trước khi tạo báo giá.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

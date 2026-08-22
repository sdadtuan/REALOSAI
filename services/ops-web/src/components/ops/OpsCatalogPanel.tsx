'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { OpsCatalogService } from '@/lib/ops-dv-api';

function readinessLabel(r: string): string {
  if (r === 'ready') return 'Sẵn sàng';
  if (r === 'partial') return 'Một phần';
  if (r === 'gap') return 'Gap';
  return r;
}

function tierPriceSummary(pricing: Record<string, unknown> | undefined): string {
  if (!pricing || typeof pricing !== 'object') return '—';
  const standard = pricing.standard as Record<string, unknown> | undefined;
  const min = standard?.min_vnd ?? pricing.min_vnd;
  const max = standard?.max_vnd ?? pricing.max_vnd;
  if (min != null && max != null) {
    return `${Number(min).toLocaleString('vi-VN')} – ${Number(max).toLocaleString('vi-VN')} ₫`;
  }
  return 'Theo báo giá';
}

interface Props {
  services: OpsCatalogService[];
}

export function OpsCatalogPanel({ services }: Props) {
  const [query, setQuery] = useState('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.dv_code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.service_slug.toLowerCase().includes(q),
    );
  }, [query, services]);

  const selected = services.find((s) => s.dv_code === selectedCode) ?? null;
  const comboSuggestions = useMemo(() => {
    if (!selected?.depends_on_dv?.length) return [];
    return selected.depends_on_dv
      .map((code) => services.find((s) => s.dv_code === code))
      .filter(Boolean) as OpsCatalogService[];
  }, [selected, services]);

  const upsellCandidates = useMemo(() => {
    if (!selected) return [];
    return services.filter(
      (s) =>
        s.dv_code !== selected.dv_code &&
        (s.depends_on_dv ?? []).includes(selected.dv_code),
    );
  }, [selected, services]);

  return (
    <div className="stack-gap" style={{ gap: '1rem' }}>
      <div className="page-card" style={{ padding: '0.85rem 1rem', borderLeft: '4px solid var(--accent, #2563eb)' }}>
        <strong>Catalog read-only</strong>
        <span className="muted" style={{ marginLeft: '0.5rem' }}>
          SKU published từ SPC. Chỉnh giá / scope →{' '}
          <Link href="/admin/services/portfolio">Admin Dịch vụ & Catalog</Link>
        </span>
      </div>
      <div className="card" style={{ padding: '1rem' }}>
        <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem' }}>Catalog DV01–DV21</h2>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          AM tra cứu profile dịch vụ, gói giá tham chiếu và combo phụ thuộc khi tư vấn khách.
        </p>
        <input
          type="search"
          placeholder="Tìm DV, tên dịch vụ, slug…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            marginTop: '0.75rem',
            width: '100%',
            maxWidth: 420,
            padding: '0.55rem 0.75rem',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
          }}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)',
          gap: '1rem',
          alignItems: 'start',
        }}
      >
        <div
          className="card"
          style={{
            padding: 0,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '0.65rem 0.75rem' }}>DV</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Dịch vụ</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Readiness</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Giá ref.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.dv_code}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: selectedCode === s.dv_code ? 'rgba(57, 139, 67, 0.06)' : undefined,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedCode(s.dv_code)}
                >
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>{s.dv_code}</td>
                  <td style={{ padding: '0.65rem 0.75rem' }}>
                    <div>{s.name}</div>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>{s.service_slug}</div>
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem' }}>{readinessLabel(s.readiness)}</td>
                  <td style={{ padding: '0.65rem 0.75rem' }}>{tierPriceSummary(s.tier_pricing)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card stack-gap" style={{ padding: '1rem', gap: '0.75rem' }}>
          {selected ? (
            <>
              <div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>{selected.dv_code}</div>
                <h3 style={{ margin: '0.15rem 0 0', fontSize: '1rem' }}>{selected.name}</h3>
              </div>
              <dl style={{ margin: 0, display: 'grid', gap: '0.45rem', fontSize: '0.88rem' }}>
                <div>
                  <dt className="muted">Slug RNOSAI</dt>
                  <dd style={{ margin: '0.1rem 0 0' }}>{selected.service_slug}</dd>
                </div>
                <div>
                  <dt className="muted">Gói</dt>
                  <dd style={{ margin: '0.1rem 0 0' }}>
                    {(selected.package_tiers ?? ['basic', 'standard', 'premium']).join(' · ')}
                  </dd>
                </div>
                <div>
                  <dt className="muted">Giá tham chiếu (Standard)</dt>
                  <dd style={{ margin: '0.1rem 0 0' }}>{tierPriceSummary(selected.tier_pricing)}</dd>
                </div>
                {(selected.skus?.length ?? 0) > 0 ? (
                  <div>
                    <dt className="muted">SKU published (SPC)</dt>
                    <dd style={{ margin: '0.1rem 0 0' }}>
                      <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                        {selected.skus!.map((sku) => (
                          <li key={sku.sku_code}>
                            <strong>{sku.sku_code}</strong> — {sku.label_vi}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ) : null}
              </dl>

              {comboSuggestions.length > 0 ? (
                <div>
                  <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.92rem' }}>Combo gợi ý (phụ thuộc)</h4>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.88rem' }}>
                    {comboSuggestions.map((c) => (
                      <li key={c.dv_code}>
                        {c.dv_code} — {c.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {upsellCandidates.length > 0 ? (
                <div>
                  <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.92rem' }}>Upsell sau {selected.dv_code}</h4>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.88rem' }}>
                    {upsellCandidates.map((c) => (
                      <li key={c.dv_code}>
                        {c.dv_code} — {c.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Link href={`/crm/proposals?service_slugs=${encodeURIComponent(selected.service_slug)}`} className="btn btn-sm">
                Tạo báo giá với slug này
              </Link>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Chọn một dòng DV để xem combo tư vấn và link báo giá.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

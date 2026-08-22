'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import { AdminSpcBundleTab } from '@/components/admin/AdminSpcBundleTab';
import { AdminSpcComponentsTab } from '@/components/admin/AdminSpcComponentsTab';
import { AdminSpcFamilyTreeTab } from '@/components/admin/AdminSpcFamilyTreeTab';
import {
  applyPricingField,
  fetchSpcFamily,
  formatPricingModel,
  patchSpcOffer,
  pricingModelFields,
  publishSpcEntity,
  type SpcFamilyDetail,
  type SpcOfferRow,
  type SpcPricingModel,
} from '@/lib/spc-api';
import {
  canEditSpc,
  canPublishSpc,
  canViewSpcAdmin,
  useAdminCrmAuth,
} from '@/lib/admin/use-admin-crm-auth';

type FamilyTab = 'skus' | 'components' | 'bundle' | 'tree';

function OfferEditor({
  offer,
  canEdit,
  canPublish,
  token,
  onSaved,
}: {
  offer: SpcOfferRow;
  canEdit: boolean;
  canPublish: boolean;
  token: string;
  onSaved: () => void;
}) {
  const [pricing, setPricing] = useState<SpcPricingModel>(offer.pricing_model ?? {});
  const [scope, setScope] = useState(offer.scope_summary_vi ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const basePricing =
      offer.draft_pricing_model && Object.keys(offer.draft_pricing_model).length
        ? offer.draft_pricing_model
        : offer.pricing_model ?? {};
    setPricing(basePricing);
    setScope(offer.draft_scope_summary_vi ?? offer.scope_summary_vi ?? '');
  }, [offer]);

  const fields = useMemo(() => pricingModelFields(pricing), [pricing]);

  async function saveDraft() {
    setBusy(true);
    setMsg('');
    try {
      await patchSpcOffer(token, offer.sku_code, {
        scope_summary_vi: scope,
        pricing_model: pricing,
      });
      setMsg('Đã lưu draft — AM vẫn thấy bản published cho đến khi IT publish.');
      onSaved();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setMsg('');
    try {
      await publishSpcEntity(token, 'offer', offer.sku_code);
      setMsg('Đã publish — ops_service_profile tier_pricing đã sync.');
      onSaved();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Publish thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: '0 0 0.25rem' }}>
            {offer.sku_code} · {offer.tier}
          </h3>
          <p className="muted" style={{ margin: 0 }}>
            {offer.label_vi} · v{offer.published_version} ·{' '}
            <span className={offer.has_pending_draft || offer.status === 'draft' ? 'badge badge-warn' : 'badge badge-ok'}>
              {offer.has_pending_draft ? 'draft pending' : offer.status}
            </span>
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="muted">Giá hiện tại (published view)</div>
          <div>{formatPricingModel(offer.pricing_model)}</div>
        </div>
      </div>

      <label style={{ display: 'block', marginTop: '1rem' }}>
        <span className="muted">Phạm vi / scope summary</span>
        <textarea
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          disabled={!canEdit || busy}
          rows={3}
          style={{ width: '100%', marginTop: '0.35rem' }}
        />
      </label>

      {fields.length ? (
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginTop: '1rem' }}>
          {fields.map((field) => (
            <label key={field.key}>
              <span className="muted">{field.label}</span>
              <input
                type="number"
                value={field.value}
                disabled={!canEdit || busy}
                onChange={(e) =>
                  setPricing((prev) => applyPricingField(prev, field.key, Number(e.target.value)))
                }
                style={{ width: '100%', marginTop: '0.35rem' }}
              />
            </label>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: '1rem' }}>
          Pricing type: {String(pricing.type ?? 'unknown')}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        {canEdit ? (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveDraft()}>
            Lưu draft
          </button>
        ) : null}
        {canPublish ? (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void publish()}>
            Publish SKU
          </button>
        ) : null}
      </div>
      {msg ? <p style={{ marginTop: '0.75rem' }}>{msg}</p> : null}
    </div>
  );
}

export default function AdminServicesFamilyPage() {
  const params = useParams<{ dvCode: string }>();
  const dvCode = String(params?.dvCode ?? '').toUpperCase();
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewSpcAdmin);
  const [family, setFamily] = useState<SpcFamilyDetail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<FamilyTab>('skus');

  const reload = useCallback(async () => {
    if (!token || !dvCode) return;
    setLoadError('');
    try {
      setFamily(await fetchSpcFamily(token, dvCode));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải DV thất bại');
    }
  }, [token, dvCode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const canEdit = canEditSpc(user);
  const canPublish = canPublishSpc(user);

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      title={family ? `${family.dv_code} — ${family.name_vi}` : dvCode}
      subtitle="SKU · dịch vụ con (components) · bundle gói CB/TC/CS"
      section="crm-config"
      loading={loading}
      breadcrumb={[
        { label: 'Quản trị hệ thống', href: '/admin' },
        { label: 'Dịch vụ & Catalog', href: '/admin/services' },
        { label: 'Portfolio', href: '/admin/services/portfolio' },
        { label: dvCode },
      ]}
    >
      {error ? <p className="error">{error}</p> : null}
      {loadError ? <p className="error">{loadError}</p> : null}
      {family ? (
        <>
          <div className="page-card" style={{ marginBottom: '1rem' }}>
            <p className="muted" style={{ margin: 0 }}>
              {family.department} · {family.service_type} · {family.phase_count} phases · {family.kpi_count} KPI
              {typeof family.component_count === 'number' ? ` · ${family.component_count} components` : ''}
            </p>
            <p style={{ margin: '0.5rem 0 0' }}>{family.description_vi || family.role_vi || '—'}</p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {(
              [
                ['tree', 'Tree doc'],
                ['skus', 'SKU & giá'],
                ['components', 'Components'],
                ['bundle', 'Bundle gói'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'skus'
            ? (family.offers ?? []).map((offer) => (
                <OfferEditor
                  key={offer.sku_code}
                  offer={offer}
                  canEdit={canEdit}
                  canPublish={canPublish}
                  token={token ?? ''}
                  onSaved={() => void reload()}
                />
              ))
            : null}

          {tab === 'components' && token ? (
            <AdminSpcComponentsTab
              dvCode={dvCode}
              token={token}
              canEdit={canEdit}
              canPublish={canPublish}
              onChanged={() => void reload()}
            />
          ) : null}

          {tab === 'tree' && token ? (
            <AdminSpcFamilyTreeTab
              dvCode={dvCode}
              token={token}
              canImport={canPublish}
              onImported={() => void reload()}
            />
          ) : null}

          {tab === 'bundle' && token ? (
            <AdminSpcBundleTab
              dvCode={dvCode}
              offers={family.offers ?? []}
              token={token}
              canEdit={canEdit}
            />
          ) : null}
        </>
      ) : null}
    </AdminPageShell>
  );
}

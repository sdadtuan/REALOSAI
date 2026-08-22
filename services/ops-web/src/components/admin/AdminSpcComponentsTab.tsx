'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyPricingField,
  archiveSpcComponent,
  createSpcComponent,
  fetchSpcComponents,
  formatPricingModel,
  patchSpcComponent,
  pricingModelFields,
  publishSpcEntity,
  type SpcComponentRow,
  type SpcPricingModel,
} from '@/lib/spc-api';

function componentDraftPricing(row: SpcComponentRow): SpcPricingModel {
  if (row.draft_pricing_model && Object.keys(row.draft_pricing_model).length) {
    return row.draft_pricing_model;
  }
  return row.pricing_model ?? { type: 'one_time', min_vnd: 0, max_vnd: 0 };
}

function ComponentEditor({
  row,
  canEdit,
  canPublish,
  token,
  onSaved,
}: {
  row: SpcComponentRow;
  canEdit: boolean;
  canPublish: boolean;
  token: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState(row.name_vi);
  const [description, setDescription] = useState(row.description_vi);
  const [deliverable, setDeliverable] = useState(row.deliverable_vi);
  const [pricing, setPricing] = useState<SpcPricingModel>(componentDraftPricing(row));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setName(row.draft_name_vi ?? row.name_vi);
    setDescription(row.draft_description_vi ?? row.description_vi);
    setDeliverable(row.draft_deliverable_vi ?? row.deliverable_vi);
    setPricing(componentDraftPricing(row));
  }, [row]);

  const fields = useMemo(() => pricingModelFields(pricing), [pricing]);

  async function saveDraft() {
    setBusy(true);
    setMsg('');
    try {
      await patchSpcComponent(token, row.component_code, {
        name_vi: name,
        description_vi: description,
        deliverable_vi: deliverable,
        pricing_model: pricing,
      });
      setMsg('Đã lưu draft — catalog công khai vẫn dùng bản published.');
      setEditing(false);
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
      await publishSpcEntity(token, 'component', row.component_code);
      setMsg('Đã publish component.');
      setEditing(false);
      onSaved();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Publish thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h4 style={{ margin: '0 0 0.25rem' }}>{row.component_code}</h4>
          <p className="muted" style={{ margin: 0 }}>
            v{row.published_version ?? 0} ·{' '}
            <span
              className={
                row.has_pending_draft || row.status === 'draft' ? 'badge badge-warn' : 'badge badge-ok'
              }
            >
              {row.has_pending_draft ? 'draft pending' : row.status ?? 'draft'}
            </span>
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="muted">Giá published</div>
          <div>{formatPricingModel(row.pricing_model)}</div>
        </div>
      </div>

      {editing ? (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', marginTop: '0.75rem' }}
            disabled={busy}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Mô tả"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={busy}
          />
          <input
            value={deliverable}
            onChange={(e) => setDeliverable(e.target.value)}
            placeholder="Deliverable"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={busy}
          />
          <div
            style={{
              display: 'grid',
              gap: '0.5rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              marginTop: '0.75rem',
            }}
          >
            {fields.map((f) => (
              <label key={f.key}>
                <span className="muted">{f.label}</span>
                <input
                  type="number"
                  value={f.value}
                  disabled={busy}
                  onChange={(e) =>
                    setPricing((prev) => applyPricingField(prev, f.key, Number(e.target.value)))
                  }
                  style={{ width: '100%' }}
                />
              </label>
            ))}
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {canEdit ? (
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveDraft()}>
                Lưu draft
              </button>
            ) : null}
            {canPublish ? (
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void publish()}>
                Publish
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              Hủy
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: '0.75rem 0 0' }}>
            <strong>{row.name_vi}</strong>
          </p>
          <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
            {row.description_vi || '—'}
          </p>
          {row.deliverable_vi ? (
            <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              Deliverable: {row.deliverable_vi}
            </p>
          ) : null}
          {canEdit ? (
            <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditing(true)}>
                Sửa
              </button>
            </div>
          ) : null}
        </>
      )}
      {msg ? <p style={{ marginTop: '0.65rem' }}>{msg}</p> : null}
    </div>
  );
}

export function AdminSpcComponentsTab({
  dvCode,
  token,
  canEdit,
  canPublish,
  onChanged,
}: {
  dvCode: string;
  token: string;
  canEdit: boolean;
  canPublish: boolean;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<SpcComponentRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [newName, setNewName] = useState('');

  const reload = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetchSpcComponents(token, dvCode);
      setItems(res.items.filter((c) => c.active));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải components thất bại');
    }
  }, [token, dvCode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function addComponent() {
    if (!newName.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      await createSpcComponent(token, {
        dv_code: dvCode,
        name_vi: newName.trim(),
        pricing_model: { type: 'one_time', min_vnd: 0, max_vnd: 0 },
      });
      setNewName('');
      setMsg('Đã thêm dịch vụ con (draft) — publish để lên catalog.');
      await reload();
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Thêm thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function removeComponent(code: string) {
    if (!confirm(`Ẩn (archive) ${code}?`)) return;
    setBusy(true);
    try {
      await archiveSpcComponent(token, code);
      await reload();
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Archive thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-gap" style={{ gap: '1rem' }}>
      {loadError ? <p className="error">{loadError}</p> : null}
      {msg ? <p>{msg}</p> : null}

      {canEdit ? (
        <div className="page-card" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tên dịch vụ con mới (VD: Thiết kế Logo)"
            style={{ flex: 1, minWidth: 220 }}
            disabled={busy}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || !newName.trim()}
            onClick={() => void addComponent()}
          >
            + Thêm component
          </button>
        </div>
      ) : null}

      {items.map((row) => (
        <div key={row.component_code}>
          <ComponentEditor
            row={row}
            canEdit={canEdit}
            canPublish={canPublish}
            token={token}
            onSaved={() => {
              void reload();
              onChanged();
            }}
          />
          {canEdit ? (
            <div style={{ marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy}
                onClick={() => void removeComponent(row.component_code)}
              >
                Ẩn {row.component_code}
              </button>
            </div>
          ) : null}
        </div>
      ))}
      {items.length === 0 ? (
        <p className="muted">Chưa có dịch vụ con — thêm component để lắp gói CB/TC/CS.</p>
      ) : null}
    </div>
  );
}

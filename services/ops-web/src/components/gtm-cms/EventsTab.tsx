'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createCmsEvent,
  fetchCmsEvents,
  fetchCmsMedia,
  patchCmsEvent,
  publishCmsEvent,
  unpublishCmsEvent,
  buildPublishBody,
  type CmsEventKind,
  type CmsEventRow,
  type CmsEventStatus,
  type CmsLocationType,
  type CmsCtaType,
  type CmsMediaRow,
} from '@/lib/gtm/cms-api';
import { canPublishGtmCms, canWriteGtmCms } from '@/lib/gtm/caps';
import type { StoredStaffUser } from '@/lib/auth';
import { getAccessToken } from '@/lib/auth';

type EventsTabProps = {
  user: StoredStaffUser;
  onToast: (msg: string) => void;
};

const KINDS: CmsEventKind[] = ['webinar', 'workshop', 'meetup', 'conference', 'other'];
const STATUSES: CmsEventStatus[] = ['draft', 'published', 'cancelled', 'archived'];
const LOCATION_TYPES: CmsLocationType[] = ['online', 'offline', 'hybrid'];
const CTA_TYPES: CmsCtaType[] = ['demo', 'url'];

function emptyEvent(): Partial<CmsEventRow> & {
  slug: string;
  kind: CmsEventKind;
  title_vi: string;
  dek_vi: string;
  body_vi: string;
  start_at: string;
  end_at: string;
  location_type: CmsLocationType;
  cta_type: CmsCtaType;
} {
  const start = new Date();
  start.setDate(start.getDate() + 7);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);
  return {
    slug: '',
    kind: 'webinar',
    start_at: start.toISOString().slice(0, 16),
    end_at: end.toISOString().slice(0, 16),
    timezone: 'Asia/Ho_Chi_Minh',
    location_type: 'online',
    title_vi: '',
    title_en: '',
    dek_vi: '',
    dek_en: '',
    body_vi: '',
    body_en: '',
    location_vi: '',
    location_en: '',
    cover_media_id: null,
    cta_type: 'demo',
    cta_url: null,
  };
}

export function EventsTab({ user, onToast }: EventsTabProps) {
  const canWrite = canWriteGtmCms(user);
  const canPublish = canPublishGtmCms(user);
  const [rows, setRows] = useState<CmsEventRow[]>([]);
  const [media, setMedia] = useState<CmsMediaRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<CmsEventStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<(Partial<CmsEventRow> & { id?: string }) | null>(null);
  const [publishEn, setPublishEn] = useState(false);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const [eventRes, mediaRows] = await Promise.all([
        fetchCmsEvents(token, { status: filterStatus || undefined, limit: 100 }),
        fetchCmsMedia(token, { limit: 200 }),
      ]);
      setRows(eventRes.rows);
      setMedia(mediaRows.filter((m) => m.status === 'active'));
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Tải sự kiện thất bại');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, onToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveEvent() {
    if (!editing || !canWrite) return;
    const token = getAccessToken();
    if (!token) return;
    if (!editing.slug?.trim() || !editing.title_vi?.trim() || !editing.dek_vi?.trim() || !editing.body_vi?.trim()) {
      onToast('Slug, title VI, dek VI, body VI là bắt buộc');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        slug: editing.slug.trim(),
        kind: editing.kind ?? 'webinar',
        start_at: new Date(editing.start_at ?? '').toISOString(),
        end_at: new Date(editing.end_at ?? '').toISOString(),
        timezone: editing.timezone ?? 'Asia/Ho_Chi_Minh',
        location_type: editing.location_type ?? 'online',
        location_vi: editing.location_vi?.trim() || null,
        location_en: editing.location_en?.trim() || null,
        title_vi: editing.title_vi.trim(),
        title_en: editing.title_en?.trim() || null,
        dek_vi: editing.dek_vi.trim(),
        dek_en: editing.dek_en?.trim() || null,
        body_vi: editing.body_vi.trim(),
        body_en: editing.body_en?.trim() || null,
        cover_media_id: editing.cover_media_id || null,
        cta_type: editing.cta_type ?? 'demo',
        cta_url: editing.cta_url?.trim() || null,
      };
      if (editing.id) {
        await patchCmsEvent(token, editing.id, payload);
        onToast('Đã cập nhật sự kiện');
      } else {
        await createCmsEvent(token, payload);
        onToast('Đã tạo sự kiện');
      }
      setEditing(null);
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Lưu sự kiện thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish(id: string) {
    if (!canPublish) return;
    const token = getAccessToken();
    if (!token) return;
    setBusy(true);
    try {
      await publishCmsEvent(token, id, buildPublishBody({ publishEn }));
      onToast('Đã publish');
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Publish thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnpublish(id: string) {
    if (!canPublish) return;
    const token = getAccessToken();
    if (!token) return;
    setBusy(true);
    try {
      await unpublishCmsEvent(token, id);
      onToast('Đã unpublish');
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Unpublish thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !rows.length) return <p className="muted">Đang tải sự kiện…</p>;

  return (
    <div className="stack-gap">
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
        <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
          Status
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as CmsEventStatus | '')}>
            <option value="">Tất cả</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {canWrite ? (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setEditing(emptyEvent())}>
            + Sự kiện mới
          </button>
        ) : null}
      </div>

      {editing ? (
        <EventEditor
          editing={editing}
          media={media}
          publishEn={publishEn}
          busy={busy}
          canWrite={canWrite}
          onChange={setEditing}
          onPublishEnChange={setPublishEn}
          onCancel={() => setEditing(null)}
          onSave={() => void saveEvent()}
        />
      ) : null}

      <div className="data-table-wrap">
        <table className="data-table data-table--dense">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Title VI</th>
              <th>Kind</th>
              <th>Start</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.slug}</td>
                <td>{row.title_vi}</td>
                <td>{row.kind}</td>
                <td className="muted">{new Date(row.start_at).toLocaleString('vi-VN')}</td>
                <td>{row.status}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {canWrite ? (
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(row)}>
                        Sửa
                      </button>
                    ) : null}
                    {canPublish && row.status !== 'published' ? (
                      <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void handlePublish(row.id)}>
                        Publish
                      </button>
                    ) : null}
                    {canPublish && row.status === 'published' ? (
                      <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void handleUnpublish(row.id)}>
                        Unpublish
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="muted">
                  Chưa có sự kiện
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventEditor({
  editing,
  media,
  publishEn,
  busy,
  canWrite,
  onChange,
  onPublishEnChange,
  onCancel,
  onSave,
}: {
  editing: Partial<CmsEventRow> & { id?: string };
  media: CmsMediaRow[];
  publishEn: boolean;
  busy: boolean;
  canWrite: boolean;
  onChange: (v: Partial<CmsEventRow> & { id?: string }) => void;
  onPublishEnChange: (v: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<CmsEventRow>) => onChange({ ...editing, ...patch });

  return (
    <div className="page-card stack-gap">
      <strong>{editing.id ? 'Sửa sự kiện' : 'Sự kiện mới'}</strong>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
          Slug
          <input value={editing.slug ?? ''} onChange={(e) => set({ slug: e.target.value })} disabled={!!editing.id} />
        </label>
        <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
          Kind
          <select value={editing.kind ?? 'webinar'} onChange={(e) => set({ kind: e.target.value as CmsEventKind })}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
          Location type
          <select
            value={editing.location_type ?? 'online'}
            onChange={(e) => set({ location_type: e.target.value as CmsLocationType })}
          >
            {LOCATION_TYPES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
          Start
          <input type="datetime-local" value={editing.start_at?.slice(0, 16) ?? ''} onChange={(e) => set({ start_at: e.target.value })} />
        </label>
        <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
          End
          <input type="datetime-local" value={editing.end_at?.slice(0, 16) ?? ''} onChange={(e) => set({ end_at: e.target.value })} />
        </label>
        <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
          Cover media
          <select value={editing.cover_media_id ?? ''} onChange={(e) => set({ cover_media_id: e.target.value || null })}>
            <option value="">—</option>
            {media.map((m) => (
              <option key={m.id} value={m.id}>
                {m.alt_vi || m.storage_key}
              </option>
            ))}
          </select>
        </label>
        <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
          CTA type
          <select value={editing.cta_type ?? 'demo'} onChange={(e) => set({ cta_type: e.target.value as CmsCtaType })}>
            {CTA_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {editing.cta_type === 'url' ? (
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            CTA URL
            <input value={editing.cta_url ?? ''} onChange={(e) => set({ cta_url: e.target.value })} />
          </label>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="stack-gap">
          <strong>VI</strong>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            Title
            <input value={editing.title_vi ?? ''} onChange={(e) => set({ title_vi: e.target.value })} />
          </label>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            Dek
            <input value={editing.dek_vi ?? ''} onChange={(e) => set({ dek_vi: e.target.value })} />
          </label>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            Location
            <input value={editing.location_vi ?? ''} onChange={(e) => set({ location_vi: e.target.value })} />
          </label>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            Body
            <textarea rows={5} value={editing.body_vi ?? ''} onChange={(e) => set({ body_vi: e.target.value })} />
          </label>
        </div>
        <div className="stack-gap">
          <strong>EN</strong>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            Title
            <input value={editing.title_en ?? ''} onChange={(e) => set({ title_en: e.target.value })} />
          </label>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            Dek
            <input value={editing.dek_en ?? ''} onChange={(e) => set({ dek_en: e.target.value })} />
          </label>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            Location
            <input value={editing.location_en ?? ''} onChange={(e) => set({ location_en: e.target.value })} />
          </label>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            Body
            <textarea rows={5} value={editing.body_en ?? ''} onChange={(e) => set({ body_en: e.target.value })} />
          </label>
        </div>
      </div>

      <label className="muted">
        <input type="checkbox" checked={publishEn} onChange={(e) => onPublishEnChange(e.target.checked)} />
        {' '}
        Publish EN khi publish
      </label>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {canWrite ? (
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={onSave}>
            Lưu
          </button>
        ) : null}
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>
          Hủy
        </button>
      </div>
    </div>
  );
}

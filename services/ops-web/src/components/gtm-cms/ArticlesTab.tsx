'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createCmsArticle,
  fetchCmsArticles,
  fetchCmsMedia,
  patchCmsArticle,
  publishCmsArticle,
  unpublishCmsArticle,
  buildPublishBody,
  type CmsArticleCategory,
  type CmsArticleRow,
  type CmsArticleStatus,
  type CmsMediaRow,
} from '@/lib/gtm/cms-api';
import { canPublishGtmCms, canWriteGtmCms } from '@/lib/gtm/caps';
import type { StoredStaffUser } from '@/lib/auth';
import { getAccessToken } from '@/lib/auth';

type ArticlesTabProps = {
  user: StoredStaffUser;
  onToast: (msg: string) => void;
};

const CATEGORIES: CmsArticleCategory[] = ['insight', 'nganh', 'huong-dan'];
const STATUSES: CmsArticleStatus[] = ['draft', 'published', 'archived'];

const emptyDraft = (): Partial<CmsArticleRow> & { slug: string; title_vi: string; dek_vi: string; body_vi: string; category: CmsArticleCategory } => ({
  slug: '',
  category: 'insight',
  title_vi: '',
  title_en: '',
  dek_vi: '',
  dek_en: '',
  body_vi: '',
  body_en: '',
  cover_media_id: null,
  seo_title_vi: '',
  seo_title_en: '',
  seo_desc_vi: '',
  seo_desc_en: '',
  featured_home: false,
});

export function ArticlesTab({ user, onToast }: ArticlesTabProps) {
  const canWrite = canWriteGtmCms(user);
  const canPublish = canPublishGtmCms(user);
  const [rows, setRows] = useState<CmsArticleRow[]>([]);
  const [media, setMedia] = useState<CmsMediaRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<CmsArticleStatus | ''>('');
  const [filterCategory, setFilterCategory] = useState<CmsArticleCategory | ''>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<(Partial<CmsArticleRow> & { id?: string }) | null>(null);
  const [publishEn, setPublishEn] = useState(false);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const [articleRes, mediaRows] = await Promise.all([
        fetchCmsArticles(token, {
          status: filterStatus || undefined,
          category: filterCategory || undefined,
          limit: 100,
        }),
        fetchCmsMedia(token, { limit: 200 }),
      ]);
      setRows(articleRes.rows);
      setMedia(mediaRows.filter((m) => m.status === 'active'));
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Tải bài viết thất bại');
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus, onToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveArticle() {
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
        category: editing.category ?? 'insight',
        title_vi: editing.title_vi.trim(),
        title_en: editing.title_en?.trim() || null,
        dek_vi: editing.dek_vi.trim(),
        dek_en: editing.dek_en?.trim() || null,
        body_vi: editing.body_vi.trim(),
        body_en: editing.body_en?.trim() || null,
        cover_media_id: editing.cover_media_id || null,
        seo_title_vi: editing.seo_title_vi?.trim() || null,
        seo_title_en: editing.seo_title_en?.trim() || null,
        seo_desc_vi: editing.seo_desc_vi?.trim() || null,
        seo_desc_en: editing.seo_desc_en?.trim() || null,
        featured_home: editing.featured_home ?? false,
      };
      if (editing.id) {
        await patchCmsArticle(token, editing.id, payload);
        onToast('Đã cập nhật bài');
      } else {
        await createCmsArticle(token, payload);
        onToast('Đã tạo bài mới');
      }
      setEditing(null);
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Lưu bài thất bại');
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
      await publishCmsArticle(token, id, buildPublishBody({ publishEn }));
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
      await unpublishCmsArticle(token, id);
      onToast('Đã unpublish');
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Unpublish thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !rows.length) return <p className="muted">Đang tải bài viết…</p>;

  return (
    <div className="stack-gap">
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
        <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
          Status
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as CmsArticleStatus | '')}>
            <option value="">Tất cả</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
          Category
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as CmsArticleCategory | '')}>
            <option value="">Tất cả</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {canWrite ? (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setEditing(emptyDraft())}>
            + Bài mới
          </button>
        ) : null}
      </div>

      {editing ? (
        <ArticleEditor
          editing={editing}
          media={media}
          publishEn={publishEn}
          busy={busy}
          canWrite={canWrite}
          onChange={setEditing}
          onPublishEnChange={setPublishEn}
          onCancel={() => setEditing(null)}
          onSave={() => void saveArticle()}
        />
      ) : null}

      <div className="data-table-wrap">
        <table className="data-table data-table--dense">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Title VI</th>
              <th>Category</th>
              <th>Status</th>
              <th>Published</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.slug}</td>
                <td>{row.title_vi}</td>
                <td>{row.category}</td>
                <td>{row.status}</td>
                <td className="muted">{row.published_at ? new Date(row.published_at).toLocaleString('vi-VN') : '—'}</td>
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
                  Chưa có bài viết
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ArticleEditor({
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
  editing: Partial<CmsArticleRow> & { id?: string };
  media: CmsMediaRow[];
  publishEn: boolean;
  busy: boolean;
  canWrite: boolean;
  onChange: (v: Partial<CmsArticleRow> & { id?: string }) => void;
  onPublishEnChange: (v: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<CmsArticleRow>) => onChange({ ...editing, ...patch });

  return (
    <div className="page-card stack-gap">
      <strong>{editing.id ? 'Sửa bài' : 'Bài mới'}</strong>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
          Slug
          <input value={editing.slug ?? ''} onChange={(e) => set({ slug: e.target.value })} disabled={!!editing.id} />
        </label>
        <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
          Category
          <select value={editing.category ?? 'insight'} onChange={(e) => set({ category: e.target.value as CmsArticleCategory })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
          Cover media
          <select
            value={editing.cover_media_id ?? ''}
            onChange={(e) => set({ cover_media_id: e.target.value || null })}
          >
            <option value="">—</option>
            {media.map((m) => (
              <option key={m.id} value={m.id}>
                {m.alt_vi || m.storage_key}
              </option>
            ))}
          </select>
        </label>
        <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
          Featured home
          <input
            type="checkbox"
            checked={editing.featured_home ?? false}
            onChange={(e) => set({ featured_home: e.target.checked })}
          />
        </label>
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
            Body
            <textarea rows={6} value={editing.body_vi ?? ''} onChange={(e) => set({ body_vi: e.target.value })} />
          </label>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            SEO title
            <input value={editing.seo_title_vi ?? ''} onChange={(e) => set({ seo_title_vi: e.target.value })} />
          </label>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            SEO desc
            <input value={editing.seo_desc_vi ?? ''} onChange={(e) => set({ seo_desc_vi: e.target.value })} />
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
            Body
            <textarea rows={6} value={editing.body_en ?? ''} onChange={(e) => set({ body_en: e.target.value })} />
          </label>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            SEO title
            <input value={editing.seo_title_en ?? ''} onChange={(e) => set({ seo_title_en: e.target.value })} />
          </label>
          <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
            SEO desc
            <input value={editing.seo_desc_en ?? ''} onChange={(e) => set({ seo_desc_en: e.target.value })} />
          </label>
        </div>
      </div>

      <label className="muted">
        <input type="checkbox" checked={publishEn} onChange={(e) => onPublishEnChange(e.target.checked)} />
        {' '}
        Publish EN khi publish (editor preference)
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

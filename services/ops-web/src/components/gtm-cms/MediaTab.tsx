'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchCmsMedia,
  patchCmsMedia,
  uploadCmsMedia,
  type CmsMediaRow,
} from '@/lib/gtm/cms-api';
import { canWriteGtmCms } from '@/lib/gtm/caps';
import type { StoredStaffUser } from '@/lib/auth';
import { getAccessToken } from '@/lib/auth';

type MediaTabProps = {
  user: StoredStaffUser;
  onToast: (msg: string) => void;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaTab({ user, onToast }: MediaTabProps) {
  const canWrite = canWriteGtmCms(user);
  const [rows, setRows] = useState<CmsMediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadAltVi, setUploadAltVi] = useState('');
  const [uploadAltEn, setUploadAltEn] = useState('');
  const [uploadCredit, setUploadCredit] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const media = await fetchCmsMedia(token, { limit: 200 });
      setRows(media.filter((m) => m.status === 'active'));
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Tải media thất bại');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpload(file: File | null) {
    if (!file || !canWrite) return;
    const token = getAccessToken();
    if (!token) return;
    setBusy(true);
    try {
      await uploadCmsMedia(token, file, {
        alt_vi: uploadAltVi || undefined,
        alt_en: uploadAltEn || undefined,
        credit: uploadCredit || undefined,
      });
      onToast('Đã upload media');
      setUploadAltVi('');
      setUploadAltEn('');
      setUploadCredit('');
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Upload thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function saveMeta(row: CmsMediaRow, patch: { alt_vi?: string; alt_en?: string; credit?: string }) {
    const token = getAccessToken();
    if (!token || !canWrite) return;
    setBusy(true);
    try {
      await patchCmsMedia(token, row.id, patch);
      onToast('Đã lưu metadata');
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function archive(row: CmsMediaRow) {
    const token = getAccessToken();
    if (!token || !canWrite) return;
    if (!window.confirm('Archive media này?')) return;
    setBusy(true);
    try {
      await patchCmsMedia(token, row.id, { status: 'archived' });
      onToast('Đã archive');
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Archive thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Đang tải media…</p>;

  return (
    <div className="stack-gap">
      {canWrite ? (
        <div className="page-card stack-gap" style={{ padding: '0.75rem' }}>
          <strong>Upload mới</strong>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
            <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
              Alt VI
              <input value={uploadAltVi} onChange={(e) => setUploadAltVi(e.target.value)} />
            </label>
            <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
              Alt EN
              <input value={uploadAltEn} onChange={(e) => setUploadAltEn(e.target.value)} />
            </label>
            <label className="muted" style={{ display: 'grid', gap: '0.25rem' }}>
              Credit
              <input value={uploadCredit} onChange={(e) => setUploadCredit(e.target.value)} />
            </label>
            <label className="btn btn-sm btn-secondary" style={{ cursor: 'pointer' }}>
              Chọn file
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={busy}
                onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="data-table-wrap">
        <table className="data-table data-table--dense">
          <thead>
            <tr>
              <th>Preview</th>
              <th>Alt VI</th>
              <th>Alt EN</th>
              <th>Credit</th>
              <th>Size</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <MediaRow
                key={row.id}
                row={row}
                canWrite={canWrite}
                busy={busy}
                onSave={(patch) => void saveMeta(row, patch)}
                onArchive={() => void archive(row)}
              />
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="muted">
                  Chưa có media
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MediaRow({
  row,
  canWrite,
  busy,
  onSave,
  onArchive,
}: {
  row: CmsMediaRow;
  canWrite: boolean;
  busy: boolean;
  onSave: (patch: { alt_vi?: string; alt_en?: string; credit?: string }) => void;
  onArchive: () => void;
}) {
  const [altVi, setAltVi] = useState(row.alt_vi ?? '');
  const [altEn, setAltEn] = useState(row.alt_en ?? '');
  const [credit, setCredit] = useState(row.credit ?? '');

  return (
    <tr>
      <td>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={row.public_url} alt={altVi || row.storage_key} style={{ maxWidth: 72, maxHeight: 48, objectFit: 'cover' }} />
      </td>
      <td>
        {canWrite ? (
          <input value={altVi} onChange={(e) => setAltVi(e.target.value)} style={{ width: '100%' }} />
        ) : (
          altVi
        )}
      </td>
      <td>
        {canWrite ? (
          <input value={altEn} onChange={(e) => setAltEn(e.target.value)} style={{ width: '100%' }} />
        ) : (
          altEn
        )}
      </td>
      <td>
        {canWrite ? (
          <input value={credit} onChange={(e) => setCredit(e.target.value)} style={{ width: '100%' }} />
        ) : (
          credit
        )}
      </td>
      <td className="muted">{formatBytes(row.bytes)}</td>
      <td>
        {canWrite ? (
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={() => onSave({ alt_vi: altVi, alt_en: altEn, credit })}
            >
              Lưu
            </button>
            <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={onArchive}>
              Archive
            </button>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

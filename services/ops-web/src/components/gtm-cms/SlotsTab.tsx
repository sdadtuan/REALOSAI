'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CMS_SLOT_KEYS,
  fetchCmsMedia,
  fetchCmsSlot,
  putCmsSlot,
  type CmsMediaRow,
  type CmsSlotKey,
  type CmsSlotRow,
} from '@/lib/gtm/cms-api';
import { canWriteGtmCms } from '@/lib/gtm/caps';
import type { StoredStaffUser } from '@/lib/auth';
import { getAccessToken } from '@/lib/auth';

type SlotsTabProps = {
  user: StoredStaffUser;
  onToast: (msg: string) => void;
};

type SlotDraft = {
  slot_key: CmsSlotKey;
  row: CmsSlotRow | null;
  media_id: string;
  caption_vi: string;
  caption_en: string;
};

export function SlotsTab({ user, onToast }: SlotsTabProps) {
  const canWrite = canWriteGtmCms(user);
  const [media, setMedia] = useState<CmsMediaRow[]>([]);
  const [drafts, setDrafts] = useState<SlotDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const [mediaRows, slotRows] = await Promise.all([
        fetchCmsMedia(token, { limit: 200 }),
        Promise.all(CMS_SLOT_KEYS.map((key) => fetchCmsSlot(token, key))),
      ]);
      setMedia(mediaRows.filter((m) => m.status === 'active'));
      setDrafts(
        CMS_SLOT_KEYS.map((slot_key, i) => {
          const row = slotRows[i];
          return {
            slot_key,
            row,
            media_id: row?.media_id ?? '',
            caption_vi: row?.caption_vi ?? '',
            caption_en: row?.caption_en ?? '',
          };
        }),
      );
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Tải slots thất bại');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft(slotKey: string, patch: Partial<SlotDraft>) {
    setDrafts((prev) => prev.map((d) => (d.slot_key === slotKey ? { ...d, ...patch } : d)));
  }

  async function saveSlot(draft: SlotDraft) {
    if (!canWrite) return;
    const token = getAccessToken();
    if (!token) return;
    if (!draft.media_id) {
      onToast('Chọn media trước khi lưu slot');
      return;
    }
    setBusyKey(draft.slot_key);
    try {
      await putCmsSlot(token, draft.slot_key, {
        media_id: draft.media_id,
        caption_vi: draft.caption_vi.trim() || null,
        caption_en: draft.caption_en.trim() || null,
      });
      onToast(`Đã lưu slot ${draft.slot_key}`);
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Lưu slot thất bại');
    } finally {
      setBusyKey(null);
    }
  }

  const mediaById = new Map(media.map((m) => [m.id, m]));

  if (loading) return <p className="muted">Đang tải slots…</p>;

  return (
    <div className="data-table-wrap">
      <table className="data-table data-table--dense">
        <thead>
          <tr>
            <th>Slot key</th>
            <th>Preview</th>
            <th>Media</th>
            <th>Caption VI</th>
            <th>Caption EN</th>
            <th>Updated</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {drafts.map((draft) => {
            const selected = mediaById.get(draft.media_id);
            return (
              <tr key={draft.slot_key}>
                <td>
                  <code>{draft.slot_key}</code>
                </td>
                <td>
                  {selected ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.public_url}
                      alt={selected.alt_vi ?? draft.slot_key}
                      style={{ maxWidth: 72, maxHeight: 48, objectFit: 'cover' }}
                    />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <select
                    value={draft.media_id}
                    disabled={!canWrite}
                    onChange={(e) => updateDraft(draft.slot_key, { media_id: e.target.value })}
                    style={{ minWidth: 160 }}
                  >
                    <option value="">—</option>
                    {media.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.alt_vi || m.storage_key}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {canWrite ? (
                    <input
                      value={draft.caption_vi}
                      onChange={(e) => updateDraft(draft.slot_key, { caption_vi: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  ) : (
                    draft.caption_vi
                  )}
                </td>
                <td>
                  {canWrite ? (
                    <input
                      value={draft.caption_en}
                      onChange={(e) => updateDraft(draft.slot_key, { caption_en: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  ) : (
                    draft.caption_en
                  )}
                </td>
                <td className="muted">
                  {draft.row?.updated_at ? new Date(draft.row.updated_at).toLocaleString('vi-VN') : '—'}
                </td>
                <td>
                  {canWrite ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={busyKey === draft.slot_key}
                      onClick={() => void saveSlot(draft)}
                    >
                      Lưu
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { ContentOsCalendarGrid } from '@/components/content-os/ContentOsCalendarGrid';
import {
  channelFormatLabel,
  fetchContentOsCalendar,
  fetchContentOsItems,
  putContentOsCalendarSlot,
  type ContentOsCalendarSlot,
  type ContentOsItem,
} from '@/lib/content-os-api';

interface Props {
  token: string;
  lifecycleId: number;
  canWrite: boolean;
  onOpenItem: (itemId: number) => void;
  onChanged: () => Promise<void> | void;
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}

export function ContentOsCalendarView({
  token,
  lifecycleId,
  canWrite,
  onOpenItem,
  onChanged,
  onError,
  onMessage,
}: Props) {
  const [slots, setSlots] = useState<ContentOsCalendarSlot[]>([]);
  const [approved, setApproved] = useState<ContentOsItem[]>([]);
  const [scheduleItemId, setScheduleItemId] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [cal, itemsRes] = await Promise.all([
        fetchContentOsCalendar(token, lifecycleId),
        fetchContentOsItems(token, lifecycleId),
      ]);
      setSlots(cal.slots);
      setApproved(itemsRes.items.filter((i) => i.status === 'approved_internal'));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Tải calendar thất bại');
    }
  }, [token, lifecycleId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite || !scheduleItemId || !scheduleAt) return;
    setBusy(true);
    onError('');
    try {
      await putContentOsCalendarSlot(token, lifecycleId, Number(scheduleItemId), {
        scheduled_at: new Date(scheduleAt).toISOString(),
      });
      onMessage('Đã lên lịch item');
      setScheduleItemId('');
      setScheduleAt('');
      await reload();
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lên lịch thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <ContentOsCalendarGrid
        token={token}
        lifecycleId={lifecycleId}
        canWrite={canWrite}
        slots={slots}
        approved={approved}
        onOpenItem={onOpenItem}
        onChanged={async () => {
          await reload();
          await onChanged();
        }}
        onError={onError}
        onMessage={onMessage}
      />

      {canWrite ? (
        <form onSubmit={(e) => void onSchedule(e)} style={{ display: 'grid', gap: '0.5rem' }}>
          <strong style={{ fontSize: '0.9rem' }}>Lên lịch (item đã duyệt)</strong>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              value={scheduleItemId}
              onChange={(e) => setScheduleItemId(e.target.value)}
              style={selectStyle}
            >
              <option value="">Chọn item…</option>
              {approved.map((i) => (
                <option key={i.id} value={i.id}>
                  #{i.id} {i.title}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              style={selectStyle}
            />
            <button type="submit" className="btn btn-sm" disabled={busy || !scheduleItemId || !scheduleAt}>
              Lên lịch
            </button>
          </div>
        </form>
      ) : null}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
        {slots.map((slot) => (
          <li
            key={slot.id}
            style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.65rem' }}
          >
            <strong>{slot.item?.title ?? `Item #${slot.item_id}`}</strong>
            <div className="muted" style={{ fontSize: '0.82rem' }}>
              {new Date(slot.scheduled_at).toLocaleString('vi-VN')} ({slot.timezone})
              {slot.item
                ? ` · ${channelFormatLabel(slot.item.channel, slot.item.format)} · ${slot.item.status}`
                : ''}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              style={{ marginTop: '0.35rem' }}
              onClick={() => onOpenItem(slot.item_id)}
            >
              Mở item
            </button>
          </li>
        ))}
      </ul>
      {!slots.length ? <p className="muted">Chưa có slot lịch đăng.</p> : null}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.35rem 0.5rem',
  color: 'var(--text)',
};

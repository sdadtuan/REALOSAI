'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  channelFormatLabel,
  putContentOsCalendarSlot,
  type ContentOsCalendarSlot,
  type ContentOsItem,
} from '@/lib/content-os-api';

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function noonIsoForDay(d: Date): string {
  const copy = new Date(d);
  copy.setHours(12, 0, 0, 0);
  return copy.toISOString();
}

interface Props {
  token: string;
  lifecycleId: number;
  canWrite: boolean;
  slots: ContentOsCalendarSlot[];
  approved: ContentOsItem[];
  onOpenItem: (itemId: number) => void;
  onChanged: () => Promise<void> | void;
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}

export function ContentOsCalendarGrid({
  token,
  lifecycleId,
  canWrite,
  slots,
  approved,
  onOpenItem,
  onChanged,
  onError,
  onMessage,
}: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [dragItemId, setDragItemId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const scheduledByDay = useMemo(() => {
    const map = new Map<string, ContentOsCalendarSlot[]>();
    for (const slot of slots) {
      const key = dayKey(new Date(slot.scheduled_at));
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    }
    return map;
  }, [slots]);

  const unscheduled = useMemo(() => {
    const scheduledIds = new Set(slots.map((s) => s.item_id));
    return approved.filter((i) => !scheduledIds.has(i.id));
  }, [approved, slots]);

  const scheduleItemOnDay = useCallback(
    async (itemId: number, day: Date) => {
      if (!canWrite) return;
      setBusy(true);
      onError('');
      try {
        await putContentOsCalendarSlot(token, lifecycleId, itemId, {
          scheduled_at: noonIsoForDay(day),
        });
        onMessage(`Đã lên lịch item #${itemId}`);
        await onChanged();
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Lên lịch thất bại');
      } finally {
        setBusy(false);
        setDragItemId(null);
      }
    },
    [canWrite, token, lifecycleId, onChanged, onError, onMessage],
  );

  return (
    <div style={{ display: 'grid', gap: '0.65rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
        >
          ← Tuần trước
        </button>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {days[0]?.toLocaleDateString('vi-VN')} – {days[6]?.toLocaleDateString('vi-VN')}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
        >
          Tuần sau →
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(100px, 1fr))',
          gap: '0.45rem',
          overflowX: 'auto',
        }}
      >
        {days.map((day) => {
          const key = dayKey(day);
          const daySlots = scheduledByDay.get(key) ?? [];
          return (
            <div
              key={key}
              onDragOver={(e) => {
                if (!canWrite) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const raw = e.dataTransfer.getData('text/plain');
                const itemId = Number(raw);
                if (Number.isFinite(itemId) && itemId > 0) {
                  void scheduleItemOnDay(itemId, day);
                }
              }}
              style={{
                minHeight: 120,
                border: '1px dashed var(--border)',
                borderRadius: 8,
                padding: '0.4rem',
                background: dragItemId != null ? 'rgba(100,180,255,0.06)' : undefined,
              }}
            >
              <div className="muted" style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                {day.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric' })}
              </div>
              <div style={{ display: 'grid', gap: '0.3rem' }}>
                {daySlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    className="btn btn-sm btn-ghost"
                    style={{ fontSize: '0.72rem', textAlign: 'left', padding: '0.25rem 0.35rem' }}
                    onClick={() => onOpenItem(slot.item_id)}
                  >
                    #{slot.item_id} {slot.item?.title ?? ''}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {canWrite ? (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <strong style={{ fontSize: '0.85rem' }}>Kéo thả item đã duyệt vào lịch</strong>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {unscheduled.map((item) => (
              <div
                key={item.id}
                draggable={!busy}
                onDragStart={(e) => {
                  setDragItemId(item.id);
                  e.dataTransfer.setData('text/plain', String(item.id));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => setDragItemId(null)}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.78rem',
                  cursor: busy ? 'wait' : 'grab',
                  background: 'var(--bg)',
                }}
              >
                #{item.id} {item.title}
                <div className="muted" style={{ fontSize: '0.72rem' }}>
                  {channelFormatLabel(item.channel, item.format)}
                </div>
              </div>
            ))}
            {!unscheduled.length ? (
              <span className="muted" style={{ fontSize: '0.82rem' }}>
                Không còn item approved chưa lên lịch.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

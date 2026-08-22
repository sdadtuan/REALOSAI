'use client';

import { useState } from 'react';
import {
  patchOpsWeeklyItem,
  spawnOpsWeek,
  type OpsHubPayload,
  type OpsWeeklyChecklistItem,
} from '@/lib/ops-dv-api';

type Props = {
  token: string;
  lifecycleId: number;
  weekly: OpsHubPayload['weekly'];
  spawnEnabled: boolean;
  canEdit: boolean;
  onRefresh: () => Promise<void>;
};

export function OpsWeeklyPanel({
  token,
  lifecycleId,
  weekly,
  spawnEnabled,
  canEdit,
  onRefresh,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const items = (weekly.items ?? []) as OpsWeeklyChecklistItem[];

  async function onSpawn() {
    setBusy(true);
    setError('');
    try {
      await spawnOpsWeek(token, lifecycleId);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sinh checklist thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function toggleItem(item: OpsWeeklyChecklistItem) {
    if (!canEdit || busy) return;
    setBusy(true);
    setError('');
    try {
      const next = item.status === 'done' ? 'pending' : 'done';
      await patchOpsWeeklyItem(token, lifecycleId, item.id, next);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật task thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <h4 style={{ margin: 0 }}>Tuần này ({weekly.iso_week})</h4>
        {canEdit && spawnEnabled && !weekly.spawned ? (
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void onSpawn()}>
            Sinh checklist tuần
          </button>
        ) : null}
      </div>
      <p className="muted" style={{ margin: '0.35rem 0 0.75rem' }}>
        {weekly.spawned
          ? `${weekly.tasks_done} hoàn thành · ${weekly.tasks_pending} còn lại`
          : spawnEnabled
            ? 'Chưa sinh checklist tuần này.'
            : 'Spawn tuần chưa bật (PTT_OPS_WEEKLY_SPAWN).'}
      </p>
      {error ? <p className="error">{error}</p> : null}
      {weekly.spawned && items.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
          {items.map((item) => (
            <li
              key={item.id}
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
                padding: '0.5rem 0.65rem',
                border: '1px solid var(--border, #ddd)',
                borderRadius: 6,
              }}
            >
              <input
                type="checkbox"
                checked={item.status === 'done'}
                disabled={!canEdit || busy}
                onChange={() => void toggleItem(item)}
                aria-label={item.title}
              />
              <div>
                <div style={{ fontWeight: item.status === 'done' ? 400 : 500 }}>
                  {item.title}
                </div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {item.owner_role}
                  {item.day_of_week ? ` · T${item.day_of_week}` : ''}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

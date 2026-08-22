'use client';

import { useState } from 'react';
import {
  channelFormatLabel,
  fetchContentOsItems,
  postContentOsRepurpose,
  type ContentOsItem,
  type ContentOsRepurposeTarget,
} from '@/lib/content-os-api';

const REPURPOSE_PRESETS: ContentOsRepurposeTarget[] = [
  { channel: 'facebook', format: 'social_post', count: 2 },
  { channel: 'linkedin', format: 'social_post', count: 1 },
  { channel: 'newsletter', format: 'email', count: 1 },
];

interface Props {
  token: string;
  lifecycleId: number;
  canGenerate: boolean;
  onOpenItem: (id: number) => void;
  onDone: () => void;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}

export function ContentOsRepurposeWizard({
  token,
  lifecycleId,
  canGenerate,
  onOpenItem,
  onDone,
  onMessage,
  onError,
}: Props) {
  const [masters, setMasters] = useState<ContentOsItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [targets, setTargets] = useState<ContentOsRepurposeTarget[]>(REPURPOSE_PRESETS);
  const [running, setRunning] = useState(false);
  const [derived, setDerived] = useState<ContentOsItem[]>([]);

  const loadMasters = async () => {
    try {
      const res = await fetchContentOsItems(token, lifecycleId);
      const blogs = res.items.filter(
        (i) => i.channel === 'website' && i.format === 'blog' && i.status === 'approved_internal',
      );
      setMasters(blogs);
      setLoaded(true);
      if (blogs[0] && sourceId == null) setSourceId(blogs[0].id);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Tải blog master thất bại');
    }
  };

  if (!loaded) {
    return (
      <div style={{ marginTop: '0.75rem' }}>
        <p className="muted">Repurpose wizard — chọn blog đã duyệt → sinh derived items.</p>
        <button type="button" className="btn btn-sm" onClick={() => void loadMasters()}>
          Tải blog master
        </button>
      </div>
    );
  }

  const toggleTarget = (preset: ContentOsRepurposeTarget) => {
    const key = `${preset.channel}|${preset.format}`;
    const exists = targets.some((t) => `${t.channel}|${t.format}` === key);
    if (exists) {
      setTargets(targets.filter((t) => `${t.channel}|${t.format}` !== key));
    } else {
      setTargets([...targets, preset]);
    }
  };

  const runRepurpose = async () => {
    if (sourceId == null || !targets.length) return;
    setRunning(true);
    setDerived([]);
    try {
      const res = await postContentOsRepurpose(token, lifecycleId, sourceId, {
        targets,
        optimize_hooks: true,
      });
      setDerived(res.derived_items);
      onMessage(`Đã tạo ${res.derived_items.length} derived item(s)`);
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Repurpose thất bại');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem' }}>
      <h3 style={{ margin: 0 }}>Repurpose wizard</h3>
      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span className="muted">Blog master (approved)</span>
        <select
          value={sourceId ?? ''}
          onChange={(e) => setSourceId(Number(e.target.value))}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem' }}
        >
          {masters.map((m) => (
            <option key={m.id} value={m.id}>
              #{m.id} — {m.title}
            </option>
          ))}
          {!masters.length ? <option value="">(Không có blog approved)</option> : null}
        </select>
      </label>

      <div>
        <span className="muted">Targets</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.35rem' }}>
          {REPURPOSE_PRESETS.map((p) => {
            const active = targets.some((t) => t.channel === p.channel && t.format === p.format);
            return (
              <button
                key={`${p.channel}|${p.format}`}
                type="button"
                className={active ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                onClick={() => toggleTarget(p)}
              >
                {channelFormatLabel(p.channel, p.format)} ×{p.count ?? 1}
              </button>
            );
          })}
        </div>
      </div>

      {canGenerate ? (
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={running || !masters.length || !targets.length}
          onClick={() => void runRepurpose()}
        >
          {running ? 'Đang repurpose…' : 'Chạy repurpose'}
        </button>
      ) : (
        <p className="muted">Cần cap crm_content.generate để chạy repurpose AI.</p>
      )}

      {derived.length ? (
        <div>
          <strong>Derived items — duyệt từng item</strong>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.5rem', display: 'grid', gap: '0.35rem' }}>
            {derived.map((d) => (
              <li key={d.id}>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => onOpenItem(d.id)}>
                  #{d.id} {channelFormatLabel(d.channel, d.format)} — {d.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

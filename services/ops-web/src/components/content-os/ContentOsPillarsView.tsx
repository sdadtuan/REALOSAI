'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchContentOsPillars,
  patchContentOsPillar,
  type ContentOsPillar,
} from '@/lib/content-os-api';

interface Props {
  token: string;
  lifecycleId: number;
  canWrite: boolean;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}

export function ContentOsPillarsView({ token, lifecycleId, canWrite, onMessage, onError }: Props) {
  const [pillars, setPillars] = useState<ContentOsPillar[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    onError('');
    try {
      const res = await fetchContentOsPillars(token, lifecycleId);
      setPillars(res.pillars);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Tải pillars thất bại');
    } finally {
      setLoading(false);
    }
  }, [token, lifecycleId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function savePillar(pillar: ContentOsPillar) {
    if (!canWrite) return;
    setBusyId(pillar.id);
    try {
      await patchContentOsPillar(token, lifecycleId, pillar.id, {
        name: pillar.name,
        goal: pillar.goal,
        topics_json: pillar.topics_json,
        sort_order: pillar.sort_order,
      });
      onMessage(`Đã lưu pillar "${pillar.name}"`);
      await reload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lưu pillar thất bại');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="muted">Đang tải pillars…</p>;
  if (!pillars.length) {
    return (
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Chưa có pillar — Import từ Planner hoặc seal snapshot trước.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.65rem' }}>
      <strong style={{ fontSize: '0.9rem' }}>Content pillars</strong>
      {pillars.map((pillar, idx) => (
        <PillarEditor
          key={pillar.id}
          pillar={pillar}
          canWrite={canWrite}
          busy={busyId === pillar.id}
          onChange={(next) =>
            setPillars((rows) => rows.map((p) => (p.id === pillar.id ? next : p)))
          }
          onSave={() => void savePillar(pillars[idx])}
        />
      ))}
    </div>
  );
}

function PillarEditor({
  pillar,
  canWrite,
  busy,
  onChange,
  onSave,
}: {
  pillar: ContentOsPillar;
  canWrite: boolean;
  busy: boolean;
  onChange: (next: ContentOsPillar) => void;
  onSave: () => void;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.65rem 0.75rem',
        display: 'grid',
        gap: '0.45rem',
      }}
    >
      <input
        value={pillar.name}
        disabled={!canWrite || busy}
        onChange={(e) => onChange({ ...pillar, name: e.target.value })}
        style={fieldStyle}
      />
      <input
        value={pillar.goal}
        disabled={!canWrite || busy}
        onChange={(e) => onChange({ ...pillar, goal: e.target.value })}
        placeholder="Goal"
        style={fieldStyle}
      />
      <input
        value={(pillar.topics_json ?? []).join(', ')}
        disabled={!canWrite || busy}
        onChange={(e) =>
          onChange({
            ...pillar,
            topics_json: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
          })
        }
        placeholder="Topics (comma separated)"
        style={fieldStyle}
      />
      {canWrite ? (
        <button type="button" className="btn btn-sm" disabled={busy} onClick={onSave}>
          {busy ? 'Đang lưu…' : 'Lưu pillar'}
        </button>
      ) : null}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.35rem 0.5rem',
  color: 'var(--text)',
  width: '100%',
};

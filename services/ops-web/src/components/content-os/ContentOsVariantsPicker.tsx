'use client';

import { useState } from 'react';
import { patchContentOsItemApplyVariant } from '@/lib/content-os-api';

interface Props {
  token: string;
  lifecycleId: number;
  itemId: number;
  variants: string[];
  selectedIdx: number | null;
  canWrite: boolean;
  onApplied: () => Promise<void> | void;
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}

export function ContentOsVariantsPicker({
  token,
  lifecycleId,
  itemId,
  variants,
  selectedIdx,
  canWrite,
  onApplied,
  onError,
  onMessage,
}: Props) {
  const [pick, setPick] = useState<number>(selectedIdx ?? 0);
  const [busy, setBusy] = useState(false);

  if (!variants.length) {
    return <p className="muted" style={{ fontSize: '0.85rem' }}>Chưa có variants — bấm Generate variants.</p>;
  }

  async function onApply() {
    if (!canWrite) return;
    setBusy(true);
    onError('');
    try {
      await patchContentOsItemApplyVariant(token, lifecycleId, itemId, pick);
      onMessage(`Đã apply variant #${pick + 1}`);
      await onApplied();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Apply variant thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <strong style={{ fontSize: '0.9rem' }}>Variants ({variants.length})</strong>
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        {variants.map((v, idx) => (
          <label
            key={idx}
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start',
              padding: '0.45rem',
              border: '1px solid var(--border)',
              borderRadius: 8,
              cursor: canWrite ? 'pointer' : 'default',
            }}
          >
            <input
              type="radio"
              name={`variant-${itemId}`}
              checked={pick === idx}
              disabled={!canWrite || busy}
              onChange={() => setPick(idx)}
            />
            <span style={{ fontSize: '0.88rem' }}>{v}</span>
          </label>
        ))}
      </div>
      {canWrite ? (
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void onApply()}>
          Apply variant vào body
        </button>
      ) : null}
    </div>
  );
}

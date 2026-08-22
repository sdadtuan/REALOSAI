'use client';

import { useEffect, useState } from 'react';
import { patchContentOsItem, type ContentOsItem } from '@/lib/content-os-api';

interface Props {
  open: boolean;
  token: string;
  lifecycleId: number;
  item: ContentOsItem | null;
  missingFields: Array<'audience' | 'goal'>;
  canWrite: boolean;
  busy?: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}

export function ContentOsBriefSupplementModal({
  open,
  token,
  lifecycleId,
  item,
  missingFields,
  canWrite,
  busy = false,
  onClose,
  onSaved,
  onMessage,
  onError,
}: Props) {
  const [audience, setAudience] = useState('');
  const [goal, setGoal] = useState('engagement');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    const briefAud = item.brief_json?.audience ?? item.brief_json?.target_audience;
    setAudience(
      Array.isArray(briefAud)
        ? briefAud.map(String).join(', ')
        : briefAud != null
          ? String(briefAud)
          : '',
    );
    setGoal(item.funnel_goal || String(item.brief_json?.goal ?? 'engagement'));
  }, [open, item]);

  if (!open || !item) return null;

  const needAudience = missingFields.includes('audience');
  const needGoal = missingFields.includes('goal');
  const disabled = busy || saving || !canWrite;

  async function onSave() {
    if (!canWrite || !item) return;
    const current = item;
    if (needAudience && !audience.trim()) {
      onError('Nhập audience / đối tượng.');
      return;
    }
    if (needGoal && !goal.trim()) {
      onError('Chọn funnel goal.');
      return;
    }
    setSaving(true);
    onError('');
    try {
      const brief = { ...(current.brief_json ?? {}) };
      if (needAudience || audience.trim()) {
        brief.audience = audience.trim();
      }
      if (needGoal || goal.trim()) {
        brief.goal = goal.trim();
      }
      await patchContentOsItem(token, lifecycleId, current.id, {
        funnel_goal: goal.trim() || current.funnel_goal,
        brief_json: brief,
      });
      onMessage('Đã bổ sung brief — có thể generate lại.');
      await onSaved();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lưu brief thất bại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cmkt-brief-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !disabled) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: 'min(480px, 100%)',
          padding: '1.25rem',
          display: 'grid',
          gap: '0.85rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="cmkt-brief-modal-title" style={{ margin: 0, fontSize: '1.05rem' }}>
          Bổ sung brief
        </h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          BR-CMKT-03: AI cần audience và goal trước khi generate.
        </p>

        {needAudience ? (
          <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }}>
            <span>Audience / đối tượng</span>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              disabled={disabled}
              placeholder="VD: B2B SaaS, marketing manager"
              style={inputStyle}
            />
          </label>
        ) : null}

        {needGoal ? (
          <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }}>
            <span>Funnel goal</span>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} disabled={disabled} style={inputStyle}>
              <option value="engagement">Engagement</option>
              <option value="lead">Lead</option>
              <option value="awareness">Awareness</option>
              <option value="conversion">Conversion</option>
            </select>
          </label>
        ) : null}

        {!canWrite ? (
          <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>
            Cần quyền ghi để cập nhật brief.
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-sm btn-ghost" disabled={disabled} onClick={onClose}>
            Đóng
          </button>
          <button type="button" className="btn btn-sm" disabled={disabled} onClick={() => void onSave()}>
            {saving ? 'Đang lưu…' : 'Lưu & tiếp tục'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.45rem',
  color: 'var(--text)',
};

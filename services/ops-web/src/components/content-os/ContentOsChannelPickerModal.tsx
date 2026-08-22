'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  channelLabels,
  formatsForChannel,
  type ContentOsChannelOption,
} from '@/lib/content-os-channel-matrix';
import { postContentOsItem, type ContentOsPillar } from '@/lib/content-os-api';

interface Props {
  open: boolean;
  token: string;
  lifecycleId: number;
  pillars: ContentOsPillar[];
  defaultTitle?: string;
  busy?: boolean;
  onClose: () => void;
  onCreated: (itemId: number) => void;
  onError: (msg: string) => void;
}

export function ContentOsChannelPickerModal({
  open,
  token,
  lifecycleId,
  pillars,
  defaultTitle = '',
  busy = false,
  onClose,
  onCreated,
  onError,
}: Props) {
  const channels = useMemo(() => channelLabels(), []);
  const [channel, setChannel] = useState('facebook');
  const [format, setFormat] = useState('social_post');
  const [pillarId, setPillarId] = useState<string>('');
  const [title, setTitle] = useState(defaultTitle);
  const [submitting, setSubmitting] = useState(false);

  const formatOptions: ContentOsChannelOption[] = useMemo(
    () => formatsForChannel(channel),
    [channel],
  );

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setChannel('facebook');
    setFormat('social_post');
    setPillarId('');
  }, [open, defaultTitle]);

  useEffect(() => {
    if (!formatOptions.some((o) => o.format === format)) {
      setFormat(formatOptions[0]?.format ?? 'social_post');
    }
  }, [formatOptions, format]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      onError('Nhập tiêu đề item');
      return;
    }
    const pillar = pillars.find((p) => String(p.id) === pillarId);
    setSubmitting(true);
    onError('');
    try {
      const item = await postContentOsItem(token, lifecycleId, {
        title: trimmed,
        channel,
        format,
        funnel_goal: pillar?.goal ?? '',
        brief_json: pillar
          ? { pillar_id: pillar.id, pillar_name: pillar.name }
          : {},
      });
      onCreated(item.id);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Tạo item thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = busy || submitting;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cmkt-channel-picker-title"
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
      <form
        className="card"
        onSubmit={(e) => void onSubmit(e)}
        style={{
          width: 'min(480px, 100%)',
          padding: '1.25rem',
          display: 'grid',
          gap: '0.75rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="cmkt-channel-picker-title" style={{ margin: 0, fontSize: '1.05rem' }}>
          Tạo content item
        </h3>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Kênh
          </span>
          <select
            value={channel}
            disabled={disabled}
            onChange={(e) => setChannel(e.target.value)}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.45rem',
              color: 'var(--text)',
            }}
          >
            {channels.map((c) => (
              <option key={c.channel} value={c.channel}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Format
          </span>
          <select
            value={format}
            disabled={disabled}
            onChange={(e) => setFormat(e.target.value)}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.45rem',
              color: 'var(--text)',
            }}
          >
            {formatOptions.map((o) => (
              <option key={`${o.channel}|${o.format}`} value={o.format}>
                {o.label.split(' — ')[1] ?? o.format}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Pillar (tuỳ chọn)
          </span>
          <select
            value={pillarId}
            disabled={disabled}
            onChange={(e) => setPillarId(e.target.value)}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.45rem',
              color: 'var(--text)',
            }}
          >
            <option value="">— Không chọn —</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.goal})
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Tiêu đề
          </span>
          <input
            value={title}
            disabled={disabled}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề content item"
            required
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.45rem 0.65rem',
              color: 'var(--text)',
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-sm btn-ghost" disabled={disabled} onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn btn-sm" disabled={disabled || !title.trim()}>
            {submitting ? 'Đang tạo…' : 'Tạo & mở drawer'}
          </button>
        </div>
      </form>
    </div>
  );
}

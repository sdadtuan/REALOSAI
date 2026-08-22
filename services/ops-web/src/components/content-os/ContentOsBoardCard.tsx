'use client';

import {
  channelFormatLabel,
  type ContentOsItem,
} from '@/lib/content-os-api';
import {
  dualGateChips,
  statusAccentColor,
  statusLabel,
} from '@/lib/content-os-status';

interface Props {
  item: ContentOsItem;
  onClick: () => void;
}

export function ContentOsBoardCard({ item, onClick }: Props) {
  const gates = dualGateChips(item);
  const accent = statusAccentColor(item.status);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: 'var(--bg)',
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 8,
        padding: '0.55rem',
        color: 'var(--text)',
        cursor: 'pointer',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.35rem', alignItems: 'flex-start' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.3 }}>{item.title}</div>
        <span
          className="badge"
          style={{
            fontSize: '0.68rem',
            whiteSpace: 'nowrap',
            color: accent,
            borderColor: accent,
          }}
        >
          {statusLabel(item.status)}
        </span>
      </div>
      <div className="muted" style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
        {channelFormatLabel(item.channel, item.format)}
      </div>
      {gates.show ? (
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
          <span className="badge" style={{ fontSize: '0.68rem' }}>
            Text {gates.textOk ? '✓' : '○'}
          </span>
          <span className="badge" style={{ fontSize: '0.68rem' }}>
            Visual {gates.visualOk ? '✓' : '○'}
          </span>
        </div>
      ) : null}
    </button>
  );
}

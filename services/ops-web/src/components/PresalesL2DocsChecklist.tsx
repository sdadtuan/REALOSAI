'use client';

export interface PresalesL2DocRow {
  key: string;
  label: string;
  checked: boolean;
}

export interface PresalesL2DocsView {
  service_slug: string;
  items: PresalesL2DocRow[];
  total: number;
  done: number;
  complete: boolean;
  missing_labels: string[];
}

interface Props {
  view: PresalesL2DocsView;
  disabled?: boolean;
  busy?: boolean;
  onToggle: (key: string, checked: boolean) => void;
}

export function PresalesL2DocsChecklist({ view, disabled = false, busy = false, onToggle }: Props) {
  if (!view.items.length) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Chưa có checklist L2 cho slug <code>{view.service_slug || '—'}</code>.
      </p>
    );
  }

  const pct = view.total > 0 ? Math.round((view.done / view.total) * 100) : 100;

  return (
    <section
      className="presales-l2-docs"
      style={{
        border: '1px solid var(--border, #cbd5e1)',
        borderRadius: 8,
        padding: '0.65rem 0.75rem',
        background: view.complete ? '#f0fdf4' : '#fffbeb',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Tài liệu L2 đã thu</h4>
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          {view.done}/{view.total} · {pct}%
        </span>
      </div>
      <p className="muted" style={{ margin: '0.35rem 0 0.6rem', fontSize: '0.82rem' }}>
        Tick trước buổi Consult (1–3 ngày). Bắt buộc trước khi ✓ task Consult.
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.4rem' }}>
        {view.items.map((item) => (
          <li key={item.key}>
            <label
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
                fontSize: '0.88rem',
                cursor: disabled || busy ? 'not-allowed' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={item.checked}
                disabled={disabled || busy}
                onChange={(e) => onToggle(item.key, e.target.checked)}
                style={{ marginTop: '0.15rem' }}
              />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
      {!view.complete && view.missing_labels.length > 0 ? (
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.82rem', color: '#b45309' }}>
          Còn thiếu: {view.missing_labels.join(', ')}
        </p>
      ) : null}
    </section>
  );
}

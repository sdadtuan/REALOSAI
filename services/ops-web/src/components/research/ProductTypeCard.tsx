import type { ProductType } from '@/lib/market-research-api';

type ProductTypeCardProps = {
  type: ProductType;
  label: string;
  subcopy: string;
  selected: boolean;
  onSelect: (type: ProductType) => void;
};

export function ProductTypeCard({ type, label, subcopy, selected, onSelect }: ProductTypeCardProps) {
  return (
    <button
      type="button"
      className="card"
      onClick={() => onSelect(type)}
      aria-pressed={selected}
      style={{
        textAlign: 'left',
        padding: '0.85rem 1rem',
        border: selected ? '2px solid var(--primary)' : '1px solid var(--border, #d8e0d8)',
        position: 'relative',
        cursor: 'pointer',
        background: selected ? 'color-mix(in srgb, var(--primary) 8%, white)' : undefined,
      }}
    >
      {selected ? (
        <span style={{ position: 'absolute', top: 8, right: 10, color: 'var(--primary)', fontWeight: 700 }}>
          ✓
        </span>
      ) : null}
      <strong>{label}</strong>
      <div className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
        {subcopy}
      </div>
      <code className="muted" style={{ fontSize: '0.75rem' }}>
        {type}
      </code>
    </button>
  );
}

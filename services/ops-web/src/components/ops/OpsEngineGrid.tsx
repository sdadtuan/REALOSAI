import Link from 'next/link';
import type { OpsHubEngine } from '@/lib/ops-dv-api';

type Props = {
  engines: OpsHubEngine[];
};

export function OpsEngineGrid({ engines }: Props) {
  if (!engines.length) {
    return <p className="muted">Chưa có engine link cho dịch vụ này.</p>;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '0.65rem',
      }}
    >
      {engines.map((engine) => {
        const disabled = engine.status === 'gap';
        return (
          <div
            key={engine.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.75rem',
              opacity: disabled ? 0.65 : 1,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>{engine.label}</div>
            {engine.badge ? (
              <span className="badge" style={{ marginBottom: '0.5rem', display: 'inline-block' }}>
                {engine.badge}
              </span>
            ) : null}
            {disabled ? (
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                Dùng SOP thủ công — engine chưa sẵn sàng.
              </p>
            ) : (
              <Link href={engine.href} className="nav-link">
                Mở engine →
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

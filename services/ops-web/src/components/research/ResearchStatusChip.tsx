import { STATUS_LABELS, type ProjectStatus } from '@/lib/market-research-api';

export function ResearchStatusChip({ status }: { status: ProjectStatus | string }) {
  const label = STATUS_LABELS[status as ProjectStatus] ?? status;
  return (
    <span
      title={status}
      style={{
        display: 'inline-block',
        padding: '0.15rem 0.55rem',
        borderRadius: 999,
        background: 'color-mix(in srgb, var(--primary) 12%, white)',
        fontSize: '0.8rem',
      }}
    >
      {label}
    </span>
  );
}

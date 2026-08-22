export function EvidenceIdChip({
  id,
  locator,
}: {
  id: number;
  locator?: string | null;
}) {
  return (
    <span
      title={locator || `Evidence ${id}`}
      style={{
        display: 'inline-block',
        padding: '0.1rem 0.45rem',
        borderRadius: 999,
        background: 'color-mix(in srgb, var(--primary) 12%, white)',
        fontSize: '0.78rem',
        fontWeight: 600,
      }}
    >
      EV-{id}
    </span>
  );
}

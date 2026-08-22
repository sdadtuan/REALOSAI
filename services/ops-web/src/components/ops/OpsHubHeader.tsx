type Props = {
  lifecycle: {
    slug: string;
    client_name: string;
    status: string;
    package_tier: string;
  };
  dv: {
    dv_code: string;
    name: string;
    readiness: string;
  };
};

export function OpsHubHeader({ lifecycle, dv }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <h3 style={{ margin: 0 }}>{dv.name}</h3>
        <p className="muted" style={{ margin: '0.25rem 0 0' }}>
          {dv.dv_code} · {lifecycle.slug} · {lifecycle.client_name || '—'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        <span className="badge">{lifecycle.package_tier}</span>
        <span className="badge">{lifecycle.status}</span>
        <span className="badge">{dv.readiness}</span>
        {lifecycle.status === 'active' || lifecycle.status === 'in_progress' ? null : (
          <span className="badge" style={{ opacity: 0.8 }}>
            read-only hub
          </span>
        )}
      </div>
    </div>
  );
}

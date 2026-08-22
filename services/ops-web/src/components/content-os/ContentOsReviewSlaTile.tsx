'use client';

interface Props {
  total: number;
  slaBreach: number;
  slaTargetHours: number;
  maxHours: number | null;
  avgHours: number | null;
  onFilterBreach?: () => void;
}

export function ContentOsReviewSlaTile({
  total,
  slaBreach,
  slaTargetHours,
  maxHours,
  avgHours,
  onFilterBreach,
}: Props) {
  const tone = slaBreach > 0 ? 'banner-warning' : 'banner-success';

  return (
    <div
      className={`banner ${tone}`}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.65rem 0.75rem',
        display: 'grid',
        gap: '0.45rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div>
          <strong style={{ fontSize: '0.92rem' }}>Review queue SLA</strong>
          <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>
            {total} item in review · target &lt;{slaTargetHours}h
          </p>
        </div>
        {slaBreach > 0 && onFilterBreach ? (
          <button type="button" className="btn btn-sm btn-ghost" onClick={onFilterBreach}>
            Lọc breach
          </button>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
        <span>
          Max{' '}
          <strong>{maxHours != null ? `${maxHours}h` : '—'}</strong>
        </span>
        <span>
          Avg <strong>{avgHours != null ? `${avgHours}h` : '—'}</strong>
        </span>
        <span style={{ color: slaBreach ? 'var(--warning, #e6a700)' : undefined }}>
          Breach <strong>{slaBreach}</strong>
        </span>
        <span className={slaBreach ? 'warning' : 'success'}>
          {slaBreach ? 'Chưa đạt SLA' : 'Đạt SLA'}
        </span>
      </div>
    </div>
  );
}

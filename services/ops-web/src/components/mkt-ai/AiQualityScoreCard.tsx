'use client';

import {
  countCriteriaPassed,
  QUALITY_CRITERIA_LABELS,
  QUALITY_CRITERIA_ORDER,
  qualityScoreColor,
  qualityTierLabel,
  getQualityTier,
} from '@/lib/mkt-ai-quality-labels';

export interface QualityScoreView {
  score: number;
  criteria: Record<string, boolean>;
  can_apply: boolean;
  can_export: boolean;
  can_export_docx_only?: boolean;
}

interface Props {
  quality: QualityScoreView | null | undefined;
  loading?: boolean;
  busy?: boolean;
  canEdit?: boolean;
  onRecalculate?: () => void;
}

export function AiQualityScoreCard({
  quality,
  loading = false,
  busy = false,
  canEdit = false,
  onRecalculate,
}: Props) {
  const tier = getQualityTier(quality?.score);
  const passed = countCriteriaPassed(quality?.criteria);
  const total = QUALITY_CRITERIA_ORDER.length;

  return (
    <section
      className="card"
      style={{
        padding: '1rem',
        border: '1px solid var(--border)',
        display: 'grid',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Quality Score</h4>
        {canEdit && onRecalculate ? (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={busy || loading}
            onClick={onRecalculate}
          >
            Tính lại
          </button>
        ) : null}
      </div>

      {loading && !quality ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Đang tính quality score…
        </p>
      ) : null}

      {quality ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '2.25rem',
                fontWeight: 700,
                color: qualityScoreColor(quality.score),
                lineHeight: 1,
              }}
            >
              {quality.score}
            </span>
            <span className="muted">/100</span>
            <span
              style={{
                fontSize: '0.85rem',
                padding: '0.2rem 0.55rem',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background:
                  tier === 'ready'
                    ? 'rgba(57, 139, 67, 0.08)'
                    : tier === 'conditional'
                      ? 'rgba(255, 180, 0, 0.08)'
                      : 'rgba(192, 57, 43, 0.06)',
              }}
            >
              {qualityTierLabel(tier)}
            </span>
          </div>

          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            {passed}/{total} tiêu chí đạt
            {tier === 'conditional' ? ' · Apply cần xác nhận bổ sung' : ''}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.4rem',
              fontSize: '0.85rem',
            }}
          >
            {QUALITY_CRITERIA_ORDER.map((key) => {
              const ok = Boolean(quality.criteria[key]);
              return (
                <span key={key} style={{ display: 'flex', gap: '0.35rem', alignItems: 'flex-start' }}>
                  <span style={{ color: ok ? 'var(--accent)' : 'var(--muted)' }}>{ok ? '✓' : '○'}</span>
                  <span>{QUALITY_CRITERIA_LABELS[key] ?? key}</span>
                </span>
              );
            })}
          </div>
        </>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Chưa có điểm chất lượng — hệ thống sẽ tự tính khi vào bước Apply.
        </p>
      )}
    </section>
  );
}

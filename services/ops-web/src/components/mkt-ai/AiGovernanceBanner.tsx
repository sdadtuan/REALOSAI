'use client';

import Link from 'next/link';
import styles from '@/components/mkt-ai/mkt-ai-planner.module.css';

interface Props {
  playbookLabel?: string | null;
  governanceNotes?: string[];
  qualityScore?: number | null;
  minScore?: number;
  gateOk?: boolean;
  gateRequired?: boolean;
  gateMessage?: string;
  sticky?: boolean;
  applyLinkHref?: string;
  launchQaLinkHref?: string;
}

export function AiGovernanceBanner({
  playbookLabel,
  governanceNotes = [],
  qualityScore,
  minScore = 70,
  gateOk = true,
  gateRequired = false,
  gateMessage,
  sticky = false,
  applyLinkHref,
  launchQaLinkHref,
}: Props) {
  if (!playbookLabel && governanceNotes.length === 0 && !gateRequired) return null;

  const scoreLabel = qualityScore == null ? 'chưa có' : String(qualityScore);
  const gateColor = gateOk ? 'rgba(57, 139, 67, 0.08)' : 'rgba(255, 200, 0, 0.08)';
  const gateBorder = gateOk ? 'rgba(57, 139, 67, 0.35)' : '#c90';

  return (
    <div
      className={sticky ? styles.governanceBannerSticky : undefined}
      style={{
        display: 'grid',
        gap: '0.45rem',
        padding: '0.65rem 0.75rem',
        borderRadius: 8,
        border: `1px solid ${gateBorder}`,
        background: gateColor,
        fontSize: '0.85rem',
      }}
    >
      <strong style={{ fontSize: '0.9rem' }}>
        Governance{playbookLabel ? ` · ${playbookLabel}` : ''}
      </strong>

      {gateRequired ? (
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.45rem',
            margin: 0,
            cursor: 'default',
          }}
        >
          <input type="checkbox" checked readOnly style={{ marginTop: '0.15rem' }} />
          <span>
            Campaign Quality Score gate trước Launch QA ({scoreLabel}/{minScore}){' '}
            {gateOk ? '✓ đạt' : '— chưa đạt'}
          </span>
        </label>
      ) : null}

      {!gateRequired && qualityScore != null ? (
        <p style={{ margin: 0 }}>
          Campaign Quality Score: {scoreLabel}/{minScore}
        </p>
      ) : null}

      {!gateOk && gateMessage ? (
        <p className="muted" style={{ margin: 0 }}>
          {gateMessage}
        </p>
      ) : null}

      {governanceNotes.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {governanceNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {!gateOk && (applyLinkHref || launchQaLinkHref) ? (
        <p style={{ margin: 0, display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {applyLinkHref ? (
            <Link href={applyLinkHref} className="nav-link">
              Mở AI Planner → Apply / Quality
            </Link>
          ) : null}
          {launchQaLinkHref ? (
            <Link href={launchQaLinkHref} className="nav-link">
              Tab Launch QA →
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

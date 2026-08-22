'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchAnomalyDigest, type AnomalyDigestResponse } from '@/lib/ai-api';

export interface AnomalyDigestBannerProps {
  token: string;
  channel: 'meta' | 'zalo';
  clientId?: string;
}

export function AnomalyDigestBanner({ token, channel, clientId }: AnomalyDigestBannerProps) {
  const [data, setData] = useState<AnomalyDigestResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetchAnomalyDigest(token, { channel, client_id: clientId, days: 7 })
      .then((out) => setData(out.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token, channel, clientId]);

  if (loading || !data?.enabled || !data.digest) {
    return null;
  }

  const digest = data.digest;
  const severityClass =
    digest.severity === 'critical'
      ? 'anomaly-digest-banner--critical'
      : digest.severity === 'warning'
        ? 'anomaly-digest-banner--warning'
        : 'anomaly-digest-banner--info';

  if (digest.severity === 'info' && data.summary.meta_open_alerts + data.summary.zalo_open_alerts === 0) {
    return null;
  }

  return (
    <section
      className={`anomaly-digest-banner card ${severityClass}`}
      data-testid={`anomaly-digest-banner-${channel}`}
      aria-live="polite"
    >
      <div className="anomaly-digest-banner__head">
        <strong>AI anomaly digest · RNOS-28</strong>
        <span className="muted">Read-only · không tự pause campaign</span>
      </div>
      <p className="anomaly-digest-banner__narrative">{digest.narrative}</p>
      {digest.bullets.length > 0 ? (
        <ul className="anomaly-digest-banner__bullets">
          {digest.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      <div className="anomaly-digest-banner__actions">
        <Link href={digest.drill_href} className="btn btn-sm btn-secondary">
          Xem lead liên quan
        </Link>
      </div>
    </section>
  );
}

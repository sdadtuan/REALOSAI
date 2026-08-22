'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchPublicDealTeaser, type PublicDealTeaser } from '@/lib/api';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'KH';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export default function DealTeaserPage({ params }: { params: { token: string } }) {
  const token = params.token ?? '';
  const [data, setData] = useState<PublicDealTeaser | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Link không hợp lệ.');
      setLoading(false);
      return;
    }
    void fetchPublicDealTeaser(token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải được nội dung'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <main className="deal-teaser-page">
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="deal-teaser-page">
        <div className="deal-teaser-card deal-teaser-card--error">
          <h1>Không thể mở bản xem trước</h1>
          <p>{error || 'Link không hợp lệ hoặc đã hết hạn.'}</p>
          <Link href="/login">Đăng nhập Portal →</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="deal-teaser-page">
      <article className="deal-teaser-card">
        <header className="deal-teaser-header">
          <div className="deal-teaser-logo" aria-hidden>
            {initials(data.client_name)}
          </div>
          <div>
            <p className="deal-teaser-eyebrow">PTT Agency · Bản xem trước dự án</p>
            <h1 className="deal-teaser-title">{data.project_name}</h1>
            <p className="deal-teaser-meta muted">
              {data.client_name}
              {data.service_slug ? ` · ${data.service_slug}` : ''}
            </p>
          </div>
        </header>

        {data.north_star ? (
          <section className="deal-teaser-section">
            <h2>North Star</h2>
            <p>{data.north_star}</p>
          </section>
        ) : null}

        {data.strategy_blocks.length ? (
          <section className="deal-teaser-section">
            <h2>Chiến lược chính</h2>
            <div className="deal-teaser-blocks">
              {data.strategy_blocks.map((block) => (
                <div key={block.key} className="deal-teaser-block">
                  <h3>{block.label}</h3>
                  <p>{block.content}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="deal-teaser-footer">
          {data.account_manager_name ? (
            <p className="muted">Account Manager: {data.account_manager_name}</p>
          ) : null}
          <a className="btn btn-primary" href={data.contact_cta.mailto_href}>
            {data.contact_cta.label}
          </a>
          <p className="deal-teaser-expiry muted">
            Link xem trước · hết hạn {new Date(data.expires_at).toLocaleDateString('vi-VN')}
          </p>
        </footer>
      </article>
    </main>
  );
}

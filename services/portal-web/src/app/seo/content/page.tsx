'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { SeoPortalShell } from '@/components/seo/SeoPortalShell';
import { portalSeoPendingContent } from '@/lib/api';

export default function SeoContentPage() {
  return (
    <SeoPortalShell
      title="SEO Content review"
      subtitle="Nội dung chờ phê duyệt từ client"
    >
      {({ token, user, seoEnabled }) =>
        seoEnabled ? <SeoContentList token={token} isApprover={user.role === 'approver'} /> : null
      }
    </SeoPortalShell>
  );
}

function SeoContentList({ token, isApprover }: { token: string; isApprover: boolean }) {
  const [items, setItems] = useState<Array<{ id: number; title: string; content_type: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (authToken: string) => {
    setLoading(true);
    try {
      const data = await portalSeoPendingContent(authToken);
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(token);
  }, [token, load]);

  return (
    <>
      {!isApprover ? (
        <p className="portal-callout muted">Viewer — chỉ xem, không duyệt.</p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? (
        <p className="muted">Đang tải…</p>
      ) : items.length === 0 ? (
        <div className="portal-empty-state">
          <p className="portal-empty-state__title">Không có nội dung chờ duyệt</p>
        </div>
      ) : (
        <ul className="portal-content-list">
          {items.map((item) => (
            <li key={item.id} className="portal-content-list__item">
              <Link href={`/seo/content/${item.id}`} className="portal-content-list__link">
                {item.title}
              </Link>
              <span className="badge">{item.content_type}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

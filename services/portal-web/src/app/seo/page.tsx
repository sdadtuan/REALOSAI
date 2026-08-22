'use client';

import { useEffect, useState } from 'react';
import { SeoPortalShell } from '@/components/seo/SeoPortalShell';
import { SeoWidgetsPanel } from '@/components/SeoWidgetsPanel';
import { portalSeoSummary } from '@/lib/api';

export default function SeoDashboardPage() {
  return (
    <SeoPortalShell
      title="SEO / AEO Dashboard"
      subtitle="Search Console, AEO coverage và pipeline nội dung"
    >
      {({ token, seoEnabled }) => <SeoDashboardContent token={token} seoEnabled={seoEnabled} />}
    </SeoPortalShell>
  );
}

function SeoDashboardContent({ token, seoEnabled }: { token: string; seoEnabled: boolean }) {
  const [error, setError] = useState('');

  useEffect(() => {
    if (!seoEnabled) return;
    void portalSeoSummary(token)
      .then((data) => {
        if (data.seo_enabled === false) {
          setError('SEO chưa được kích hoạt cho client này.');
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Lỗi tải SEO summary'));
  }, [token, seoEnabled]);

  if (!seoEnabled) return null;

  return (
    <>
      {error ? <p className="error">{error}</p> : null}
      <SeoWidgetsPanel token={token} />
    </>
  );
}

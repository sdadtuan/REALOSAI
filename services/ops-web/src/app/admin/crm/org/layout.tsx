'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { winOrgUiEnabled } from '@/lib/win/flags';

export default function AdminOrgLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!winOrgUiEnabled()) {
      router.replace('/admin/crm/permissions');
    }
  }, [router]);

  if (!winOrgUiEnabled()) {
    return <p className="muted">WIN-2 Org UI chưa bật (NEXT_PUBLIC_WIN_ORG_UI=1).</p>;
  }

  return children;
}

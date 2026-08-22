'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { winKpiSolutionEnabled } from '@/lib/win/flags';

export default function CrmKpiSolutionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!winKpiSolutionEnabled()) {
      router.replace('/crm/kpi');
    }
  }, [router]);

  if (!winKpiSolutionEnabled()) {
    return <p className="muted">WIN-2 KPI Solution chưa bật (NEXT_PUBLIC_WIN_KPI_SOLUTION=1).</p>;
  }

  return children;
}

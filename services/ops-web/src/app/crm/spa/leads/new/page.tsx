'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacySpaNewLeadRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/crm/operational/leads/new');
  }, [router]);
  return null;
}

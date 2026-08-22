'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacySpaLeadsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/crm/operational/leads');
  }, [router]);
  return null;
}

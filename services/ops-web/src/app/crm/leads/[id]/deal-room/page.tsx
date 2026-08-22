'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { DealRoomPage } from '@/components/deal-room/DealRoomPage';
import { dealRoomEnabled } from '@/lib/crm/deal-room-flags';

function DealRoomRouteInner() {
  const params = useParams();
  const leadId = Number(params.id);

  if (!Number.isFinite(leadId) || leadId <= 0) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Lead ID không hợp lệ.</p>
      </main>
    );
  }

  return <DealRoomPage leadId={leadId} />;
}

export default function CrmLeadDealRoomRoute() {
  if (!dealRoomEnabled()) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Deal Room chưa bật (NEXT_PUBLIC_DEAL_ROOM=0).</p>
      </main>
    );
  }

  return (
    <Suspense
      fallback={
        <main style={{ padding: '2rem' }}>
          <p className="muted">Đang tải Deal Room…</p>
        </main>
      }
    >
      <DealRoomRouteInner />
    </Suspense>
  );
}

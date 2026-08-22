'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { DealRoomPage } from '@/components/deal-room/DealRoomPage';
import { dealRoomEnabled } from '@/lib/crm/deal-room-flags';
import { shouldHideDealRoom } from '@/lib/bds/deal-room-hide';
import { fetchLead, staffMe } from '@/lib/api';
import { getAccessToken, getStoredUser, type StoredStaffUser } from '@/lib/auth';

function DealRoomRouteInner() {
  const params = useParams();
  const leadId = Number(params.id);
  const [blocked, setBlocked] = useState<boolean | null>(null);

  useEffect(() => {
    if (!Number.isFinite(leadId) || leadId <= 0) return;
    const token = getAccessToken();
    if (!token) {
      setBlocked(true);
      return;
    }
    let user: StoredStaffUser | null = getStoredUser();
    void (async () => {
      try {
        if (!user) user = await staffMe(token);
        const lead = await fetchLead(token, leadId);
        setBlocked(
          shouldHideDealRoom({
            leadFlowKind: lead.lead_flow_kind,
            user,
          }),
        );
      } catch {
        setBlocked(true);
      }
    })();
  }, [leadId]);

  if (!Number.isFinite(leadId) || leadId <= 0) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Lead ID không hợp lệ.</p>
      </main>
    );
  }

  if (blocked === null) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Đang kiểm tra quyền…</p>
      </main>
    );
  }

  if (blocked) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
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

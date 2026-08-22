'use client';

import Link from 'next/link';
import type { LeadFunnelSnapshot } from '@/lib/api';
import { isConsultWorkspaceReadOnly, resolvePresalesSolutionCaps } from '@/lib/crm/presales-solution-caps';
import type { StoredStaffUser } from '@/lib/auth';

function badgeText(funnel: LeadFunnelSnapshot): string | null {
  const handoff = funnel.presales?.handoff;
  if (!handoff) return null;
  if (handoff.status === 'pending') return 'Đang chờ Solution/MKT nhận case';
  if (handoff.status === 'with_solution') {
    const who = handoff.solution_owner_name?.trim();
    return who ? `Đang Solution/MKT — ${who}` : 'Đang Solution/MKT xử lý';
  }
  return null;
}

export function PresalesSolutionHandoffBanner({
  funnel,
  user,
}: {
  funnel: LeadFunnelSnapshot | null;
  user?: StoredStaffUser | null;
}) {
  if (!funnel?.presales_on_lead_enabled || !funnel.presales) return null;
  const text = badgeText(funnel);
  if (!text) return null;
  const readOnly = isConsultWorkspaceReadOnly(funnel, resolvePresalesSolutionCaps(user ?? null));

  return (
    <div className="banner banner-info" data-testid="presales-solution-handoff-banner">
      <strong>Giai đoạn Solution/MKT</strong>
      <p style={{ margin: '0.35rem 0 0' }}>{text}</p>
      {readOnly ? (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
          Bạn theo dõi — không chỉnh Consult/R5. Solution trả Sales khi sẵn sàng Báo giá.
        </p>
      ) : null}
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
        <Link href="/crm/solution/queue" className="nav-link">
          Mở hàng chờ Solution →
        </Link>
      </p>
    </div>
  );
}
